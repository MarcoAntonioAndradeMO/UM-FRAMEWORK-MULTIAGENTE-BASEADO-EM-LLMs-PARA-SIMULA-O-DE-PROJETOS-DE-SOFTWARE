/**
 * schemas.js
 *
 * Define o protocolo de comunicação entre agentes do BiblioSim.
 * Todo output bruto do LLM deve passar por `parseAgentResponse` antes
 * de ser aceito no fluxo da simulação.
 *
 * Exportações públicas:
 *   - AgentId, Recipient, MessageType  → enums (schemas zod)
 *   - MessageSchema, AgentResponseSchema → schemas compostos
 *   - parseAgentResponse(rawJson)        → função utilitária
 */

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Identificadores válidos dos quatro agentes da equipe.
 */
export const AgentId = z.enum(['pm', 'dev1', 'dev2', 'qa']);

/**
 * Destinatários válidos de uma mensagem.
 * 'all' é broadcast — todos os agentes recebem.
 */
export const Recipient = z.enum(['pm', 'dev1', 'dev2', 'qa', 'all']);

/**
 * Tipos de mensagem do protocolo.
 * Cada tipo carrega uma semântica específica que orienta como os outros
 * agentes devem interpretar e responder à mensagem.
 */
export const MessageType = z.enum([
  'ASSIGN_TASK',           // PM → Dev: atribui uma tarefa
  'CLAIM_TASK',            // Dev → todos: assume uma tarefa e a inicia (PLANNED → IN_PROGRESS)
  'ASK_ESTIMATE',          // PM → Dev: solicita estimativa de esforço
  'ESTIMATE',              // Dev → PM: responde com estimativa
  'REPORT_PROGRESS',       // Dev → todos: relata progresso na Execution
  'RAISE_BLOCKER',         // Qualquer → todos: levanta um impedimento
  'REVIEW_REQUEST',        // Dev → QA: pede revisão de entrega
  'APPROVE',               // QA → Dev/PM: aprova entrega
  'REJECT',                // QA → Dev: rejeita entrega (com motivo em content)
  'REQUEST_CLARIFICATION', // Qualquer → qualquer: pede esclarecimento
  'MEDIATE',               // PM → Dev/QA: intervém em conflito
  'DECISION',              // PM → todos: registra decisão tomada
  'CHAT',                  // Qualquer → qualquer: comunicação livre
]);

// ─── Schemas compostos ────────────────────────────────────────────────────────

/**
 * Tipos que operam sobre uma tarefa específica e, portanto, exigem `refs`
 * com ao menos 1 elemento. Para todos os demais tipos `refs` é opcional:
 * um blocker ou progresso pode ser geral, sem tarefa específica.
 */
const TYPES_REQUIRING_REFS = new Set([
  'CLAIM_TASK',     // precisa indicar qual tarefa está sendo assumida
  'REVIEW_REQUEST', // precisa indicar qual entrega está sendo submetida
  'APPROVE',        // precisa indicar qual entrega foi aprovada
  'REJECT',         // precisa indicar qual entrega foi rejeitada
  'ESTIMATE',       // precisa indicar para qual tarefa é a estimativa
]);

/**
 * Uma mensagem individual dentro da resposta de um agente.
 * `refs` é opcional na base — o refinamento abaixo o torna obrigatório
 * (min 1) para os tipos em TYPES_REQUIRING_REFS.
 */
export const MessageSchema = z.object({
  to:      Recipient,
  type:    MessageType,
  content: z.string().min(1).max(2000),
  refs:    z.array(z.string()).optional(),
}).superRefine((msg, ctx) => {
  if (TYPES_REQUIRING_REFS.has(msg.type) && (!msg.refs || msg.refs.length === 0)) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ['refs'],
      message: `"${msg.type}" requer refs com ao menos 1 elemento`,
    });
  }
});

/**
 * Estrutura completa da resposta de um agente ao modelo.
 *
 * `thoughts` é o raciocínio interno — registrado em log mas não
 * compartilhado com outros agentes (simula pensamento privado).
 *
 * `messages` contém as ações visíveis do agente. Exigimos ao menos 1
 * mensagem: um agente que não produz nada é uma falha de geração.
 */
export const AgentResponseSchema = z.object({
  thoughts: z.string().min(1).max(6000),
  messages: z.array(MessageSchema).min(1).max(10),
});

// ─── Utilitária ───────────────────────────────────────────────────────────────

/**
 * Parseia e valida o output bruto de um agente LLM.
 *
 * Nunca lança exceção: retorna um tagged result para que o caller
 * decida como reagir a falhas (retry, log e continua, ou para tudo).
 *
 * @param {string} rawJson - String JSON retornada pelo modelo
 * @returns {{ ok: true, value: AgentResponse } | { ok: false, error: string }}
 */
export function parseAgentResponse(rawJson) {
  // Passo 1: tenta desserializar o JSON bruto — pode falhar se o modelo
  // produziu texto livre, markdown ou JSON truncado
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return { ok: false, error: `JSON malformado: ${err.message}` };
  }

  // Passo 2: valida a estrutura contra o schema
  // safeParse nunca lança — erros vêm no campo .error
  const result = AgentResponseSchema.safeParse(parsed);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  // Formata os erros do zod como "caminho: mensagem" separados por ponto-e-vírgula
  const issues = result.error.issues.map(
    (issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`
  );
  return { ok: false, error: issues.join('; ') };
}
