/**
 * simulation.js
 *
 * Configuração central da simulação BiblioSim.
 * Apenas dado — nenhuma lógica aqui.
 *
 * maxTurnsPerPhase define o teto de segurança de cada fase; a simulação
 * pode terminar antes por condição de parada (ex: DECISION emitida).
 */

export const SIMULATION_CONFIG = Object.freeze({
  totalSprints: 5,

  // Circuit breaker: número máximo de chamadas de API por run completo.
  // Quando atingido, a chamada corrente falha com RUN_CIRCUIT_BREAK e o
  // Orchestrator encerra a fase via AGENT_FAILURES. null = sem limite.
  maxCallsPerRun: 200,

  maxTurnsPerPhase: Object.freeze({
    PLANNING:  15,
    EXECUTION: 25,
    REVIEW:    10,
    RETRO:      6,
  }),

  llm: Object.freeze({
    model:     'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 1024,
  }),
});
