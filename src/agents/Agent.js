/**
 * Agent.js
 *
 * Classe base para todos os agentes da simulação BiblioSim.
 * Nada específico de um personagem vive aqui — identidade e comportamento
 * de cada agente são definidos pelo arquivo .md da persona.
 */

import fs from 'node:fs';
import { encode } from 'gpt-tokenizer';

/**
 * Agente autônomo controlado por um LLM.
 *
 * Cada agente encapsula:
 *   - identidade     → id, nome e papel na equipe
 *   - persona        → system prompt lido de um arquivo .md
 *   - memória curta  → entradas da fase/sprint atual
 *   - memória longa  → resumo de sprints anteriores (populado na Etapa 11)
 */
export class Agent {
  /**
   * @param {object} options
   * @param {string} options.id          - Identificador único: "pm" | "dev1" | "dev2" | "qa"
   * @param {string} options.name        - Nome do personagem (ex: "Helena")
   * @param {string} options.role        - Papel na equipe (ex: "Project Manager")
   * @param {string} options.personaPath - Caminho absoluto para o arquivo .md da persona
   * @param {object} options.llmClient   - Instância de LLMClient (Etapa 4)
   * @param {object} [options.logger]    - Instância de Logger (Etapa 2)
   */
  constructor({ id, name, role, personaPath, llmClient, logger }) {
    this.id   = id;
    this.name = name;
    this.role = role;

    // O system prompt é o arquivo .md lido integralmente — define quem o agente é
    try {
      this.systemPrompt = fs.readFileSync(personaPath, 'utf-8');
    } catch (err) {
      throw new Error(`Persona não encontrada em: ${personaPath}. Verifique o parâmetro personaPath.`, { cause: err });
    }

    this.llmClient = llmClient;
    this.logger    = logger ?? null;

    // Memória de curto prazo: entradas da fase atual; limpa a cada reset de fase/sprint
    this.shortTermMemory = [];

    // Memória de longo prazo: resumo gerado pelo Summarizer (Etapa 11)
    // Por ora permanece vazia; será populada entre sprints
    this.longTermSummary = '';
  }

  // ─── Gerenciamento de memória ─────────────────────────────────────────────

  /**
   * Adiciona uma entrada à memória de curto prazo.
   * Chamado pelo Orchestrator (distribuição global — Opção B, DEC-001) e por
   * `act()` quando o próprio agente emite mensagens.
   *
   * O campo `to` é obrigatório na estrutura para preservar a possibilidade de
   * migrar para Opção A (filtrar por destinatário) na Etapa 9 sem reprocessar
   * o histórico. Ver docs/decisoes-de-projeto.md (DEC-001, RESOLVIDA).
   *
   * @param {{ from: string, to: string, type: string, content: string }} entry
   */
  addToMemory(entry) {
    this.shortTermMemory.push(entry);
  }

  /**
   * Define o resumo de longo prazo com o resultado do Summarizer.
   * Permite que sprints anteriores influenciem o comportamento do agente
   * sem ocupar todo o contexto disponível.
   *
   * @param {string} text - Resumo gerado pelo Summarizer
   */
  setLongTermSummary(text) {
    this.longTermSummary = text;
  }

  /**
   * Limpa a memória de curto prazo.
   * Chamado pelo Orchestrator nas transições de fase ou início de sprint.
   */
  resetShortTermMemory() {
    this.shortTermMemory = [];
  }

  // ─── Construção de contexto ───────────────────────────────────────────────

  /**
   * Monta o array de mensagens que será enviado ao LLM.
   *
   * Estrutura do único `user` message gerado:
   *   # Contexto de sprints anteriores  (se longTermSummary existir)
   *   # Histórico desta fase            (se shortTermMemory não estiver vazia)
   *   # Situação atual                  (sempre presente)
   *
   * Usamos um único user message (em vez de alternar roles) para que o
   * conteúdo seja auditável e previsível, independentemente do histórico.
   *
   * @param {string} currentSituation - Descrição da situação atual pelo Orchestrator
   * @returns {Array<{ role: string, content: string }>}
   */
  buildContext(currentSituation) {
    const parts = [];

    if (this.longTermSummary) {
      parts.push(`# Contexto de sprints anteriores\n${this.longTermSummary}`);
    }

    if (this.shortTermMemory.length > 0) {
      // Preserva todas as DECISIONs (escopo da sprint) + últimas MAX_NON_DECISION
      // entradas restantes. Evita explosão de contexto nas sprints tardias sem perder
      // decisões críticas que guiam o comportamento dos agentes.
      const MAX_NON_DECISION = 12;
      const totalNonDecision = this.shortTermMemory.filter((e) => e.type !== 'DECISION').length;
      const cutCount = Math.max(0, totalNonDecision - MAX_NON_DECISION);
      let nonDecisionSeen = 0;
      const memoryView = cutCount > 0
        ? this.shortTermMemory.filter((e) => {
            if (e.type === 'DECISION') return true;
            nonDecisionSeen++;
            return nonDecisionSeen > cutCount;
          })
        : this.shortTermMemory;

      const prefix = cutCount > 0
        ? `(${cutCount} entrada(s) antiga(s) omitida(s) para reduzir contexto)\n`
        : '';
      const history = memoryView
        .map((e) => `- [${e.from}→${e.to ?? 'all'}] (${e.type}): ${e.content}`)
        .join('\n');
      parts.push(`# Histórico desta fase\n${prefix}${history}`);
    }

    parts.push(`# Situação atual\n${currentSituation}`);

    return [{ role: 'user', content: parts.join('\n\n') }];
  }

  // ─── Ação ─────────────────────────────────────────────────────────────────

  /**
   * O agente percebe a situação atual e produz uma resposta validada.
   *
   * Fluxo:
   *  1. Monta o contexto com buildContext()
   *  2. Chama llmClient.completeStructured() (com retry embutido na Etapa 4)
   *  3. Em caso de sucesso: adiciona as próprias mensagens à memória e retorna
   *  4. Em caso de falha: loga o erro e retorna { ok: false } sem derrubar
   *
   * @param {string} currentSituation - O que está acontecendo agora (vem do Orchestrator)
   * @returns {Promise<{ ok: true, value: AgentResponse } | { ok: false, error: string }>}
   */
  async act(currentSituation) {
    const messages = this.buildContext(currentSituation);

    // ── PROMPT_SIZE: diagnóstico de crescimento de contexto ──────────────────
    // Registrado antes de cada chamada ao LLM para rastrear crescimento por sprint.
    // tokens.* usa gpt-tokenizer (cl100k_base) — valores ~10% abaixo do tokenizer
    // interno do Claude, mas proporcionais e suficientes para comparação entre turnos.
    {
      const userContent = messages[0]?.content ?? '';
      const countTokens = (s) => encode(s).length;
      this.logger?.log(
        'PROMPT_SIZE',
        {
          situationHeader: currentSituation.split('\n')[0],
          memoryEntries:   this.shortTermMemory.length,
          chars: {
            system:    this.systemPrompt.length,
            situation: currentSituation.length,
            userMsg:   userContent.length,
            total:     this.systemPrompt.length + userContent.length,
          },
          tokens: {
            system:  countTokens(this.systemPrompt),
            userMsg: countTokens(userContent),
            total:   countTokens(this.systemPrompt) + countTokens(userContent),
          },
        },
        { actor: this.id }
      );
    }

    this.logger?.log(
      'AGENT_ACT',
      {
        situation:  currentSituation.slice(0, 500),
        memorySize: this.shortTermMemory.length,
      },
      { actor: this.id }
    );

    // Loga o input completo antes de cada chamada ao LLM.
    // Permite reconstruir o prompt exato de qualquer decisão no pós-run.
    this.logger?.log(
      'LLM_REQUEST',
      { system: this.systemPrompt, messages },
      { actor: this.id }
    );

    const result = await this.llmClient.completeStructured({
      system:   this.systemPrompt,
      messages,
    });

    if (!result.ok) {
      this.logger?.log(
        'AGENT_ACT_FAIL',
        { error: result.error, attempts: result.attempts },
        { actor: this.id }
      );
      return { ok: false, error: result.error };
    }

    // Registra as próprias mensagens na memória de curto prazo — o agente
    // lembra o que disse e isso aparecerá no contexto dos próximos turnos.
    // `to` é incluído para manter compatibilidade com DEC-001 (Opção B → A futura).
    for (const msg of result.value.messages) {
      this.addToMemory({ from: this.id, to: msg.to, type: msg.type, content: msg.content });
    }

    // thoughts vai APENAS para o log — é dado de pesquisa, não é compartilhado
    // com outros agentes nem adicionado à shortTermMemory
    this.logger?.log(
      'AGENT_ACT_OK',
      {
        thoughts:     result.value.thoughts,
        messageCount: result.value.messages.length,
        memorySize:   this.shortTermMemory.length,
      },
      { actor: this.id }
    );

    return result;
  }
}
