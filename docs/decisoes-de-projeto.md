# Decisões de projeto — BiblioSim

Registro de decisões arquiteturais tomadas ou pendentes ao longo do
desenvolvimento. Formato: data · status · descrição · opções · resolução.

---

## DEC-001 · RESOLVIDA (2026-05-22) · Granularidade de roteamento da memória de curto prazo

**Resolvida na:** Etapa 7 (Orchestrator)
**Resolução:** Opção B — memória global da fase, com campo `to` preservado.
**Arquivo afetado:** `src/agents/Agent.js` — método `addToMemory`

### Contexto

O método `addToMemory` recebe entradas `{ from, type, content }` e as
empilha na `shortTermMemory` do agente. Na Etapa 7, o Orchestrator
passará a chamar `addToMemory` em cada agente para distribuir as
mensagens emitidas em cada turno. Nesse momento será preciso decidir
se o agente memoriza todas as mensagens ou apenas as endereçadas a ele.

### Opções

**Opção A — Memória filtrada por destinatário**
Cada agente memoriza apenas mensagens em que `to == seu id` ou `to == "all"`.
- ✅ Mais realista: pessoas não sabem de conversas privadas alheias.
- ✅ Economiza tokens de contexto em fases longas.
- ⚠️ Complica o Orchestrator: precisa filtrar antes de chamar `addToMemory`.
- ⚠️ Agentes podem perder contexto relevante emitido por terceiros.

**Opção B — Memória global da fase**
Cada agente memoriza tudo que acontece na fase, independente do destinatário.
- ✅ Simples de implementar no Orchestrator (broadcast sem filtragem).
- ✅ Agentes têm visão completa — útil para análise de coerência.
- ⚠️ Infla o contexto proporcionalmente ao número de turnos.
- ⚠️ Menos fiel a uma equipe real (ninguém ouve conversas privadas).

### Resolução aplicada

**Opção B adotada**, com ressalva: o campo `to` é obrigatório em cada
entrada de `shortTermMemory` (`{ from, to, type, content }`). Isso preserva
a informação de destinatário sem filtrar nada, mantendo a porta aberta para
migrar à Opção A na Etapa 9 sem reprocessar o histórico.

O `Orchestrator.runPhase()` distribui todas as mensagens a todos os agentes
(exceto ao próprio emissor, que já adicionou as mensagens em `act()`).
`Agent.buildContext()` formata o histórico com `[from→to]` para que o LLM
veja claramente quem falou com quem.

---
