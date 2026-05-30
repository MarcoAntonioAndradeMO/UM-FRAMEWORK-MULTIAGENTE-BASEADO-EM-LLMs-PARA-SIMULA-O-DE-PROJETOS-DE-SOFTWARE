/**
 * parse.js
 *
 * Extração tolerante de JSON a partir de texto bruto produzido por LLMs.
 *
 * LLMs frequentemente "embrulham" o JSON em texto explicativo ou cercas de
 * código markdown (```json ... ```). Esta função tenta três estratégias em
 * cascata antes de desistir, sem nunca lançar exceção.
 */

/**
 * Tenta extrair e parsear um objeto JSON de uma string de texto bruto.
 *
 * Estratégias (em ordem):
 *  1. JSON.parse direto — caso ideal, modelo respondeu JSON puro.
 *  2. Remoção de cercas markdown + parse — modelo usou ```json ... ```.
 *  3. Extração do primeiro bloco {...} balanceado — modelo misturou JSON
 *     com texto livre antes/depois.
 *
 * Nunca lança exceção.
 *
 * @param {string} rawText - Texto bruto retornado pelo modelo
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function extractJson(rawText) {
  // ── Passo 1: parse direto ─────────────────────────────────────────────────
  try {
    const value = JSON.parse(rawText);
    // Só aceitamos objetos — número ou string válidos em JSON não servem aqui
    if (value !== null && typeof value === 'object') {
      return { ok: true, value };
    }
  } catch (_) {}

  // ── Passo 2: limpar cercas de código markdown ─────────────────────────────
  // Remove a linha "```json" (ou "```") no início e "```" no fim, com
  // flag `m` para que ^ e $ correspondam a limites de linha.
  const cleaned = rawText
    .replace(/^```(?:json|JSON)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  try {
    const value = JSON.parse(cleaned);
    if (value !== null && typeof value === 'object') {
      return { ok: true, value };
    }
  } catch (_) {}

  // ── Passo 3: extrair primeiro bloco {...} balanceado ──────────────────────
  // Percorre o texto rastreando profundidade de chaves e estado de string
  // para encontrar o objeto JSON mais externo, mesmo com texto em volta.
  const start = cleaned.indexOf('{');
  if (start === -1) {
    return { ok: false, error: 'Nenhum objeto JSON encontrado no texto' };
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    // Caractere de escape dentro de string — ignora o próximo
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }

    // Delimitador de string — inverte o estado
    if (ch === '"') { inString = !inString; continue; }

    // Dentro de string, chaves não afetam a profundidade
    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Encontrou o fechamento do objeto mais externo
        const candidate = cleaned.slice(start, i + 1);
        try {
          return { ok: true, value: JSON.parse(candidate) };
        } catch (err) {
          return { ok: false, error: `Bloco JSON extraído mas inválido: ${err.message}` };
        }
      }
    }
  }

  return { ok: false, error: 'Bloco JSON não balanceado (objeto não foi fechado)' };
}
