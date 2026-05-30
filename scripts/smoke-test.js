/**
 * smoke-test.js
 *
 * Verifica se o ambiente está configurado e se a API da Anthropic responde.
 * Execute com: npm run smoke
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[smoke] ERRO: variável ANTHROPIC_API_KEY não definida.');
  console.error('[smoke] Copie .env.example para .env e preencha sua chave.');
  process.exit(1);
}

const client = new Anthropic();

console.log(`[smoke] usando modelo: ${MODEL}`);

const inicio = Date.now();

let resposta;
try {
  resposta = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    temperature: 0.2,
    system: 'Você é um assistente que responde sempre em português do Brasil, de forma direta.',
    messages: [
      { role: 'user', content: 'Diga em uma frase: você está funcionando?' }
    ],
  });
} catch (err) {
  // Erro de API (chave inválida, sem créditos, rede, etc.)
  console.error(`[smoke] ERRO ao chamar a API: ${err.message}`);
  process.exit(1);
}

const latencia = Date.now() - inicio;

console.log(`[smoke] latência: ${latencia}ms`);
console.log(`[smoke] stop_reason: ${resposta.stop_reason}`);
console.log(`[smoke] tokens in/out: ${resposta.usage.input_tokens}/${resposta.usage.output_tokens}`);
console.log(`[smoke] resposta:`);
console.log(resposta.content[0].text);
