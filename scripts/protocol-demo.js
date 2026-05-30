/**
 * protocol-demo.js
 *
 * Demonstra o protocolo de mensagens: valida 5 cenários (2 válidos, 3 inválidos)
 * e registra os resultados no Logger.
 *
 * Como não há sprint ativa, o Logger roteia para events.jsonl.
 *
 * Execute com: npm run protocol:demo
 */

import { Logger } from '../src/logging/Logger.js';
import { parseAgentResponse } from '../src/protocol/schemas.js';

const logger = new Logger();

console.log('\n[demo] BiblioSim — demonstração do protocolo de mensagens');
console.log(`[demo] Diretório do run: ${logger.getRunDir()}\n`);
console.log('─'.repeat(60));

/**
 * Testa um cenário de validação, imprime o resultado e loga no Logger.
 * @param {string} descricao - O que está sendo testado
 * @param {string} rawJson   - String JSON a validar
 */
function testar(descricao, rawJson) {
  console.log(`\n▶ ${descricao}`);

  const resultado = parseAgentResponse(rawJson);

  if (resultado.ok) {
    const n = resultado.value.messages.length;
    console.log(`  ✓ OK — ${n} mensagem(ns) válida(s)`);
    logger.log('VALIDATION_OK', { descricao, messageCount: n });
  } else {
    console.log(`  ✗ FAIL — ${resultado.error}`);
    logger.log('VALIDATION_FAIL', { descricao, error: resultado.error });
  }
}

// ── Cenário 1: resposta válida com uma mensagem ───────────────────────────────
testar(
  'PM atribui T1 a dev1 — válido (1 mensagem)',
  JSON.stringify({
    thoughts: 'T1 é a base de tudo. Bruno tem experiência para liderar a modelagem.',
    messages: [
      {
        to:      'dev1',
        type:    'ASSIGN_TASK',
        content: 'Bruno, você é o responsável por T1 nesta sprint. Comece pela modelagem do banco de dados.',
        refs:    ['T1'],
      },
    ],
  })
);

// ── Cenário 2: resposta válida com duas mensagens ─────────────────────────────
testar(
  'PM pede estimativas a dev1 e dev2 — válido (2 mensagens)',
  JSON.stringify({
    thoughts: 'Preciso de estimativas dos dois antes de fechar o escopo. Cada um tem perspectivas diferentes.',
    messages: [
      {
        to:      'dev1',
        type:    'ASK_ESTIMATE',
        content: 'Bruno, quanto tempo você precisa para T1? Considere a modelagem e as APIs básicas.',
        refs:    ['T1'],
      },
      {
        to:      'dev2',
        type:    'ASK_ESTIMATE',
        content: 'Carla, qual a sua estimativa para T1? Quero comparar as perspectivas.',
        refs:    ['T1'],
      },
    ],
  })
);

// ── Cenário 3: destinatário inválido ─────────────────────────────────────────
// "dev3" não existe no enum Recipient — zod deve rejeitar
testar(
  'Mensagem para "dev3" inexistente — deve falhar',
  JSON.stringify({
    thoughts: 'Vou atribuir a tarefa ao dev3.',
    messages: [
      {
        to:      'dev3',        // inválido: não está em Recipient
        type:    'ASSIGN_TASK',
        content: 'Você cuida de T2.',
        refs:    ['T2'],
      },
    ],
  })
);

// ── Cenário 4: tipo de mensagem inválido ──────────────────────────────────────
// "YELL" não existe no enum MessageType — zod deve rejeitar
testar(
  'Tipo de mensagem "YELL" desconhecido — deve falhar',
  JSON.stringify({
    thoughts: 'Preciso chamar atenção de forma enérgica.',
    messages: [
      {
        to:      'dev1',
        type:    'YELL',        // inválido: não está em MessageType
        content: 'T1 precisa estar pronto amanhã!',
      },
    ],
  })
);

// ── Cenário 5: JSON sintaticamente inválido ───────────────────────────────────
// Falha antes mesmo de chegar ao zod — JSON.parse lança SyntaxError
testar(
  'JSON malformado (aspas faltando) — deve falhar antes da validação',
  '{ "thoughts": "tudo certo, "messages": [] }'  // SyntaxError: token inesperado
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`[demo] Concluída. Verifique: ${logger.getRunDir()}/events.jsonl`);
