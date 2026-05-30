/**
 * client.js
 *
 * Wrapper sobre o SDK Anthropic com suporte a modo mock, parsing tolerante
 * de JSON e retry automático em caso de resposta inválida.
 *
 * Dois modos de operação:
 *   "real"  → chama a API Anthropic via @anthropic-ai/sdk
 *   "mock"  → devolve fixtures pré-definidas sem tocar a rede
 *
 * Resolução do modo (ordem de prioridade):
 *   1. variável de ambiente LLM_MODE ("real" | "mock")
 *   2. parâmetro `mode` do construtor
 *   3. auto-detect: real se ANTHROPIC_API_KEY presente, mock caso contrário
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { extractJson } from './parse.js';
import { AgentResponseSchema } from '../protocol/schemas.js';
import { DEFAULT_SEQUENCE } from './mockResponses.js';

/** Promessa que resolve após N milissegundos — usada no backoff entre retries. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cliente LLM do BiblioSim.
 * Ponto único de comunicação com o modelo — agentes não instanciam o SDK diretamente.
 */
export class LLMClient {
  /**
   * @param {object}   [options]
   * @param {string}   [options.mode]             - "real" | "mock" (sobrescrito por LLM_MODE)
   * @param {string}   [options.model]            - Identificador do modelo (default: env ou claude-sonnet-4-6)
   * @param {string}   [options.apiKey]           - Chave de API (default: ANTHROPIC_API_KEY)
   * @param {object}   [options.logger]           - Instância do Logger da Etapa 2
   * @param {string[]} [options.mockFixtures]     - Fixtures para o modo mock (default: DEFAULT_SEQUENCE)
   * @param {number|null} [options.maxCallsPerRun] - Circuit breaker: máx de chamadas por run (null = sem limite)
   */
  constructor({ mode, model, apiKey, logger, mockFixtures, maxCallsPerRun } = {}) {
    this.logger          = logger ?? null;
    this.model           = model  ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    this.apiKey          = apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
    this.mockFixtures    = mockFixtures ?? DEFAULT_SEQUENCE;
    this._fixtureIndex   = 0;
    this.maxCallsPerRun  = maxCallsPerRun ?? null;
    this._totalCalls     = 0;

    // Resolve o modo e instancia o SDK apenas se necessário
    this.mode = this._resolveMode(mode);
    if (this.mode === 'real') {
      this._anthropic = new Anthropic({ apiKey: this.apiKey });
    }
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  /**
   * Faz uma chamada ao LLM e devolve o TEXTO BRUTO da resposta.
   * Não parseia nem valida — isso fica em completeStructured().
   *
   * @param {object} params
   * @param {string}   params.system      - System prompt do agente
   * @param {object[]} params.messages    - Histórico de mensagens (formato SDK)
   * @param {number}   [params.temperature=0.7]
   * @param {number}   [params.maxTokens=1024]
   * @returns {Promise<string>} Texto bruto da resposta
   * @throws Em modo real: propaga erros do SDK para que completeStructured() faça retry
   */
  async complete({ system, messages, temperature = 0.7, maxTokens = 1024 }) {
    // Circuit breaker: aborta antes de consumir a chamada se o limite foi atingido.
    // O erro é propagado para completeStructured(), que registra LLM_RETRY e,
    // após esgotar tentativas, retorna { ok: false } ao Orchestrator.
    if (this.maxCallsPerRun !== null && this._totalCalls >= this.maxCallsPerRun) {
      this.logger?.log('RUN_CIRCUIT_BREAK', {
        totalCalls: this._totalCalls,
        limit:      this.maxCallsPerRun,
      });
      throw new Error(`RUN_CIRCUIT_BREAK: limite de ${this.maxCallsPerRun} chamadas atingido`);
    }
    this._totalCalls++;

    const t0 = Date.now();

    if (this.mode === 'mock') {
      const raw     = this._nextMockResponse();
      const latency = Date.now() - t0;
      this.logger?.log('LLM_CALL', {
        mode:          'mock',
        model:         this.model,
        temperature,
        latency,
        fixtureIndex:  this._fixtureIndex - 1,
        previewLength: raw.length,
      });
      return raw;
    }

    // Modo real: chama a API e propaga o erro para o caller fazer retry
    const response = await this._anthropic.messages.create({
      model:      this.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    });

    const latency = Date.now() - t0;
    this.logger?.log('LLM_CALL', {
      mode:        'real',
      model:       this.model,
      temperature,
      latency,
      tokens:      { input: response.usage.input_tokens, output: response.usage.output_tokens },
      stop_reason: response.stop_reason,
    });

    return response.content[0].text;
  }

  /**
   * Retorna true se o circuit breaker foi ativado (limite de chamadas atingido).
   * Útil para que o script de execução detecte a condição e salve snapshot parcial.
   * @returns {boolean}
   */
  isCircuitOpen() {
    return this.maxCallsPerRun !== null && this._totalCalls >= this.maxCallsPerRun;
  }

  /**
   * Chama o LLM e retorna uma resposta estruturada validada pelo schema.
   * Implementa retry automático: se a extração de JSON ou a validação falharem,
   * tenta novamente até `maxRetries` vezes adicionais.
   *
   * Em modo mock, cada tentativa avança para a próxima fixture da sequência,
   * permitindo simular cenários de falha seguida de sucesso.
   *
   * @param {object} params
   * @param {string}   params.system
   * @param {object[]} params.messages
   * @param {number}   [params.temperature]
   * @param {number}   [params.maxTokens]
   * @param {number}   [params.maxRetries=2]
   * @returns {Promise<{ ok: true, value: AgentResponse } | { ok: false, error: string, attempts: number }>}
   */
  async completeStructured({ system, messages, temperature, maxTokens, maxRetries = 2 }) {
    const totalAttempts = maxRetries + 1;
    let lastError = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      // Backoff exponencial simples entre retries — apenas no modo real
      // (no mock não há custo de espera e seria ruim para o demo)
      if (attempt > 1 && this.mode === 'real') {
        await sleep((attempt - 1) * 500);
      }

      // ── Passo 1: obter texto bruto ──────────────────────────────────────────
      let raw;
      try {
        raw = await this.complete({ system, messages, temperature, maxTokens });
      } catch (err) {
        lastError = `Erro de rede/API: ${err.message}`;
        this.logger?.log('LLM_RETRY', { attempt, totalAttempts, reason: lastError });
        continue;
      }

      // ── Passo 2: extrair JSON do texto bruto ────────────────────────────────
      const extracted = extractJson(raw);
      if (!extracted.ok) {
        lastError = `Extração de JSON falhou: ${extracted.error}`;
        this.logger?.log('LLM_RETRY', { attempt, totalAttempts, reason: lastError });
        continue;
      }

      // ── Passo 3: validar contra o schema zod ────────────────────────────────
      const validated = AgentResponseSchema.safeParse(extracted.value);
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
          .join('; ');
        lastError = `Validação de schema falhou: ${issues}`;
        this.logger?.log('LLM_RETRY', { attempt, totalAttempts, reason: lastError });
        continue;
      }

      // ── Sucesso ─────────────────────────────────────────────────────────────
      this.logger?.log('LLM_SUCCESS', {
        attempt,
        messageCount: validated.data.messages.length,
      });
      return { ok: true, value: validated.data };
    }

    // Esgotou todas as tentativas sem sucesso
    this.logger?.log('LLM_EXHAUSTED', { attempts: totalAttempts, lastError });
    return { ok: false, error: lastError, attempts: totalAttempts };
  }

  // ─── Privado ─────────────────────────────────────────────────────────────────

  /**
   * Resolve o modo de operação respeitando a ordem de prioridade:
   * variável de ambiente > parâmetro do construtor > auto-detect por apiKey.
   * Se o modo "real" for solicitado sem apiKey, cai para mock com aviso.
   * @private
   */
  _resolveMode(modeParam) {
    const resolved = process.env.LLM_MODE
      ?? modeParam
      ?? (this.apiKey ? 'real' : 'mock');

    if (resolved === 'real' && !this.apiKey) {
      this.logger?.log('LLM_WARNING', {
        message: 'ANTHROPIC_API_KEY ausente — forçando modo mock automaticamente',
      });
      return 'mock';
    }

    return resolved;
  }

  /**
   * Retorna a próxima fixture em modo circular.
   * Garante que a sequência nunca se esgote, independente do número de retries.
   * @private
   */
  _nextMockResponse() {
    const raw = this.mockFixtures[this._fixtureIndex % this.mockFixtures.length];
    this._fixtureIndex++;
    return raw;
  }
}
