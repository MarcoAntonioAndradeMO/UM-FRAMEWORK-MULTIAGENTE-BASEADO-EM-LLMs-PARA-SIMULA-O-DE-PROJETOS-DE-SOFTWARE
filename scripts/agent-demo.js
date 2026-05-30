/**
 * agent-demo.js
 *
 * Demonstra a classe Agent com a persona da Helena (PM).
 * Sem nenhuma chamada real à API — modo mock via LLMClient.
 *
 * Execute com: npm run agent:demo
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger }    from '../src/logging/Logger.js';
import { LLMClient } from '../src/llm/client.js';
import { Agent }     from '../src/agents/Agent.js';
import { FIXTURES }  from '../src/llm/mockResponses.js';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

// ── Infraestrutura ────────────────────────────────────────────────────────────

const logger = new Logger();

// Duas fixtures: turno 1 → PM abre o planning; turno 2 → PM toma decisão
const client = new LLMClient({
  mode:         'mock',
  logger,
  mockFixtures: [FIXTURES.pm_planning_open, FIXTURES.pm_decision],
});

// ── Criação da Helena ─────────────────────────────────────────────────────────

const helena = new Agent({
  id:          'pm',
  name:        'Helena',
  role:        'Project Manager',
  personaPath: path.join(PROJECT_ROOT, 'src/agents/personas/pm.md'),
  llmClient:   client,
  logger,
});

console.log('\n[demo] BiblioSim — demonstração da classe Agent');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}`);
console.log('─'.repeat(65));
console.log(`\n[demo] Agente criada: ${helena.name} (${helena.role})`);
console.log(`[demo] Persona carregada: ${helena.systemPrompt.length} chars`);
console.log(`[demo] Memória inicial: ${helena.shortTermMemory.length} entrada(s)`);

// ── Turno 1: Helena abre o planning ──────────────────────────────────────────

console.log('\n' + '─'.repeat(65));
const situacao1 =
  'É o início do PLANNING da Sprint 1. Apresente o backlog à equipe ' +
  'e solicite as primeiras estimativas para T1, que é a tarefa base.';

console.log(`\n▶ Turno 1 — situação: "${situacao1.slice(0, 70)}..."`);
console.log(`  memória antes: ${helena.shortTermMemory.length} entrada(s)\n`);

const r1 = await helena.act(situacao1);

if (r1.ok) {
  console.log(`  ✓ Resposta válida`);
  console.log(`  thoughts: "${r1.value.thoughts.slice(0, 90)}..."`);
  console.log(`  mensagens emitidas:`);
  r1.value.messages.forEach((m, i) => {
    const preview = m.content.slice(0, 70);
    const refs    = m.refs?.length ? ` [${m.refs.join(', ')}]` : '';
    console.log(`    ${i + 1}. ${m.type} → ${m.to}${refs}: "${preview}..."`);
  });
  console.log(`  memória após turno 1: ${helena.shortTermMemory.length} entrada(s)`);
} else {
  console.log(`  ✗ FAIL: ${r1.error}`);
}

// ── Simula Bruno respondendo (Orchestrator fará isso na Etapa 7) ──────────────

console.log('\n[demo] Simulando resposta do Bruno chegando à memória da Helena...');
helena.addToMemory({
  from:    'dev1',
  type:    'ESTIMATE',
  content: 'Helena, minha estimativa para T1 é 5 dias. Preciso de tempo para a arquitetura correta.',
});

// ── Turno 2: Helena responde à estimativa do Bruno ────────────────────────────

const situacao2 =
  'Bruno acabou de dar sua estimativa: 5 dias para T1. ' +
  'Solicite a estimativa de Carla e registre sua decisão de escopo.';

console.log(`\n▶ Turno 2 — situação: "${situacao2.slice(0, 70)}..."`);
console.log(`  memória antes: ${helena.shortTermMemory.length} entrada(s)\n`);

const r2 = await helena.act(situacao2);

if (r2.ok) {
  console.log(`  ✓ Resposta válida`);
  console.log(`  thoughts: "${r2.value.thoughts.slice(0, 90)}..."`);
  console.log(`  mensagens emitidas:`);
  r2.value.messages.forEach((m, i) => {
    const preview = m.content.slice(0, 70);
    const refs    = m.refs?.length ? ` [${m.refs.join(', ')}]` : '';
    console.log(`    ${i + 1}. ${m.type} → ${m.to}${refs}: "${preview}..."`);
  });
  console.log(`  memória após turno 2: ${helena.shortTermMemory.length} entrada(s)`);
} else {
  console.log(`  ✗ FAIL: ${r2.error}`);
}

// ── Resumo da memória de curto prazo ─────────────────────────────────────────

console.log('\n' + '─'.repeat(65));
console.log(`[demo] Memória de curto prazo ao final: ${helena.shortTermMemory.length} entrada(s)`);
helena.shortTermMemory.forEach((e, i) =>
  console.log(`  [${i}] from=${e.from.padEnd(5)} type=${e.type}`)
);

console.log(`\n[demo] Concluída. Verifique: ${logger.getRunDir()}/events.jsonl`);
