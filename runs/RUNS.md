# Registro de Execuções — biblio-sim

Este documento cataloga todas as execuções da simulação multi-agente do projeto **BiblioPessoal**, classificadas por fase de desenvolvimento do simulador.

---

## Visão Geral

| Categoria | Quantidade | Período |
|-----------|-----------|---------|
| Mockadas (modo fixture) | 31 | Mai/2026 |
| Reais — Sprint 1 (validação inicial) | 15 | Jun/2026 |
| Completas e bem-sucedidas (5 sprints reais) | 3 | Jun/2026 |
| Parciais / Interrompidas | 1 | Jun/2026 |
| Total | **50** | Mai–Jun/2026 |

---

## Categoria 1 — Execuções Mockadas

Execuções com modo `mock`: o orquestrador substituía chamadas reais à API por respostas pré-fixadas (_fixtures_). Usadas para validar a estrutura do blackboard, o fluxo de fases (PLANNING → EXECUTION → REVIEW → RETRO) e o log de eventos sem custo de LLM.

### Protótipos pré-instrumentação (estrutura divergente)

Runs muito iniciais, anteriores ao formato padronizado de `.jsonl`. Possuem arquivos como `blackboard-demo.json` ou `blackboard-final.json` em vez do padrão de eventos.

| Run | Arquivos | Observação |
|-----|----------|------------|
| `run-2026-05-21T22-30-03` | `blackboard-final.json`, `sprint-1.jsonl` | Primeiro protótipo — formato misto |
| `run-2026-05-21T22-42-43` | `events.jsonl`, `blackboard-demo.json` | Introdução do `events.jsonl` |
| `run-2026-05-22T15-48-12` | `blackboard-demo.json`, `sprint-1.jsonl` | Transição de formato |
| `run-2026-05-22T15-54-27` | `blackboard-demo.json`, `sprint-1.jsonl` | Transição de formato |
| `run-2026-05-22T16-02-43` | `blackboard-demo.json`, `sprint-1.jsonl` | Transição de formato |

### Execuções mock — Sprint 1 apenas

Runs no formato padronizado com `sprint-1.jsonl`, modo `mock`.

| Run | Sprints | Observação |
|-----|---------|------------|
| `run-2026-05-22T13-19-22` | 1 | Primeiro run mock instrumentado |
| `run-2026-05-22T13-33-33` | 1 | — |
| `run-2026-05-22T14-12-17` | 1 | — |
| `run-2026-05-22T15-40-03` | 1 | — |
| `run-2026-05-22T16-22-05` | 1 | — |
| `run-2026-05-22T16-23-36` | 1 | — |
| `run-2026-05-25T14-02-22` | 1 | — |
| `run-2026-05-25T14-17-00` | 1 | — |
| `run-2026-05-25T17-12-00` | 1 | — |
| `run-2026-05-25T17-13-36` | 1 | — |
| `run-2026-05-25T17-20-31` | 1 | — |
| `run-2026-05-26T15-25-37` | 2 | Primeiro mock com Sprint 2 |
| `run-2026-05-26T16-20-56` | 1 | — |
| `run-2026-05-26T16-21-05` | 1 | — |
| `run-2026-05-30T15-22-46` | 1 | — |
| `run-2026-05-30T15-22-53` | 1 | — |
| `run-2026-05-30T15-36-31` | 1 | — |
| `run-2026-05-30T15-48-59` | 1 | — |
| `run-2026-05-30T20-12-18` | 1 | — |
| `run-2026-05-30T20-26-13` | 1 | — |
| `run-2026-05-30T20-26-22` | 1 | — |
| `run-2026-06-03T15-59-32` | 1 | Último run mock antes de ativar modo real |

### Execuções mock — 5 sprints completos (validação end-to-end mock)

Antes de ativar chamadas reais à API, o ciclo completo de 5 sprints foi validado no modo fixture. Cada run tem 15 ações de agente (3 por sprint em modo acelerado).

| Run | Sprints | Agent Acts | LLM Calls | Resultado |
|-----|---------|-----------|-----------|-----------|
| `run-2026-05-30T20-11-15` | 5 | 15 | 15 | ✅ 5 sprints completos (mock) |
| `run-2026-05-30T20-15-25` | 5 | 15 | 15 | ✅ 5 sprints completos (mock) |

---

## Categoria 2 — Execuções Reais — Sprint 1

Execuções com modo `real`: chamadas à API Claude enviadas de fato. Estas runs marcam a transição do protótipo para o sistema em produção. Focadas em validar o comportamento dos agentes (PM, Dev1, Dev2, QA) com respostas genuínas do LLM durante a Sprint 1.

### Primeiros runs reais (Jun 2026 — semana 1)

| Run | Sprints | Observação |
|-----|---------|------------|
| `run-2026-06-03T16-11-57` | 1 | Primeiro run real — comportamento inicial do PM |
| `run-2026-06-03T16-33-39` | 1 | — |
| `run-2026-06-03T16-59-42` | 1 | — |
| `run-2026-06-04T00-59-14` | 1 | — |
| `run-2026-06-04T01-27-17` | 1 | — |
| `run-2026-06-04T01-44-40` | 1 | — |
| `run-2026-06-04T11-28-21` | 1 | — |

### Runs reais de calibração (Jun 2026 — semana 2)

Ajustes no sistema de memória dos agentes e nas personas para reduzir loops e blockers não resolvidos.

| Run | Sprints | Observação |
|-----|---------|------------|
| `run-2026-06-15T13-23-58` | 1 | — |
| `run-2026-06-15T13-25-18` | 1 | — |
| `run-2026-06-15T13-38-59` | 1 | — |
| `run-2026-06-15T14-02-55` | 1 | — |
| `run-2026-06-15T14-08-59` | 1 | — |
| `run-2026-06-15T14-19-32` | 1 | — |
| `sprint1-completo-backup`  | 1 | Backup de execução com Sprint 1 bem-sucedida (referência) |

### Runs com progresso parcial (3 sprints)

Runs que avançaram além da Sprint 1 mas foram interrompidos antes de completar as 5 sprints. Serviram para identificar bugs no orchestrador multi-sprint.

| Run | Sprints | Observação |
|-----|---------|------------|
| `run-2026-06-16T21-28-22` | 3 | Avançou até Sprint 3 — interrompido |
| `run-2026-06-16T22-09-37` | 3 | Avançou até Sprint 3 — interrompido |

---

## Categoria 3 — Execuções Completas e Bem-Sucedidas

Execuções reais que percorreram todos os 5 sprints com o time de agentes completo (Helena/PM, Bruno/Dev1, Carla/Dev2, Diego/QA). Cada sprint contém as fases PLANNING → EXECUTION → REVIEW → RETRO com chamadas reais à API.

| Run | Agent Acts | LLM Calls | Status |
|-----|-----------|-----------|--------|
| `run-2026-06-16T23-00-46` | 99 | 108 | ✅ **Primeira execução completa real** |
| `run-2026-06-17T13-27-56` | 4 | 5 | ⚠️ Arquivos de 5 sprints gerados, mas interrompido na Sprint 1 |
| `run-2026-06-17T13-50-28` | 0 | 0 | ❌ Crash imediato após inicialização |
| `run-2026-06-18T16-25-22` | 141 | 141 | ✅ **Execução completa com maior cobertura de agentes** |

### Execução parcial — interrompida no Sprint 2

| Run | Sprints | Agent Acts | Causa |
|-----|---------|-----------|-------|
| `run-2026-06-18T15-17-27` | 2 | 88 | Interrompida durante Sprint 2 / EXECUTION — turno 12 (blocker não resolvido em T2.1) |

---

## Evolução do Sistema

```
Mai/2026        Jun/03      Jun/15      Jun/16      Jun/17-18
    │               │           │           │           │
Protótipos     Primeiros   Calibração  3 sprints   5 sprints
  mock          runs        de persona   real       completos
(fixtures)      reais       (Sprint 1)  parcial      ✅ ✅
```

As execuções demonstram a evolução do simulador desde protótipos com respostas fixas até simulações completas com agentes autônomos interagindo via LLM real ao longo de 5 sprints ágeis.
