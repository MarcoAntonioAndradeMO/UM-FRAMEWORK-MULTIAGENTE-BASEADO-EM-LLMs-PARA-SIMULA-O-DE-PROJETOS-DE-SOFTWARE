/**
 * orchestrator-demo.js
 *
 * Demonstra o Orchestrator conduzindo PLANNING e EXECUTION na Sprint 1
 * com os 4 agentes (Helena, Bruno, Carla, Diego) em modo mock.
 *
 * Sequência de fixtures — PLANNING (5):
 *   1. pm_planning_open  → PM abre o planning, atribui T1.1 e pede estimativas
 *   2. dev1_planning     → Bruno responde com estimativa conservadora (CHAT)
 *   3. dev2_planning     → Carla responde com estimativa otimista (CHAT)
 *   4. qa_planning       → Diego levanta pontos de qualidade (REQUEST_CLARIFICATION)
 *   5. pm_decision       → PM media e emite DECISION → para a fase
 *
 * Sequência de fixtures — EXECUTION (4):
 *   6. pm_execution_open → PM inicia execução, endereça 'all'
 *   7. dev1_execution    → Bruno: CLAIM_TASK T1.1 + REVIEW_REQUEST → IN_PROGRESS → IN_REVIEW
 *   8. dev2_execution    → Carla: RAISE_BLOCKER T1.2 (ambiente)
 *   9. qa_execution      → Diego: CHAT confirmando revisão pendente
 *   → T1.1 em IN_REVIEW; T1.2/T1.3/T1.4 têm dep não satisfeita → NO_ACTIONABLE_TASKS
 *
 * Execute com: npm run orchestrator:demo
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger }            from '../src/logging/Logger.js';
import { LLMClient }         from '../src/llm/client.js';
import { Agent }             from '../src/agents/Agent.js';
import { Blackboard }        from '../src/core/Blackboard.js';
import { Orchestrator }      from '../src/core/Orchestrator.js';
import { BACKLOG }           from '../src/config/backlog.js';
import { SIMULATION_CONFIG } from '../src/config/simulation.js';
import { FIXTURES }          from '../src/llm/mockResponses.js';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const PERSONAS_DIR = path.join(PROJECT_ROOT, 'src/agents/personas');

// ── Infraestrutura ────────────────────────────────────────────────────────────

const logger = new Logger();

// Cliente mock compartilhado — fixtures consumidas em ordem por qualquer agente.
// model e temperature são passados explicitamente para que LLM_CALL os registre
// mesmo em mock, e para que a troca para modo real não exija mudança neste bloco.
const client = new LLMClient({
  mode:        'mock',
  model:       SIMULATION_CONFIG.llm.model,
  logger,
  mockFixtures: [
    // ── PLANNING ──────────────────────────────────────
    FIXTURES.pm_planning_open,   // turno 1 PM
    FIXTURES.dev1_planning,      // turno 1 dev1
    FIXTURES.dev2_planning,      // turno 1 dev2
    FIXTURES.qa_planning,        // turno 1 qa
    FIXTURES.pm_decision,        // turno 2 PM → DECISION → para
    // ── EXECUTION ─────────────────────────────────────
    FIXTURES.pm_execution_open,  // turno 1 PM  (endereça 'all')
    FIXTURES.dev1_execution,     // turno 1 dev1 → CLAIM_TASK + REVIEW_REQUEST
    FIXTURES.dev2_execution,     // turno 1 dev2 → RAISE_BLOCKER
    FIXTURES.qa_execution,       // turno 1 qa  → CHAT aguardando revisão
    // → NO_ACTIONABLE_TASKS (T1.1 in IN_REVIEW, demais aguardam dep)
    // ── REVIEW ────────────────────────────────────────
    FIXTURES.pm_review_open,     // turno 1 PM  (endereça qa)
    FIXTURES.qa_review_first,    // turno 1 qa  → APPROVE T1.1, REJECT T1.3
    FIXTURES.pm_review_followup, // turno 2 PM  (endereça dev1)
    FIXTURES.dev1_resubmit,      // turno 2 dev1 → REVIEW_REQUEST T1.3
    FIXTURES.pm_review_close,    // turno 3 PM  (endereça qa)
    FIXTURES.qa_review_second,   // turno 3 qa  → APPROVE T1.3 → REVIEW_COMPLETE
  ],
});

const blackboard = new Blackboard({ backlog: BACKLOG, logger });

// ── Criação dos agentes ───────────────────────────────────────────────────────

const AGENT_SPECS = [
  { id: 'pm',   name: 'Helena', role: 'Project Manager',      personaFile: 'pm.md'   },
  { id: 'dev1', name: 'Bruno',  role: 'Desenvolvedor Sênior', personaFile: 'dev1.md' },
  { id: 'dev2', name: 'Carla',  role: 'Desenvolvedora Pleno', personaFile: 'dev2.md' },
  { id: 'qa',   name: 'Diego',  role: 'Quality Assurance',    personaFile: 'qa.md'   },
];

const agents = new Map(
  AGENT_SPECS.map(({ id, name, role, personaFile }) => [
    id,
    new Agent({
      id,
      name,
      role,
      personaPath: path.join(PERSONAS_DIR, personaFile),
      llmClient:   client,
      logger,
    }),
  ])
);

const orchestrator = new Orchestrator({
  agents,
  blackboard,
  logger,
  config:  SIMULATION_CONFIG,
  backlog: BACKLOG,           // necessário para _shouldStopPhase filtrar por sprint
});

// ── Execução — PLANNING ───────────────────────────────────────────────────────

console.log('\n[demo] BiblioSim — Orchestrator | PLANNING + EXECUTION | 4 agentes (mock)');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}`);
console.log('─'.repeat(65));

logger.setSprint(1);
blackboard.startSprint(1);

console.log('\n▶ Sprint 1 iniciada — executando fase PLANNING...\n');

const planningSummary = await orchestrator.runPhase('PLANNING', { sprint: 1 });

console.log('\n' + '─'.repeat(65));
console.log('▶ Resumo do PLANNING:');
console.log(`  phase:   ${planningSummary.phase}`);
console.log(`  sprint:  ${planningSummary.sprint}`);
console.log(`  turns:   ${planningSummary.turns}  (turnos da PM)`);
console.log(`  stopped: ${planningSummary.stopped}`);

const snapPlanning = blackboard.getSnapshot();
console.log(`\n▶ Decisões registradas: ${snapPlanning.decisions.length}`);
snapPlanning.decisions.forEach((d) =>
  console.log(`  ${d.id} [${d.by}]: "${d.content.slice(0, 72)}..."`)
);

const assigned = snapPlanning.tasks.filter((t) => t.assignee !== null);
console.log(`\n▶ Tarefas atribuídas após PLANNING: ${assigned.length}`);
assigned.forEach((t) => console.log(`  ${t.id} → ${t.assignee}`));

// ── Execução — EXECUTION ──────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(65));
console.log('\n▶ Sprint 1 — executando fase EXECUTION...\n');

const execSummary = await orchestrator.runPhase('EXECUTION', { sprint: 1 });

console.log('\n' + '─'.repeat(65));
console.log('▶ Resumo da EXECUTION:');
console.log(`  phase:   ${execSummary.phase}`);
console.log(`  sprint:  ${execSummary.sprint}`);
console.log(`  turns:   ${execSummary.turns}  (turnos da PM)`);
console.log(`  stopped: ${execSummary.stopped}`);

const snapExec = blackboard.getSnapshot();

// Tarefas com histórico de transições de estado
const comHistorico = snapExec.tasks.filter((t) => t.history.length > 0);
console.log(`\n▶ Tarefas com histórico de transições: ${comHistorico.length}`);
comHistorico.forEach((t) => {
  console.log(`  ${t.id} [status atual: ${t.status}]  assignee: ${t.assignee ?? '—'}`);
  t.history.forEach((h) =>
    console.log(`    ${h.from.padEnd(12)} → ${h.to.padEnd(12)}  by=${h.by ?? 'system'}`)
  );
});

// Blockers registrados
console.log(`\n▶ Blockers: ${snapExec.blockers.length}`);
snapExec.blockers.forEach((b) =>
  console.log(`  ${b.id} [task: ${b.taskId ?? 'geral'}]: "${b.content.slice(0, 65)}..."`)
);

// ── Pré-semeação para REVIEW ──────────────────────────────────────────────────
// Em uma simulação completa T1.3 chegaria a IN_REVIEW via mensagens de agente
// em EXECUTION. Aqui avançamos o estado diretamente para demonstrar o ciclo
// de rejeição (REJECT → correção → REVIEW_REQUEST → APPROVE) na fase REVIEW.
console.log('\n' + '─'.repeat(65));
console.log('\n▶ Pré-semeando T1.3 em IN_REVIEW para demo da fase REVIEW...\n');

blackboard.assignTask('T1.3', 'dev1');
blackboard.setStatus('T1.3', 'IN_PROGRESS', 'dev1');
blackboard.setStatus('T1.3', 'IN_REVIEW',   'dev1');

// ── Execução — REVIEW ─────────────────────────────────────────────────────────

console.log('\n▶ Sprint 1 — executando fase REVIEW...\n');

const reviewSummary = await orchestrator.runPhase('REVIEW', { sprint: 1 });

console.log('\n' + '─'.repeat(65));
console.log('▶ Resumo da REVIEW:');
console.log(`  phase:   ${reviewSummary.phase}`);
console.log(`  sprint:  ${reviewSummary.sprint}`);
console.log(`  turns:   ${reviewSummary.turns}  (turnos da PM)`);
console.log(`  stopped: ${reviewSummary.stopped}`);

const snapReview = blackboard.getSnapshot();

// Histórico de T1.1 e T1.3 — critério de pronto
const t11 = snapReview.tasks.find((t) => t.id === 'T1.1');
const t13 = snapReview.tasks.find((t) => t.id === 'T1.3');

console.log('\n▶ Histórico de T1.1 (deve chegar a DONE em uma passagem):');
t11?.history.forEach((h) =>
  console.log(`    ${h.from.padEnd(12)} → ${h.to.padEnd(12)}  by=${h.by ?? 'system'}`)
);

console.log('\n▶ Histórico de T1.3 (deve mostrar ciclo REJECT → correção → APPROVE):');
t13?.history.forEach((h) =>
  console.log(`    ${h.from.padEnd(12)} → ${h.to.padEnd(12)}  by=${h.by ?? 'system'}`)
);

// Snapshot final (estado pós-REVIEW)
logger.saveSnapshot('blackboard-final.json', snapReview);

console.log(`\n[demo] Concluída. Verifique: ${logger.getRunDir()}/`);
console.log('  - sprint-1.jsonl         (todos os eventos das três fases)');
console.log('  - blackboard-final.json  (estado final pós-REVIEW)');
