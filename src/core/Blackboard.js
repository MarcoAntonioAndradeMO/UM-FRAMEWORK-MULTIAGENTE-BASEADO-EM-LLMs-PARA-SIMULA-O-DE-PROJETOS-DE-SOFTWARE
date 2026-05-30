/**
 * Blackboard.js
 *
 * Fonte única da verdade sobre o estado da simulação.
 * Mantém tarefas, estimativas, bloqueios, decisões e histórico de mudanças.
 *
 * O Blackboard NÃO conhece LLMs, agentes ou prompts — apenas o id (string)
 * de quem realizou cada ação. Toda mutação é controlada por métodos públicos
 * e registrada no Logger.
 *
 * Decisão de design — transições inválidas:
 *   Lançamos exceção (em vez de retornar tagged result) porque uma transição
 *   inválida representa um bug no Orchestrator, não um dado inesperado em runtime.
 *   O Orchestrator envolve as chamadas de mutação em try/catch quando necessário.
 */

/**
 * Status válidos de uma tarefa.
 * Congelado para evitar modificação acidental fora do módulo.
 */
export const TaskStatus = Object.freeze({
  PLANNED:      'PLANNED',
  IN_PROGRESS:  'IN_PROGRESS',
  IN_REVIEW:    'IN_REVIEW',
  DONE:         'DONE',
  REJECTED:     'REJECTED',
  CARRIED_OVER: 'CARRIED_OVER',
});

/**
 * Tabela de transições válidas — documenta o ciclo de vida completo de uma tarefa.
 *
 * PLANNED      → IN_PROGRESS (atribuída e iniciada)
 *              → CARRIED_OVER (sprint fechou antes de começar)
 * IN_PROGRESS  → IN_REVIEW (dev enviou para QA revisar)
 *              → CARRIED_OVER (sprint fechou sem terminar)
 * IN_REVIEW    → DONE (QA aprovou)
 *              → IN_PROGRESS (QA rejeitou; dev precisa corrigir)
 *              → CARRIED_OVER (sprint fechou durante revisão)
 * DONE         → (terminal)
 * REJECTED     → IN_PROGRESS (re-tentativa após rejeição formal)
 * CARRIED_OVER → IN_PROGRESS (retomada na sprint seguinte)
 */
const VALID_TRANSITIONS = Object.freeze({
  [TaskStatus.PLANNED]:      [TaskStatus.IN_PROGRESS, TaskStatus.CARRIED_OVER],
  [TaskStatus.IN_PROGRESS]:  [TaskStatus.IN_REVIEW,   TaskStatus.CARRIED_OVER],
  [TaskStatus.IN_REVIEW]:    [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CARRIED_OVER],
  [TaskStatus.DONE]:         [],
  [TaskStatus.REJECTED]:     [TaskStatus.IN_PROGRESS],
  [TaskStatus.CARRIED_OVER]: [TaskStatus.IN_PROGRESS],
});

/**
 * Blackboard — estrutura de dados compartilhada da simulação.
 */
export class Blackboard {
  /**
   * @param {object}   options
   * @param {object[]} options.backlog - Array de tarefas iniciais (de backlog.js)
   * @param {object}   [options.logger] - Instância do Logger (Etapa 2); opcional
   */
  constructor({ backlog, logger }) {
    this.logger        = logger ?? null;
    this.currentSprint = null;
    this.decisions     = [];
    this.blockers      = [];
    this._blockerCount = 0;

    // Tarefas indexadas por ID — O(1) para lookup
    this._tasks = new Map();
    for (const item of backlog) {
      this._tasks.set(item.id, {
        id:               item.id,
        title:            item.title,
        dependsOn:        item.dependsOn  ?? [],
        note:             item.note       ?? null,
        // Campos de controle inicializados pelo Blackboard
        status:           TaskStatus.PLANNED,
        // `estimate`  → estimativa CONSOLIDADA/mais recente (último valor acordado).
        // `estimates` → histórico COMPLETO de quem estimou o quê e quando.
        //   Separação intencional: `estimate` é o número que o Orchestrator usa;
        //   `estimates` preserva a divergência entre agentes para análise do TCC.
        estimate:         null,
        estimates:        [],
        assignee:         null,
        sprintIntroduced: null,   // preenchido na primeira transição para IN_PROGRESS
        history:          [],
      });
    }
  }

  // ─── Consulta (sem mutação) ───────────────────────────────────────────────

  /**
   * Retorna uma tarefa pelo id, ou undefined se não existir.
   * @param {string} taskId
   * @returns {object|undefined}
   */
  getTask(taskId) {
    return this._tasks.get(taskId);
  }

  /**
   * Retorna todas as tarefas como array.
   * @returns {object[]}
   */
  getBacklog() {
    return Array.from(this._tasks.values());
  }

  /**
   * Filtra tarefas por status.
   * @param {string} status - Uma constante de TaskStatus
   * @returns {object[]}
   */
  getTasksByStatus(status) {
    return this.getBacklog().filter((t) => t.status === status);
  }

  /**
   * Retorna apenas os blockers ainda não resolvidos.
   * @returns {object[]}
   */
  getActiveBlockers() {
    return this.blockers.filter((b) => !b.resolvedAt);
  }

  /**
   * Verifica se todas as dependências de uma tarefa estão DONE.
   * Usado pelo Orchestrator para decidir se uma tarefa pode ser iniciada.
   * @param {string} taskId
   * @returns {boolean}
   */
  getDependenciesMet(taskId) {
    const task = this._requireTask(taskId);
    return task.dependsOn.every((depId) => {
      const dep = this._tasks.get(depId);
      return dep?.status === TaskStatus.DONE;
    });
  }

  /**
   * Retorna um objeto serializável com o estado completo do Blackboard.
   * Usado por Logger.saveSnapshot() no final de cada sprint.
   * @returns {object}
   */
  getSnapshot() {
    return {
      generatedAt:   new Date().toISOString(),
      currentSprint: this.currentSprint,
      tasks:         this.getBacklog(),
      decisions:     this.decisions,
      blockers:      this.blockers,
    };
  }

  // ─── Mutação (controlada, cada uma loga o que mudou) ─────────────────────

  /**
   * Define a sprint atual. Deve ser chamado no início de cada sprint.
   * @param {number} n - Número da sprint
   */
  startSprint(n) {
    this.currentSprint = n;
    this._log('BB_SPRINT_START', { sprint: n });
  }

  /**
   * Registra a estimativa de um agente para uma tarefa.
   *
   * Toda chamada acumula uma entrada em `task.estimates` (histórico completo).
   * `task.estimate` é sempre atualizado para o valor mais recente — representa
   * a estimativa consolidada que o Orchestrator usa para decisões de sprint.
   *
   * @param {string} taskId
   * @param {number} value      - Estimativa em dias (convenção da simulação)
   * @param {string} byAgentId
   */
  setEstimate(taskId, value, byAgentId) {
    const task = this._requireTask(taskId);

    // Acumula no histórico — nunca sobrescreve entradas anteriores
    task.estimates.push({
      by:     byAgentId,
      value,
      sprint: this.currentSprint,
      ts:     new Date().toISOString(),
    });

    // Atualiza a estimativa consolidada (valor mais recente)
    task.estimate = value;

    this._log('BB_ESTIMATE', { taskId, value, by: byAgentId }, byAgentId);
  }

  /**
   * Atribui uma tarefa a um agente e registra a sprint de introdução
   * na primeira vez que a tarefa é atribuída.
   * @param {string} taskId
   * @param {string} agentId
   */
  assignTask(taskId, agentId) {
    const task = this._requireTask(taskId);
    task.assignee = agentId;
    if (task.sprintIntroduced === null) {
      task.sprintIntroduced = this.currentSprint;
    }
    this._log('BB_ASSIGN', { taskId, assignee: agentId }, agentId);
  }

  /**
   * Muda o status de uma tarefa, validando a transição contra a tabela
   * VALID_TRANSITIONS. Lança erro se a transição for inválida.
   *
   * Registra no history da tarefa: { sprint, from, to, by, ts }.
   *
   * @param {string} taskId
   * @param {string} newStatus - Constante de TaskStatus
   * @param {string} [byAgentId]
   * @throws {Error} Se a transição for inválida
   */
  setStatus(taskId, newStatus, byAgentId) {
    const task = this._requireTask(taskId);
    const from = task.status;

    if (!Object.values(TaskStatus).includes(newStatus)) {
      throw new Error(
        `Status desconhecido: "${newStatus}". Use uma constante de TaskStatus.`
      );
    }

    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transição inválida para ${taskId}: ${from} → ${newStatus}. ` +
        `Permitidas a partir de ${from}: [${allowed.join(', ') || 'nenhuma — status terminal'}].`
      );
    }

    task.status = newStatus;

    // Registra o sprint onde a tarefa foi trabalhada pela primeira vez
    if (newStatus === TaskStatus.IN_PROGRESS && task.sprintIntroduced === null) {
      task.sprintIntroduced = this.currentSprint;
    }

    task.history.push({
      sprint: this.currentSprint,
      from,
      to:    newStatus,
      by:    byAgentId ?? null,
      ts:    new Date().toISOString(),
    });

    this._log('BB_STATUS_CHANGE', { taskId, from, to: newStatus, by: byAgentId }, byAgentId);
  }

  /**
   * Registra uma decisão tomada pela equipe.
   * @param {{ by: string, content: string, refs?: string[] }} decision
   * @returns {string} ID da decisão (ex: "D1")
   */
  addDecision({ by, content, refs = [] }) {
    const id = `D${this.decisions.length + 1}`;
    const decision = {
      id,
      sprint: this.currentSprint,
      by,
      content,
      refs,
      ts: new Date().toISOString(),
    };
    this.decisions.push(decision);
    this._log('BB_DECISION', { id, by, content, refs }, by);
    return id;
  }

  /**
   * Abre um novo blocker (impedimento).
   * @param {{ by: string, taskId?: string, content: string }} blocker
   * @returns {string} ID do blocker (ex: "B1")
   */
  addBlocker({ by, taskId = null, content }) {
    const id = `B${++this._blockerCount}`;
    const blocker = {
      id,
      sprint:     this.currentSprint,
      by,
      taskId,
      content,
      openedAt:   new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    };
    this.blockers.push(blocker);
    this._log('BB_BLOCKER_OPEN', { id, by, taskId, content }, by);
    return id;
  }

  /**
   * Marca um blocker como resolvido.
   * @param {string} blockerId  - ID retornado por addBlocker
   * @param {string} byAgentId
   * @throws {Error} Se o blocker não existir ou já estiver resolvido
   */
  resolveBlocker(blockerId, byAgentId) {
    const blocker = this.blockers.find((b) => b.id === blockerId);
    if (!blocker) {
      throw new Error(`Blocker não encontrado: "${blockerId}".`);
    }
    if (blocker.resolvedAt) {
      throw new Error(`Blocker "${blockerId}" já está resolvido (em ${blocker.resolvedAt}).`);
    }
    blocker.resolvedAt = new Date().toISOString();
    blocker.resolvedBy = byAgentId;
    this._log('BB_BLOCKER_RESOLVED', { id: blockerId, resolvedBy: byAgentId }, byAgentId);
  }

  /**
   * Fecha a sprint atual e marca como CARRIED_OVER todas as tarefas que
   * não estão DONE nem REJECTED.
   *
   * @returns {{ sprint: number, done: string[], carriedOver: string[], rejected: string[] }}
   */
  closeSprintAndCarryOver() {
    const sprint     = this.currentSprint;
    const done       = [];
    const carriedOver = [];
    const rejected   = [];

    for (const task of this._tasks.values()) {
      if (task.status === TaskStatus.DONE) {
        done.push(task.id);
      } else if (task.status === TaskStatus.REJECTED) {
        rejected.push(task.id);
      } else {
        // PLANNED, IN_PROGRESS, IN_REVIEW ou CARRIED_OVER → carregam para a próxima
        const from  = task.status;
        task.status = TaskStatus.CARRIED_OVER;
        task.history.push({
          sprint,
          from,
          to: TaskStatus.CARRIED_OVER,
          by: 'system',
          ts: new Date().toISOString(),
        });
        carriedOver.push(task.id);
        this._log('BB_STATUS_CHANGE', {
          taskId: task.id,
          from,
          to:  TaskStatus.CARRIED_OVER,
          by: 'system',
        });
      }
    }

    const summary = { sprint, done, carriedOver, rejected };
    this._log('BB_SPRINT_CLOSE', summary);
    return summary;
  }

  // ─── Privado ──────────────────────────────────────────────────────────────

  /**
   * Retorna a tarefa ou lança erro se não existir.
   * @private
   */
  _requireTask(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa não encontrada: "${taskId}".`);
    }
    return task;
  }

  /**
   * Atalho para logger.log com o actor opcional.
   * @private
   */
  _log(event, payload, actor = null) {
    this.logger?.log(event, payload, { actor });
  }
}
