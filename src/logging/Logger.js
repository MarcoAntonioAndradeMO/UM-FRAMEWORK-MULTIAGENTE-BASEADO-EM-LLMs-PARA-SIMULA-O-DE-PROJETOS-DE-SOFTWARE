/**
 * Logger.js
 *
 * Responsável por registrar todos os eventos da simulação em formato
 * JSON Lines (uma linha = um objeto JSON independente por evento).
 *
 * Estratégia de roteamento:
 *   - Sprint ativa  → sprint-<N>.jsonl
 *   - Sem sprint    → events.jsonl
 *
 * Escrita síncrona (appendFileSync): a simulação é sequencial e a
 * latência de I/O é desprezível frente à latência da API. Em troca,
 * ganhamos garantia de ordem e durabilidade mesmo em crash.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve a raiz do projeto a partir de src/logging/Logger.js
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../'
);

/**
 * Gera um runId no formato run-YYYY-MM-DDTHH-MM-SS, seguro para sistemas
 * de arquivos que não aceitam ":" em nomes de diretório.
 * @returns {string}
 */
function generateRunId() {
  const iso = new Date().toISOString(); // "2026-05-21T13:30:00.000Z"
  const sanitized = iso.replace(/:/g, '-').replace(/\.\d+Z$/, '');
  return `run-${sanitized}`;
}

/**
 * Logger principal do BiblioSim.
 *
 * Cada chamada a `log()`, `setSprint()` e `setPhase()` acrescenta uma
 * linha ao arquivo JSONL correto e, opcionalmente, imprime no console.
 */
export class Logger {
  /**
   * @param {object}  [options]
   * @param {string}  [options.rootDir]    - Diretório base dos runs (default: <raiz>/runs)
   * @param {string}  [options.runId]      - ID do run (default: gerado automaticamente)
   * @param {boolean} [options.alsoStdout] - Espelha eventos no console (default: true)
   */
  constructor({ rootDir, runId, alsoStdout = true } = {}) {
    this.runId = runId ?? generateRunId();
    this.rootDir = rootDir ?? path.join(PROJECT_ROOT, 'runs');
    this.runDir = path.join(this.rootDir, this.runId);
    this.alsoStdout = alsoStdout;

    // Estado interno da simulação
    this.currentSprint = null;
    this.currentPhase = null;
    this.currentTurn = 0;

    // Garante que o diretório do run exista antes de qualquer escrita
    fs.mkdirSync(this.runDir, { recursive: true });
  }

  /**
   * Retorna o caminho absoluto do diretório deste run.
   * Útil para que outros módulos saibam onde salvar artefatos.
   * @returns {string}
   */
  getRunDir() {
    return this.runDir;
  }

  /**
   * Define a sprint ativa e registra o evento SPRINT_START.
   * Reseta o contador de turnos para que cada sprint comece do zero.
   * @param {number} sprintNumber
   */
  setSprint(sprintNumber) {
    this.currentSprint = sprintNumber;
    this.currentPhase = null;
    this.currentTurn = 0;
    this._write('SPRINT_START', { sprintNumber });
  }

  /**
   * Define a fase ativa e registra o evento PHASE_START.
   * @param {string} phaseName - "PLANNING" | "EXECUTION" | "REVIEW" | "RETRO"
   */
  setPhase(phaseName) {
    this.currentPhase = phaseName;
    this._write('PHASE_START', { phase: phaseName });
  }

  /**
   * Incrementa e retorna o número do turno atual.
   * Deve ser chamado pelo Orchestrator antes de cada rodada de agentes.
   * @returns {number}
   */
  nextTurn() {
    return ++this.currentTurn;
  }

  /**
   * Registra um evento genérico no arquivo JSONL da sprint corrente.
   * @param {string} eventType       - Ex: "MESSAGE", "DECISION", "RAISE_BLOCKER"
   * @param {object} payload         - Dados livres, específicos do evento
   * @param {object} [options]
   * @param {string} [options.actor] - Identificador do agente que gerou o evento
   */
  log(eventType, payload, { actor = null } = {}) {
    this._write(eventType, payload, actor);
  }

  /**
   * Salva um objeto como arquivo JSON formatado (não é uma linha JSONL).
   * Usado para artefatos pontuais: blackboard-final.json, summary.json, etc.
   * @param {string} filename - Nome do arquivo dentro do diretório do run
   * @param {object} data     - Dados a serializar
   */
  saveSnapshot(filename, data) {
    const filePath = path.join(this.runDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    if (this.alsoStdout) {
      console.log(`[logger] snapshot salvo → ${filePath}`);
    }
  }

  // ─── privado ────────────────────────────────────────────────────────────────

  /**
   * Monta o envelope do evento e o persiste no arquivo correto.
   * Método interno — não chame diretamente fora da classe.
   * @private
   */
  _write(eventType, payload, actor = null) {
    const event = {
      ts:     new Date().toISOString(),
      runId:  this.runId,
      sprint: this.currentSprint,
      phase:  this.currentPhase,
      turn:   this.currentTurn,
      actor,
      event:  eventType,
      payload,
    };

    const line = JSON.stringify(event);

    // Roteia para o arquivo da sprint ativa, ou para events.jsonl
    const filename = this.currentSprint !== null
      ? `sprint-${this.currentSprint}.jsonl`
      : 'events.jsonl';

    fs.appendFileSync(
      path.join(this.runDir, filename),
      line + '\n',
      'utf-8'
    );

    if (this.alsoStdout) {
      this._printConsole(event);
    }
  }

  /**
   * Imprime uma linha legível no console para acompanhamento em tempo real.
   * Formato: [HH:MM:SS] S<n> FASE       T<nn> ACTOR  EVENTO
   * @private
   */
  _printConsole(event) {
    const time    = new Date(event.ts).toTimeString().slice(0, 8);
    const sprint  = event.sprint !== null ? `S${event.sprint}` : '  ';
    const phase   = (event.phase ?? '').padEnd(10);
    const turn    = `T${String(event.turn).padStart(2, '0')}`;
    const actor   = (event.actor ?? '').padEnd(6);
    console.log(`[${time}] ${sprint} ${phase} ${turn} ${actor} ${event.event}`);
  }
}
