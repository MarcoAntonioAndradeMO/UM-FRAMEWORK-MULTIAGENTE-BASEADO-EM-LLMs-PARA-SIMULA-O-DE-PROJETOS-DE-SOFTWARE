/**
 * llm-demo.js
 *
 * Demonstra o LLMClient em modo mock, sem nenhuma chamada à API.
 * Cobre 4 cenários: resposta válida, JSON embrulhado em markdown,
 * falha com retry bem-sucedido e falha de schema sem recuperação.
 *
 * Execute com: npm run llm:demo
 */

import { Logger }     from '../src/logging/Logger.js';
import { LLMClient }  from '../src/llm/client.js';
import { FIXTURES }   from '../src/llm/mockResponses.js';

// Parâmetros fictícios de chamada — mesmos que o Orchestrator usará
const DUMMY_PARAMS = {
  system:   'Você é um agente de uma equipe ágil. Responda sempre em JSON.',
  messages: [{ role: 'user', content: 'É o seu turno. Responda conforme o protocolo.' }],
};

const logger = new Logger();

console.log('\n[demo] BiblioSim — demonstração do LLM Client (modo mock)');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}`);
console.log('─'.repeat(65));

// ── Cenário 1: fixture válida, uma chamada, sucesso direto ────────────────────
console.log('\n▶ Cenário 1: resposta válida com 2 mensagens (deve passar na 1ª tentativa)');

const client1 = new LLMClient({
  mode:         'mock',
  logger,
  mockFixtures: [FIXTURES.pm_planning_open],
});

const r1 = await client1.completeStructured(DUMMY_PARAMS);

if (r1.ok) {
  console.log(`  ✓ OK na tentativa 1 — ${r1.value.messages.length} mensagem(ns)`);
  console.log(`  thoughts: "${r1.value.thoughts.slice(0, 60)}..."`);
  r1.value.messages.forEach((m, i) =>
    console.log(`  mensagem ${i + 1}: ${m.type} → ${m.to}`)
  );
} else {
  console.log(`  ✗ FAIL — ${r1.error}`);
}

// ── Cenário 2: JSON embrulhado em markdown — parse tolerante recupera ─────────
console.log('\n▶ Cenário 2: JSON embrulhado em markdown (parse tolerante deve recuperar)');

const client2 = new LLMClient({
  mode:         'mock',
  logger,
  mockFixtures: [FIXTURES.markdown_wrapped],
});

const r2 = await client2.completeStructured(DUMMY_PARAMS);

if (r2.ok) {
  console.log(`  ✓ OK — parse extraiu JSON do markdown com sucesso`);
  console.log(`  tipo da mensagem: ${r2.value.messages[0].type} → ${r2.value.messages[0].to}`);
} else {
  console.log(`  ✗ FAIL — ${r2.error}`);
}

// ── Cenário 3: JSON malformado → retry com fixture válida ─────────────────────
// Tentativa 1 recebe malformed_json  → falha na extração
// Tentativa 2 recebe dev1_estimate   → sucesso
console.log('\n▶ Cenário 3: JSON malformado → retry com fixture válida (deve recuperar na 2ª tentativa)');

const client3 = new LLMClient({
  mode:         'mock',
  logger,
  mockFixtures: [FIXTURES.malformed_json, FIXTURES.dev1_estimate],
});

const r3 = await client3.completeStructured({ ...DUMMY_PARAMS, maxRetries: 2 });

if (r3.ok) {
  console.log(`  ✓ Recuperado com sucesso`);
  console.log(`  tipo: ${r3.value.messages[0].type} | conteúdo: "${r3.value.messages[0].content.slice(0, 50)}..."`);
} else {
  console.log(`  ✗ FAIL após ${r3.attempts} tentativas — ${r3.error}`);
}

// ── Cenário 4: schema inválido, sem recuperação possível ──────────────────────
// Todas as tentativas recebem a mesma fixture com type "URGENT_PING" (fora do enum)
console.log('\n▶ Cenário 4: tipo de mensagem inválido "URGENT_PING" — deve esgotar todas as tentativas');

const client4 = new LLMClient({
  mode:         'mock',
  logger,
  mockFixtures: [FIXTURES.invalid_schema],   // cicla na mesma fixture inválida
});

const r4 = await client4.completeStructured({ ...DUMMY_PARAMS, maxRetries: 2 });

if (r4.ok) {
  console.log(`  ✓ OK (inesperado)`);
} else {
  console.log(`  ✗ Esgotado após ${r4.attempts} tentativa(s) — esperado`);
  console.log(`  último erro: ${r4.error}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(65));
console.log(`[demo] Concluída. Verifique: ${logger.getRunDir()}/events.jsonl`);
