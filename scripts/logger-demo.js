/**
 * logger-demo.js
 *
 * Demonstração do Logger: simula o início de um Planning da Sprint 1,
 * com mensagens entre pm/dev1/dev2 e uma decisão final do PM.
 *
 * Gera exatamente 6 linhas em sprint-1.jsonl:
 *   1. SPRINT_START
 *   2. PHASE_START
 *   3. MESSAGE (pm → all)
 *   4. MESSAGE (dev1 → pm)
 *   5. MESSAGE (dev2 → pm)
 *   6. DECISION (pm)
 *
 * Execute com: npm run logger:demo
 */

import { Logger } from '../src/logging/Logger.js';

const logger = new Logger();

console.log('\n[demo] BiblioSim — demonstração do Logger');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}\n`);

// ── Sprint 1: Planning ────────────────────────────────────────────────────────

logger.setSprint(1);
logger.setPhase('PLANNING');

// Turno 1 — PM abre o planning e pede estimativa para T1
logger.nextTurn();
logger.log(
  'MESSAGE',
  {
    to:      'all',
    type:    'ASK_ESTIMATE',
    content: 'Pessoal, começando o Planning da Sprint 1. T1 é nossa fundação. Bruno, qual sua estimativa?',
    refs:    ['T1'],
  },
  { actor: 'pm' }
);

// Turno 2 — Dev Sênior (Bruno) responde com estimativa conservadora
logger.nextTurn();
logger.log(
  'MESSAGE',
  {
    to:      'pm',
    type:    'ESTIMATE',
    content: 'Estimo 5 dias para T1. Precisamos de uma arquitetura sólida antes de qualquer outra coisa.',
    refs:    ['T1'],
  },
  { actor: 'dev1' }
);

// Turno 3 — Dev Pleno (Carla) discorda e oferece estimativa mais otimista
logger.nextTurn();
logger.log(
  'MESSAGE',
  {
    to:      'pm',
    type:    'ESTIMATE',
    content: 'Discordo do Bruno. 3 dias são suficientes para T1. Podemos refinar na próxima sprint.',
    refs:    ['T1'],
  },
  { actor: 'dev2' }
);

// Ainda no turno 3 — PM medeia e registra decisão
logger.log(
  'DECISION',
  {
    subject:    'Estimativa de T1',
    resolution: 'Fechado em 4 dias — compromisso entre as estimativas de Bruno e Carla.',
    refs:       ['T1'],
  },
  { actor: 'pm' }
);

// ── Snapshot do estado do Blackboard ─────────────────────────────────────────

logger.saveSnapshot('blackboard-final.json', {
  generatedAt: new Date().toISOString(),
  sprint:      1,
  backlog: [
    { id: 'T1', title: 'Cadastro e listagem de livros',      status: 'planned',  estimate: 4,    deps: [] },
    { id: 'T2', title: 'Integração com API de metadados',    status: 'backlog',  estimate: null, deps: ['T1'] },
    { id: 'T3', title: 'Empréstimo a amigos',                status: 'backlog',  estimate: null, deps: ['T1'] },
    { id: 'T4', title: 'Sistema de recomendações',           status: 'backlog',  estimate: null, deps: ['T1'] },
    { id: 'T5', title: 'Relatório mensal',                   status: 'backlog',  estimate: null, deps: ['T1', 'T3'] },
  ],
  decisions: [
    {
      turn:       3,
      actor:      'pm',
      subject:    'Estimativa de T1',
      resolution: 'Fechado em 4 dias',
    },
  ],
  blockers:  [],
  carryOver: [],
});

console.log(`\n[demo] Concluída. Verifique os arquivos em: ${logger.getRunDir()}`);
