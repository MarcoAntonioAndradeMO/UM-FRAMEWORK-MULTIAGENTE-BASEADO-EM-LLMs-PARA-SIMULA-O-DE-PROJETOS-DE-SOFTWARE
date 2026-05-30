/**
 * blackboard-demo.js
 *
 * Demonstra o Blackboard manipulando estado de uma mini-sprint offline.
 * Sem LLM, sem mocks de rede — apenas estrutura de dados e Logger.
 *
 * Execute com: npm run blackboard:demo
 */

import { Logger }               from '../src/logging/Logger.js';
import { Blackboard, TaskStatus } from '../src/core/Blackboard.js';
import { BACKLOG }               from '../src/config/backlog.js';

// ── Infraestrutura ────────────────────────────────────────────────────────────

const logger = new Logger();
const bb = new Blackboard({ backlog: BACKLOG, logger });

console.log('\n[demo] BiblioSim — demonstração do Blackboard');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}`);
console.log('─'.repeat(65));

// ── 1. Backlog inicial ────────────────────────────────────────────────────────

console.log(`\n▶ Backlog inicial: ${bb.getBacklog().length} tarefas`);
bb.getBacklog().forEach((t) => {
  const deps = t.dependsOn.length ? ` (depende de: ${t.dependsOn.join(', ')})` : '';
  console.log(`  ${t.id}: ${t.title}${deps}`);
});

// ── 2. Iniciar sprint 1 ───────────────────────────────────────────────────────

// Logger roteará eventos para sprint-1.jsonl a partir daqui
logger.setSprint(1);
bb.startSprint(1);
console.log('\n▶ Sprint 1 iniciada');

// ── 3. Estimativas de T1 (dev1 e dev2 discordam) ─────────────────────────────

bb.setEstimate('T1', 5, 'dev1');
console.log('\n▶ Estimativas para T1');
console.log('  dev1 (Bruno): 5 dias');

bb.setEstimate('T1', 3, 'dev2');
console.log('  dev2 (Carla): 3 dias');

// ── 4. PM registra decisão e fecha estimativa ─────────────────────────────────

const decId = bb.addDecision({
  by:      'pm',
  content: 'Estimativa de T1 fechada em 4 dias — compromisso entre Bruno (5d) e Carla (3d). Bruno lidera.',
  refs:    ['T1'],
});
bb.setEstimate('T1', 4, 'pm');
console.log(`\n▶ Decisão registrada (${decId})`);
console.log('  Estimativa final de T1: 4 dias (decidida pela PM)');

// Evidencia que o histórico de estimativas preserva todas as entradas
console.log('\n▶ Histórico completo de estimativas de T1 (estimates[]):');
bb.getTask('T1').estimates.forEach((e) =>
  console.log(`  by=${e.by.padEnd(5)} value=${e.value} sprint=${e.sprint}  ts=${e.ts}`)
);

// ── 5. Atribuir e iniciar T1 ──────────────────────────────────────────────────

bb.assignTask('T1', 'dev1');
bb.setStatus('T1', TaskStatus.IN_PROGRESS, 'dev1');
console.log('\n▶ T1 atribuída a dev1 → IN_PROGRESS');
console.log(`  sprintIntroduced: ${bb.getTask('T1').sprintIntroduced}`);

// ── 6. Blocker em T1: abrir e resolver ───────────────────────────────────────

const blockerId = bb.addBlocker({
  by:      'dev1',
  taskId:  'T1',
  content: 'Ambiente de banco de dados local não está acessível. Bloqueio temporário.',
});
console.log(`\n▶ Blocker aberto: ${blockerId}`);
console.log(`  Blockers ativos: ${bb.getActiveBlockers().length}`);

bb.resolveBlocker(blockerId, 'pm');
console.log(`\n▶ Blocker ${blockerId} resolvido pela PM`);
console.log(`  Blockers ativos: ${bb.getActiveBlockers().length}`);

// ── 7. T1: IN_REVIEW → DONE + verificação de dependências ────────────────────

console.log('\n▶ Verificando dependências de T2 antes de T1 estar DONE:');
console.log(`  getDependenciesMet('T2') = ${bb.getDependenciesMet('T2')}`);

bb.setStatus('T1', TaskStatus.IN_REVIEW, 'dev1');
bb.setStatus('T1', TaskStatus.DONE, 'qa');
console.log('\n▶ T1: IN_REVIEW → DONE (aprovada pelo Diego)');

console.log('\n▶ Verificando dependências de T2 após T1 estar DONE:');
console.log(`  getDependenciesMet('T2') = ${bb.getDependenciesMet('T2')}`);

// ── 8. T2 e T3 ficam sem concluir (simulado: não fazemos nada com elas) ───────
console.log('\n▶ T2, T3, T4, T5 não foram iniciadas nesta sprint.');

// ── 9. Transição inválida proposital ─────────────────────────────────────────

console.log('\n▶ Tentando transição inválida: DONE → IN_PROGRESS em T1...');
try {
  bb.setStatus('T1', TaskStatus.IN_PROGRESS, 'dev1');
  console.log('  (inesperado: não deveria chegar aqui)');
} catch (err) {
  console.log(`  ✓ Barrada corretamente: ${err.message}`);
}

// ── 10. Fechar sprint e calcular carry-over ───────────────────────────────────

const summary = bb.closeSprintAndCarryOver();
console.log('\n▶ Sprint 1 fechada — resumo de carry-over:');
console.log(`  done:        [${summary.done.join(', ')}]`);
console.log(`  carriedOver: [${summary.carriedOver.join(', ')}]`);
console.log(`  rejected:    [${summary.rejected.join(', ') || '—'}]`);

// ── 11. Snapshot final ────────────────────────────────────────────────────────

logger.saveSnapshot('blackboard-demo.json', bb.getSnapshot());

console.log(`\n[demo] Concluída. Verifique: ${logger.getRunDir()}/`);
console.log(`  - sprint-1.jsonl  (eventos BB_*)`);
console.log(`  - blackboard-demo.json  (snapshot final)`);
