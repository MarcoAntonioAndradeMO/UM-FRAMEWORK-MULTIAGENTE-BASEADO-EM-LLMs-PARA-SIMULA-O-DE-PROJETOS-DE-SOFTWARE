/**
 * Orchestrator.js
 *
 * Coordena a execução de fases da simulação: gerencia o loop de turnos,
 * chama os agentes na ordem correta, reflete mensagens no Blackboard e
 * distribui para a memória de curto prazo dos agentes (Opção B — DEC-001).
 *
 * Mecânica de turnos (Etapa 8 — PM-passa-a-palavra):
 *   1. PM age livremente e emite mensagens.
 *   2. Agentes endereçados (via `to` nas mensagens da PM) respondem em
 *      ordem canônica: dev1 → dev2 → qa.
 *   3. `turns` conta apenas ações da PM (base do MAX_TURNS).
 *   4. Falhas de agentes não-PM são "suaves" — logadas mas não param a fase.
 *   5. Condições de parada: DECISION (só PLANNING), NO_ACTIONABLE_TASKS
 *      (só EXECUTION), MAX_TURNS, AGENT_FAILURES (só PM).
 */

import { TaskStatus } from './Blackboard.js';

// Ordem canônica em que os agentes não-PM respondem após a PM falar.
// Garante consistência independente de como o Map foi construído.
const NON_PM_ORDER = ['dev1', 'dev2', 'qa'];

/**
 * Orchestrator da simulação BiblioSim.
 */
export class Orchestrator {
  /**
   * @param {object}     options
   * @param {Map|object} options.agents     - Mapa id → Agent
   * @param {object}     options.blackboard - Instância do Blackboard
   * @param {object}     options.logger     - Instância do Logger
   * @param {object}     options.config     - SIMULATION_CONFIG
   * @param {object[]}   [options.backlog]  - Backlog original (de backlog.js); usado
   *                                         para mapear id → sprint em _shouldStopPhase
   */
  constructor({ agents, blackboard, logger, config, backlog = [] }) {
    // Aceita tanto Map quanto objeto literal { pm: agent, dev1: agent, ... }
    this.agents     = agents instanceof Map ? agents : new Map(Object.entries(agents));
    this.blackboard = blackboard;
    this.logger     = logger;
    this.config     = config;
    // Tabela id → sprint: permite filtrar tarefas da sprint ativa em _shouldStopPhase
    this._taskSprint = new Map(backlog.map(({ id, sprint }) => [id, sprint ?? null]));
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  /**
   * Executa uma fase completa da simulação.
   *
   * Loop de turnos até uma das condições de parada:
   *   (a) DECISION            — PM emitiu DECISION (apenas PLANNING)
   *   (b) NO_ACTIONABLE_TASKS — nenhuma tarefa da sprint é acionável (apenas EXECUTION)
   *   (c) REVIEW_COMPLETE     — nenhuma tarefa da sprint está em IN_REVIEW (apenas REVIEW)
   *   (d) MAX_TURNS           — número máximo de turnos da PM atingido
   *   (e) AGENT_FAILURES      — muitas falhas consecutivas da PM
   *
   * @param {string} phaseName - "PLANNING" | "EXECUTION" | "REVIEW" | "RETRO"
   * @param {{ sprint: number }} context
   * @returns {Promise<{ phase: string, sprint: number, turns: number, stopped: string }>}
   */
  async runPhase(phaseName, { sprint }) {
    const maxTurns              = this.config.maxTurnsPerPhase[phaseName] ?? 10;
    const MAX_CONSECUTIVE_FAILS = 2;

    // setPhase() registra PHASE_START e define o roteamento de eventos
    this.logger.setPhase(phaseName);

    // Reset de memória de curto prazo por fase — cada fase tem propósito distinto
    // (PLANNING, EXECUTION, REVIEW, RETRO) e não deve acumular contexto entre elas.
    // Sem o reset, sprints tardias acumulariam centenas de entradas, inflando o
    // context window e misturando sinais de fases anteriores.
    for (const agent of this.agents.values()) {
      agent.resetShortTermMemory();
    }

    let pmTurns             = 0;
    let consecutiveFailures = 0;
    let stopped             = null;

    while (!stopped) {
      // ── Verificação antecipada: encerra REVIEW se não há tarefas IN_REVIEW ──
      if (phaseName === 'REVIEW') {
        const earlyStop = this._shouldStopPhase(phaseName, sprint);
        if (earlyStop) { stopped = earlyStop; break; }
      }

      // ── PM age (avança o contador canônico de turnos da fase) ─────────────
      pmTurns++;
      this.logger.nextTurn();

      const pm = this.agents.get('pm');
      if (!pm) {
        this.logger.log('ORCHESTRATOR_ERROR', {
          error: "Agente 'pm' não encontrado no mapa.",
          turn:  pmTurns,
        });
        stopped = 'MISSING_AGENT';
        break;
      }

      const situation = this._buildSituation(phaseName, sprint, pmTurns);
      const pmResult  = await pm.act(situation);

      if (!pmResult.ok) {
        consecutiveFailures++;
        this.logger.log('ORCHESTRATOR_AGENT_FAIL', {
          agent:              'pm',
          turn:               pmTurns,
          consecutiveFailures,
          error:              pmResult.error,
        });
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILS) stopped = 'AGENT_FAILURES';
        continue;
      }

      consecutiveFailures = 0;
      let decisionEmitted = false;

      // Agentes não-PM endereçados neste turno — usamos Set para evitar duplicatas
      // (ex: PM manda para 'all' e também diretamente para 'dev1')
      const addressedSet = new Set();

      for (const msg of pmResult.value.messages) {
        // 1. Registrar no log
        this.logger.log(
          'MESSAGE',
          { to: msg.to, type: msg.type, content: msg.content, refs: msg.refs ?? [] },
          { actor: 'pm' }
        );
        // 2. Refletir estado no Blackboard
        this._reflectOnBlackboard(msg, 'pm');
        // 3. Distribuir para memória dos outros agentes
        this._distributeToMemory(msg, 'pm');

        if (msg.type === 'DECISION') decisionEmitted = true;

        // Coletar destinatários para a rodada de resposta
        if (msg.to === 'all') {
          // 'all' convoca todos os não-PM presentes
          NON_PM_ORDER.forEach((id) => {
            if (this.agents.has(id)) addressedSet.add(id);
          });
        } else if (msg.to !== 'pm' && this.agents.has(msg.to)) {
          addressedSet.add(msg.to);
        }
      }

      // Verificar condições de parada antes de passar a palavra
      if (phaseName === 'PLANNING' && decisionEmitted) { stopped = 'DECISION'; break; }
      const stopAfterPm = this._shouldStopPhase(phaseName, sprint);
      if (stopAfterPm)          { stopped = stopAfterPm; break; }
      if (pmTurns >= maxTurns)  { stopped = 'MAX_TURNS'; break; }

      // ── Agentes endereçados respondem em ordem canônica ───────────────────
      for (const agentId of NON_PM_ORDER) {
        if (!addressedSet.has(agentId)) continue;

        const agent = this.agents.get(agentId);
        // logger.nextTurn() avança o contador de turno para cada ação individual
        this.logger.nextTurn();

        const agentResult = await agent.act(situation);

        if (!agentResult.ok) {
          // Falha suave: registrada no log, mas não interrompe a fase
          this.logger.log('ORCHESTRATOR_AGENT_FAIL', {
            agent: agentId,
            soft:  true,
            error: agentResult.error,
          });
          continue;
        }

        for (const msg of agentResult.value.messages) {
          this.logger.log(
            'MESSAGE',
            { to: msg.to, type: msg.type, content: msg.content, refs: msg.refs ?? [] },
            { actor: agentId }
          );
          this._reflectOnBlackboard(msg, agentId);
          this._distributeToMemory(msg, agentId);
        }
      }

      // Re-checar parada após agentes não-PM agirem.
      // EXECUTION: REVIEW_REQUEST de dev1 pode tornar todas as tarefas não-acionáveis.
      // REVIEW: APPROVE/REJECT do QA pode encerrar o ciclo de revisão.
      if (!stopped) {
        const stopAfterAll = this._shouldStopPhase(phaseName, sprint);
        if (stopAfterAll) stopped = stopAfterAll;
      }
    }

    const summary = { phase: phaseName, sprint, turns: pmTurns, stopped };
    this.logger.log('PHASE_END', summary);
    return summary;
  }

  // ─── Privado ─────────────────────────────────────────────────────────────────

  /**
   * Monta o texto de situação enviado ao agente em cada turno.
   * Em modo mock o conteúdo não afeta a fixture; no modo real este texto
   * é o principal guia do comportamento do agente.
   *
   * Cada fase exibe as tarefas da sprint ativa com title, note e dependsOn
   * para que os riscos plantados no backlog cheguem ao LLM.
   * @private
   */
  _buildSituation(phaseName, sprint, turn) {
    const allTasks    = this.blackboard.getBacklog();
    const sprintTasks = allTasks.filter((t) => this._taskSprint.get(t.id) === sprint);

    const lines = [`Fase: ${phaseName} | Sprint: ${sprint} | Turno: ${turn}`];

    /**
     * Formata uma tarefa com title, note e dependências indentados.
     * @param {object}  t        - Objeto de tarefa do Blackboard
     * @param {boolean} showDeps - Se true, exibe status atual de cada dep
     */
    const fmtTask = (t, showDeps = true) => {
      const assignee = t.assignee ? ` [${t.assignee}]` : '';
      const parts    = [`  ${t.id} (${t.status}) — ${t.title}${assignee}`];
      if (t.dependsOn?.length) {
        const deps = t.dependsOn
          .map((depId) => {
            const dep = allTasks.find((d) => d.id === depId);
            return showDeps && dep ? `${depId} (${dep.status})` : depId;
          })
          .join(', ');
        parts.push(`    depende de: ${deps}`);
      }
      if (t.note) {
        parts.push(`    nota: ${t.note}`);
      }
      return parts.join('\n');
    };

    if (phaseName === 'PLANNING') {
      const toplan = sprintTasks.filter(
        (t) => t.status === 'PLANNED' || t.status === 'CARRIED_OVER'
      );
      lines.push('', `Tarefas da Sprint ${sprint} para planejamento:`);
      if (toplan.length) {
        toplan.forEach((t) => lines.push(fmtTask(t)));
      } else {
        lines.push('  (nenhuma tarefa a planejar nesta sprint)');
      }
      lines.push(
        '',
        `Conduza o PLANNING da Sprint ${sprint}: apresente as tarefas à equipe,`,
        `solicite estimativas dos devs para as tarefas prioritárias e registre`,
        `a decisão de escopo com uma mensagem do tipo DECISION.`
      );

    } else if (phaseName === 'EXECUTION') {
      const activeBlockers = this.blackboard.getActiveBlockers();
      const blockedIds     = new Set(
        activeBlockers.filter((b) => b.taskId !== null).map((b) => b.taskId)
      );

      const actionable  = sprintTasks.filter((t) =>
        (t.status === 'PLANNED' || t.status === 'IN_PROGRESS') &&
        this.blackboard.getDependenciesMet(t.id) &&
        !blockedIds.has(t.id)
      );
      const inReview    = sprintTasks.filter((t) => t.status === 'IN_REVIEW');
      const blocked     = sprintTasks.filter((t) =>
        (t.status === 'PLANNED' || t.status === 'IN_PROGRESS') &&
        blockedIds.has(t.id)
      );
      const waitingDeps = sprintTasks.filter((t) =>
        (t.status === 'PLANNED' || t.status === 'IN_PROGRESS') &&
        !this.blackboard.getDependenciesMet(t.id) &&
        !blockedIds.has(t.id)
      );

      if (actionable.length) {
        lines.push('', 'Tarefas acionáveis (dependências satisfeitas):');
        actionable.forEach((t) => lines.push(fmtTask(t)));
      }
      if (inReview.length) {
        lines.push('', 'Aguardando revisão (IN_REVIEW):');
        inReview.forEach((t) => lines.push(fmtTask(t, false)));
      }
      if (blocked.length) {
        lines.push('', 'Bloqueadas:');
        blocked.forEach((t) => {
          lines.push(fmtTask(t, false));
          activeBlockers
            .filter((b) => b.taskId === t.id)
            .forEach((b) => lines.push(`    blocker ${b.id}: ${b.content}`));
        });
      }
      if (waitingDeps.length) {
        lines.push('', 'Aguardando dependências:');
        waitingDeps.forEach((t) => lines.push(fmtTask(t)));
      }
      if (!actionable.length && !inReview.length) {
        lines.push('', '  (nenhuma tarefa acionável ou em revisão nesta sprint)');
      }

      lines.push(
        '',
        `Conduza a EXECUTION da Sprint ${sprint}.`,
        '',
        `Devs: use CLAIM_TASK (refs obrigatório) para assumir e iniciar uma tarefa`,
        `(PLANNED → IN_PROGRESS). Use REPORT_PROGRESS para atualizar o progresso.`,
        `Quando concluído, envie REVIEW_REQUEST (refs obrigatório) ao QA.`,
        `Se a nota da tarefa indicar risco, levante RAISE_BLOCKER imediatamente.`,
        `QA: use APPROVE ou REJECT (refs obrigatório) nas tarefas em IN_REVIEW.`
      );

    } else if (phaseName === 'REVIEW') {
      const inReview = sprintTasks.filter((t) => t.status === 'IN_REVIEW');
      lines.push('', `Tarefas em revisão nesta sprint:`);
      if (inReview.length) {
        inReview.forEach((t) => lines.push(fmtTask(t, false)));
      } else {
        lines.push('  (nenhuma tarefa em IN_REVIEW nesta sprint)');
      }
      lines.push('', `Conduza a fase ${phaseName} da Sprint ${sprint}.`);

    } else {
      // RETRO e fases futuras: resumo geral por status (visão retrospectiva)
      const byStatus = (status) =>
        allTasks
          .filter((t) => t.status === status)
          .map((t) => t.id)
          .join(', ') || '—';

      lines.push(
        '',
        'Estado geral do backlog:',
        `  PLANNED:      ${byStatus('PLANNED')}`,
        `  IN_PROGRESS:  ${byStatus('IN_PROGRESS')}`,
        `  IN_REVIEW:    ${byStatus('IN_REVIEW')}`,
        `  DONE:         ${byStatus('DONE')}`,
        `  CARRIED_OVER: ${byStatus('CARRIED_OVER')}`,
        '',
        `Conduza a fase ${phaseName} da Sprint ${sprint}.`
      );
    }

    return lines.join('\n');
  }

  /**
   * Reflete uma mensagem no Blackboard quando o tipo tem efeito de estado.
   * Erros são logados mas não derrubam a fase — o Orchestrator é resiliente.
   *
   * Mapeamento:
   *   DECISION       → blackboard.addDecision(...)
   *   ASSIGN_TASK    → blackboard.assignTask(...) para cada ref
   *   CLAIM_TASK     → assignTask + setStatus(IN_PROGRESS) para cada ref
   *   REVIEW_REQUEST → setStatus(IN_REVIEW) para cada ref
   *   APPROVE        → setStatus(DONE) para cada ref
   *   REJECT         → setStatus(IN_PROGRESS) para cada ref
   *   RAISE_BLOCKER  → addBlocker (taskId = refs[0] ?? null)
   *   ESTIMATE       → setEstimate se número extraível do content
   *   Demais         → sem efeito direto no Blackboard
   * @private
   */
  _reflectOnBlackboard(msg, byAgentId) {
    try {
      switch (msg.type) {
        case 'DECISION':
          this.blackboard.addDecision({
            by:      byAgentId,
            content: msg.content,
            refs:    msg.refs ?? [],
          });
          break;

        case 'ASSIGN_TASK':
          if (msg.refs?.length) {
            for (const taskId of msg.refs) {
              this.blackboard.assignTask(taskId, msg.to);
            }
          }
          break;

        case 'CLAIM_TASK':
          if (msg.refs?.length) {
            for (const taskId of msg.refs) {
              this.blackboard.assignTask(taskId, byAgentId);
              this.blackboard.setStatus(taskId, TaskStatus.IN_PROGRESS, byAgentId);
            }
          }
          break;

        case 'REVIEW_REQUEST':
          if (msg.refs?.length) {
            for (const taskId of msg.refs) {
              this.blackboard.setStatus(taskId, TaskStatus.IN_REVIEW, byAgentId);
            }
          }
          break;

        case 'APPROVE':
          if (msg.refs?.length) {
            for (const taskId of msg.refs) {
              this.blackboard.setStatus(taskId, TaskStatus.DONE, byAgentId);
            }
          }
          break;

        case 'REJECT':
          if (msg.refs?.length) {
            for (const taskId of msg.refs) {
              this.blackboard.setStatus(taskId, TaskStatus.IN_PROGRESS, byAgentId);
            }
          }
          break;

        case 'RAISE_BLOCKER':
          this.blackboard.addBlocker({
            by:      byAgentId,
            taskId:  msg.refs?.[0] ?? null,
            content: msg.content,
          });
          break;

        case 'ESTIMATE': {
          if (msg.refs?.length) {
            // Extrai primeiro número com unidade; fallback: número após ':'
            const numMatch =
              msg.content.match(/\b(\d+)\s*(?:dias?|pontos?|pts?|horas?)\b/i) ??
              msg.content.match(/:\s*(\d+)\b/);
            const value = numMatch ? Number(numMatch[1]) : null;
            if (value === null) {
              this.logger.log('ORCHESTRATOR_ERROR', {
                error:       'Não foi possível extrair número da estimativa.',
                messageType: 'ESTIMATE',
                content:     msg.content,
                by:          byAgentId,
              });
            } else {
              for (const taskId of msg.refs) {
                this.blackboard.setEstimate(taskId, value, byAgentId);
              }
            }
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      this.logger.log('ORCHESTRATOR_ERROR', {
        error:       err.message,
        messageType: msg.type,
        refs:        msg.refs ?? [],
        by:          byAgentId,
      });
    }
  }

  /**
   * Determina se a fase deve encerrar por condição de negócio.
   * Retorna null (continua) ou a string da condição de parada.
   *
   * EXECUTION — NO_ACTIONABLE_TASKS:
   *   Nenhuma tarefa da sprint está PLANNED/IN_PROGRESS com deps satisfeitas e sem blocker.
   *
   * REVIEW — REVIEW_COMPLETE:
   *   (a) Nenhuma tarefa da sprint está IN_REVIEW, E
   *   (b) Nenhuma tarefa está IN_PROGRESS após ter sido rejeitada (IN_REVIEW → IN_PROGRESS),
   *       pois isso indica correção pendente que ainda será resubmetida.
   *
   * @param {string} phaseName
   * @param {number} sprint
   * @returns {string|null}
   * @private
   */
  _shouldStopPhase(phaseName, sprint) {
    if (phaseName === 'EXECUTION') {
      const activeBlockerIds = new Set(
        this.blackboard.getActiveBlockers()
          .filter((b) => b.taskId !== null)
          .map((b)   => b.taskId)
      );

      const hasActionable = this.blackboard.getBacklog().some((t) =>
        this._taskSprint.get(t.id) === sprint &&
        (t.status === 'PLANNED' || t.status === 'IN_PROGRESS') &&
        this.blackboard.getDependenciesMet(t.id) &&
        !activeBlockerIds.has(t.id)
      );

      return hasActionable ? null : 'NO_ACTIONABLE_TASKS';
    }

    if (phaseName === 'REVIEW') {
      const hasInReview = this.blackboard.getBacklog().some(
        (t) => this._taskSprint.get(t.id) === sprint && t.status === 'IN_REVIEW'
      );
      return hasInReview ? null : 'REVIEW_COMPLETE';
    }

    return null;
  }

  /**
   * Distribui uma mensagem para a memória de todos os agentes, exceto o emissor.
   * Implementa Opção B do DEC-001: broadcast global com campo `to` preservado.
   * @private
   */
  _distributeToMemory(msg, fromAgentId) {
    for (const [agentId, agent] of this.agents) {
      if (agentId !== fromAgentId) {
        agent.addToMemory({
          from:    fromAgentId,
          to:      msg.to,
          type:    msg.type,
          content: msg.content,
        });
      }
    }
  }
}
