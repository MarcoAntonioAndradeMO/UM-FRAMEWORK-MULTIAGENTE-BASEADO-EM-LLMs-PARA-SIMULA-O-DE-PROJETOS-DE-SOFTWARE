/**
 * run-simulation.js
 *
 * Script de produção: executa a simulação completa do BiblioSim
 * (SIMULATION_CONFIG.totalSprints × 3 fases: PLANNING, EXECUTION, REVIEW).
 *
 * Uso:
 *   node scripts/run-simulation.js           → mock (sem chamadas de API)
 *   MODE=real node scripts/run-simulation.js → real (requer ANTHROPIC_API_KEY)
 *
 * Em modo mock, maxTurnsPerPhase é reduzido para 1 turno por fase, garantindo
 * que todas as fases encerrem rapidamente sem travar. Os fixtures são circulares
 * e as fases param pelas condições de negócio (DECISION, NO_ACTIONABLE_TASKS,
 * REVIEW_COMPLETE) ou pelo teto MAX_TURNS.
 *
 * Em modo real, usa SIMULATION_CONFIG sem override e aplica o circuit breaker
 * para limitar o custo total do run.
 *
 * Nota: a fase RETRO não está incluída neste script (foco em PLANNING, EXECUTION
 * e REVIEW). Pode ser adicionada inserindo 'RETRO' no array PHASES abaixo.
 */

import path           from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger }            from '../src/logging/Logger.js';
import { LLMClient }         from '../src/llm/client.js';
import { Agent }             from '../src/agents/Agent.js';
import { Blackboard }        from '../src/core/Blackboard.js';
import { Orchestrator }      from '../src/core/Orchestrator.js';
import { BACKLOG }           from '../src/config/backlog.js';
import { SIMULATION_CONFIG } from '../src/config/simulation.js';
import { FIXTURES }          from '../src/llm/mockResponses.js';

// ── Configuração de execução ──────────────────────────────────────────────────

const MODE = process.env.MODE ?? 'mock';

if (MODE === 'real' && !process.env.ANTHROPIC_API_KEY) {
  console.error('[BiblioSim] ERRO: ANTHROPIC_API_KEY não definida.');
  console.error('[BiblioSim] Defina a variável ou use: node scripts/run-simulation.js (mock)');
  process.exit(1);
}

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERSONAS_DIR = path.join(PROJECT_ROOT, 'src/agents/personas');

// Fases executadas por sprint (RETRO pode ser adicionado aqui futuramente).
const PHASES = ['PLANNING', 'EXECUTION', 'REVIEW'];

// Em mock mode, reduz maxTurnsPerPhase a 1 por fase: as fases param pelas
// condições de negócio (DECISION, NO_ACTIONABLE_TASKS, REVIEW_COMPLETE) ou
// pelo teto MAX_TURNS antes de não-PM agirem — sem risco de loop longo.
// Em real mode, usa os limites configurados em SIMULATION_CONFIG.
const config = MODE === 'mock'
  ? {
      ...SIMULATION_CONFIG,
      maxTurnsPerPhase: { PLANNING: 1, EXECUTION: 1, REVIEW: 1, RETRO: 1 },
    }
  : SIMULATION_CONFIG;

// Sequência de fixtures para mock mode.
// Consumida apenas pelo PM (maxTurns=1 encerra antes dos não-PM agirem):
//   sprint N PLANNING  → PM recebe PM_DECISION      → DECISION stop
//   sprint N EXECUTION → PM recebe DEV1_EXECUTION   → CLAIM_TASK+REVIEW_REQUEST T1.1
//                        (sprint 1: NO_ACTIONABLE_TASKS; sprints 2+: MAX_TURNS)
//   sprint N REVIEW    → PM recebe QA_REVIEW_FIRST  → APPROVE T1.1 (sprint 1: DONE)
//                        (REVIEW_COMPLETE para todas as sprints)
const MOCK_FIXTURES = [
  FIXTURES.pm_decision,     // PLANNING: PM emite DECISION → para em 1 turno
  FIXTURES.dev1_execution,  // EXECUTION: PM emite CLAIM_TASK+REVIEW_REQUEST T1.1
  FIXTURES.qa_review_first, // REVIEW: PM emite APPROVE T1.1 + REJECT T1.3 (erro capturado)
];

// ── Infraestrutura ────────────────────────────────────────────────────────────

const logger = new Logger();

console.log(`\n${'═'.repeat(70)}`);
console.log('[BiblioSim] run-simulation');
console.log(`  mode:         ${MODE}`);
console.log(`  modelo:       ${SIMULATION_CONFIG.llm.model}`);
console.log(`  sprints:      ${SIMULATION_CONFIG.totalSprints}`);
console.log(`  maxTurns:     ${JSON.stringify(config.maxTurnsPerPhase)}`);
console.log(`  run dir:      ${logger.getRunDir()}`);
if (MODE === 'real') {
  console.log(`  circuit:      ${SIMULATION_CONFIG.maxCallsPerRun} chamadas máx`);
}
console.log('═'.repeat(70));

const client = new LLMClient({
  mode:  MODE,
  model: SIMULATION_CONFIG.llm.model,
  logger,
  // Circuit breaker apenas em real (sem custo no mock).
  ...(MODE === 'real' && { maxCallsPerRun: SIMULATION_CONFIG.maxCallsPerRun }),
  // Fixtures circulares apenas em mock.
  ...(MODE === 'mock' && { mockFixtures: MOCK_FIXTURES }),
});

const blackboard = new Blackboard({ backlog: BACKLOG, logger });

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
  config:  config,
  backlog: BACKLOG,
});

// ── Loop de sprints ───────────────────────────────────────────────────────────

const runSummary = [];

for (let sprint = 1; sprint <= SIMULATION_CONFIG.totalSprints; sprint++) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Sprint ${sprint} / ${SIMULATION_CONFIG.totalSprints}`);

  logger.setSprint(sprint);
  blackboard.startSprint(sprint);

  const sprintResult = {
    sprint,
    phases:       {},
    done:         [],
    carriedOver:  [],
    openBlockers: 0,
  };

  for (const phaseName of PHASES) {
    // ── Circuit breaker ──────────────────────────────────────────────────────
    if (client.isCircuitOpen()) {
      const snapshot = blackboard.getSnapshot();
      logger.log('RUN_ABORTED', {
        reason:     'RUN_CIRCUIT_BREAK',
        sprint,
        phase:      phaseName,
        totalCalls: client._totalCalls,
      });
      logger.saveSnapshot(`blackboard-sprint-${sprint}-partial.json`, snapshot);
      console.log(`\n[BiblioSim] ABORTADO — circuit breaker ativado antes de ${phaseName} (sprint ${sprint}).`);
      console.log(`[BiblioSim] Snapshot parcial → blackboard-sprint-${sprint}-partial.json`);
      printSummary(runSummary);
      process.exit(1);
    }

    // ── Execução da fase ─────────────────────────────────────────────────────
    const result = await orchestrator.runPhase(phaseName, { sprint });
    sprintResult.phases[phaseName] = result.stopped;
    console.log(`  ${phaseName.padEnd(10)} stopped=${result.stopped} (${result.turns} turno(s) PM)`);
  }

  // ── Fechar sprint e salvar snapshot ─────────────────────────────────────────
  const close = blackboard.closeSprintAndCarryOver();
  sprintResult.done         = close.done;
  sprintResult.carriedOver  = close.carriedOver;
  sprintResult.openBlockers = blackboard.getActiveBlockers().length;

  logger.saveSnapshot(`blackboard-sprint-${sprint}.json`, blackboard.getSnapshot());

  console.log(`  → DONE: ${close.done.length} | CARRIED_OVER: ${close.carriedOver.length} | blockers abertos: ${sprintResult.openBlockers}`);

  runSummary.push(sprintResult);
}

// ── Resumo final ──────────────────────────────────────────────────────────────

printSummary(runSummary);
console.log(`\n[BiblioSim] Run concluído. Verifique: ${logger.getRunDir()}/`);

/**
 * Imprime tabela de resumo por sprint.
 * @param {object[]} summary
 */
function printSummary(summary) {
  if (summary.length === 0) return;

  const PAD = { PLANNING: 20, EXECUTION: 22, REVIEW: 18 };

  console.log(`\n${'═'.repeat(70)}`);
  console.log('RESUMO DO RUN');
  console.log('═'.repeat(70));

  const header =
    'Sprint | ' +
    'PLANNING             | ' +
    'EXECUTION              | ' +
    'REVIEW             | ' +
    'DONE | CO | BLK';
  console.log(header);
  console.log('─'.repeat(header.length));

  for (const s of summary) {
    const p  = (s.phases.PLANNING  ?? '—').padEnd(20);
    const e  = (s.phases.EXECUTION ?? '—').padEnd(22);
    const r  = (s.phases.REVIEW    ?? '—').padEnd(18);
    const d  = String(s.done.length).padStart(4);
    const co = String(s.carriedOver.length).padStart(3);
    const b  = String(s.openBlockers).padStart(3);
    console.log(`     ${s.sprint} | ${p}| ${e}| ${r}| ${d} | ${co} | ${b}`);
  }
}
