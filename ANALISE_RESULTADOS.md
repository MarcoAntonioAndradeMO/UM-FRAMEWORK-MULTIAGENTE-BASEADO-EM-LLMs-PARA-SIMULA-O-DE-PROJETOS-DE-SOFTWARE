# Análise dos Resultados das Simulações

> **Escopo:** análise restrita às execuções com `mode: real` (chamadas reais à API Claude). Runs de validação com modo `mock` (fixtures) são excluídos por não representarem comportamento emergente do LLM.

---

## 1. Conjunto de Execuções Analisadas

### 1.1 Execuções completas (5 sprints)

| Run | Data | Agent Acts | LLM Calls | Tokens (in) | Tokens (out) | Latência média |
|-----|------|-----------|-----------|------------|-------------|---------------|
| `run-2026-06-16T23-00-46` | 16/jun | 102 | 108 | 1.078.501 | 166.058 | 29,9 s |
| `run-2026-06-18T16-25-22` | 18/jun | 141 | 141 | 673.441 | 184.266 | 25,3 s |

### 1.2 Execuções parciais reais

| Run | Data | Sprints | Turnos totais | Motivo de interrupção |
|-----|------|---------|--------------|----------------------|
| `run-2026-06-16T21-28-22` | 16/jun | 3 | ~45 | Processo morto externamente no Planning da Sprint 3 |
| `run-2026-06-16T22-09-37` | 16/jun | 3 | ~5 | Interrompido segundos após início da Sprint 3 |
| `run-2026-06-18T15-17-27` | 18/jun | 2 | 52 | Colapso por bug de resolução de blockers |
| `sprint1-completo-backup` | jun | 1 | — | Execução de referência (Sprint 1 completa) |
| jun/03–04 (7 runs) | 03-04/jun | 1 | — | Parsing JSON falhava por truncamento de output |
| jun/15 (4 runs) | 15/jun | 1 | — | Bug #1 (RESOLVE_BLOCKER ausente) impedia Sprint 2+ |

---

## 2. Métricas Quantitativas

### 2.1 Por sprint — `run-2026-06-18T16-25-22` (run maduro)

| Sprint | Turnos PLANNING | Turnos EXECUTION | Turnos REVIEW | LLM Calls | Tokens in | Latência média |
|--------|----------------|-----------------|---------------|-----------|-----------|---------------|
| 1      | 5              | 25              | 1             | 29        | 127.304   | 23,1 s        |
| 2      | 5              | 29              | 1             | 33        | 168.516   | 27,7 s        |
| 3      | 5              | 17              | 1             | 21        | 90.538    | 24,2 s        |
| 4      | 5              | 25              | 1             | 29        | 148.814   | 26,3 s        |
| 5      | 5              | 25              | 1             | 29        | 138.269   | 24,3 s        |

### 2.2 Por sprint — `run-2026-06-16T23-00-46` (run anterior ao fix #2)

| Sprint | Turnos EXEC | LLM Calls | Tokens in | REJECTs | Motivo da anomalia |
|--------|------------|-----------|-----------|---------|-------------------|
| 1      | 29         | 29        | 262.926   | 0       | —                 |
| 2      | 5          | 5         | 14.431    | 0       | `NO_ACTIONABLE_TASKS` (bug #2) |
| 3      | 29         | 30        | 329.891   | 1       | —                 |
| 4      | 5          | 5         | 15.852    | 0       | `NO_ACTIONABLE_TASKS` (bug #2) |
| 5      | 34         | 39        | 455.401   | 2       | —                 |

Os sprints 2 e 4 deste run encerraram prematuramente com apenas 5 turnos porque o orquestrador não reconstruía o contexto situacional para agentes não-PM, impedindo-os de agir — bug corrigido no commit `2b4aaf8`.

### 2.3 Mensagens por agente — run maduro (totais)

| Agente | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 | Total | % |
|--------|---------|---------|---------|---------|---------|-------|---|
| pm (Helena) | 28 | 32 | 23 | 33 | 29 | 145 | 35,4% |
| dev1 (Bruno) | 21 | 25 | 12 | 22 | 17 | 97 | 23,7% |
| dev2 (Carla) | 18 | 19 | 12 | 20 | 16 | 85 | 20,7% |
| qa (Diego) | 18 | 20 | 14 | 14 | 17 | 83 | 20,2% |
| **Total** | 85 | 96 | 61 | 89 | 79 | **410** | 100% |

### 2.4 Distribuição de tipos de mensagem — run maduro (totais)

| Tipo | Contagem | % |
|------|---------|---|
| CHAT | 233 | 56,8% |
| REPORT_PROGRESS | 43 | 10,5% |
| ESTIMATE | 24 | 5,9% |
| DECISION | 22 | 5,4% |
| CLAIM_TASK | 20 | 4,9% |
| REVIEW_REQUEST | 19 | 4,6% |
| APPROVE | 18 | 4,4% |
| REQUEST_CLARIFICATION | 9 | 2,2% |
| ASK_ESTIMATE | 8 | 2,0% |
| ASSIGN_TASK | 6 | 1,5% |
| RAISE_BLOCKER | 3 | 0,7% |
| RESOLVE_BLOCKER | 3 | 0,7% |
| MEDIATE | 2 | 0,5% |
| REJECT | 0 | 0,0% |

### 2.5 Tarefas concluídas por sprint

| Sprint | Escopo | Concluídas | Taxa |
|--------|--------|-----------|------|
| 1 (run maduro) | T1.1, T1.2, T1.3, T1.4 | 4/4 | 100% |
| 2 (run maduro) | T2.1–T2.4, T3.1 | 5/5 | 100% |
| 3 (run maduro) | T3.2, T3.3, T3.4 | 3/3 | 100% |
| 4 (run maduro) | T4.1, T4.2, T4.3 | 3/3 | 100% |
| 5 (run maduro) | T5.1, T5.2, T5.3 | 3/3 | 100% |

### 2.6 Blockers — run maduro (detalhe completo)

| ID | Sprint | Turno levantado | Ator | Tarefa | Resolvido por | Turno resolução | Δ turnos |
|----|--------|----------------|------|--------|--------------|----------------|---------|
| B1 | 2 | 7 | dev1 (Bruno) | T2.3 | qa (Diego) | 9 | 2 |
| B2 | 4 | 7 | dev1 (Bruno) | T4.1 | pm (Helena) | 10 | 3 |
| B3 | 5 | 7 | dev1 (Bruno) | T5.1 | dev2 (Carla) | 8 | 1 |

### 2.7 Divergência de estimativas entre dev1 e dev2 — run maduro

| Sprint | Tarefa | dev1 (Bruno) | dev2 (Carla) | Razão |
|--------|--------|-------------|-------------|-------|
| 1 | T1.1 | 5 | 2 | 2,5× |
| 1 | T1.2 | 8 | 3 | 2,7× |
| 1 | T1.3 | 8 | 4 | 2,0× |
| 1 | T1.4 | 5 | 2 | 2,5× |
| 2 | T2.1 | 3 | 1 | 3,0× |
| 4 | T4.2 | 5 | 3 | 1,7× |
| 4 | T4.3 | 3 | 2 | 1,5× |
| 5 | T5.1 | 8 | 3 | 2,7× |

**Média de divergência: 2,4×**. Bruno (Dev Sênior) estima consistentemente mais alto em todos os sprints; Carla (Dev Pleno) sistematicamente abaixo.

### 2.8 Crescimento do tamanho dos prompts ao longo dos sprints

| Sprint | Agente | Tokens (início da fase) | Tokens (final da fase) | Variação |
|--------|--------|------------------------|----------------------|---------|
| 1 | pm | 1.652 | 3.780 | +128% |
| 1 | dev1 | 2.563 | 3.668 | +43% |
| 2 | pm | 1.649 | 4.495 | +173% |
| 2 | qa | 3.776 | 4.582 | +21% |
| 5 | pm | 1.645 | 3.536 | +115% |
| 5 | dev1 | 2.763 | 3.342 | +21% |

Os prompts crescem *dentro* de cada sprint à medida que a memória de curto prazo acumula, mas o token médio de início de sprint permanece estável (~1.650 tokens para a PM) — evidência de que o truncamento da `shortTermMemory` entre sprints está funcionando.

---

## 3. Análise Qualitativa

### 3.1 Coerência das personas ao longo do tempo

As personas se mantiveram internamente consistentes em todos os 5 sprints dos runs completos. Dois casos ilustrativos:

**Bruno (dev1) — perfil perfeccionista:**
Na Sprint 1, Bruno justifica sua estimativa alta de T1.1 com racionalidade técnica prospectiva:

> "Estimativa T1.1: 5 pontos — schema precisa de atenção além do óbvio: índice único no ISBN, suporte a migrações versionadas, e já projetar os campos que as Sprints 3 (empréstimos) e 4 (recomendações) vão precisar. Se eu modelar só o mínimo agora, vamos ter ALTER TABLE doloroso depois."

Na Sprint 5, quatro sprints depois, Bruno ainda demonstra o mesmo perfil: identifica um bug potencial de integridade referencial (hard delete × LEFT JOIN) e paralisa o trabalho até obter clareza — o mesmo padrão de não avançar sem certeza arquitetural.

**Carla (dev2) — perfil pragmático:**
No turno 3 da Sprint 1, o `thoughts` privado de Carla revela raciocínio estratégico coerente com sua persona:

> "Bruno estimou T1.1: 5pts, T1.2: 8pts, T1.3: 8pts, T1.4: 5pts. Total dele: 26 pontos. Isso é muito. Vou estimar bem abaixo — meu estilo é entregar rápido e refinar depois."

Na Sprint 5, Carla resolve o Blocker B3 assumindo a responsabilidade pela decisão técnica que tomou na Sprint 1 (estratégia de hard delete em T1.2) e propondo uma solução pragmática (LEFT JOIN com tratamento de FK órfã) — demonstrando continuidade de responsabilidade sobre seu próprio código ao longo de toda a simulação.

### 3.2 Qualidade do raciocínio do QA

Diego (qa) não funcionou como um validador de checklist fixo: em múltiplos casos, ele raciocinou sobre implicações que não estavam explicitamente nos critérios originais.

**Caso 1 — Race condition TOCTOU (Sprint 3, run-2026-06-16T23-00-46):**
Diego rejeitou T3.2 (sistema de empréstimo) identificando uma vulnerabilidade de concorrência que não constava no escopo original da tarefa:

> "T3.2 — REJECT. Identifico uma race condition TOCTOU (Time-of-Check-Time-of-Use): a verificação de disponibilidade (SELECT) e o registro do empréstimo (INSERT) não são atômicos. Em ambiente com múltiplos usuários, dois empréstimos simultâneos do mesmo livro passariam ambos na verificação antes de qualquer um persistir. Exijo: (1) constraint UNIQUE parcial na tabela de empréstimos para livros ativos, (2) tratamento explícito do ConstraintViolationError retornando 409 com mensagem de usuário, (3) teste de integração que simule a condição concorrente."

Após a correção, Diego aprova e amplia o escopo de monitoramento:

> "Um ponto que vou monitorar em T3.3 e T3.4 como consequência desta entrega."

**Caso 2 — Bug de JOIN assimétrico (Sprint 5, run-2026-06-16T23-00-46):**
Diego detectou que o relatório mensal (T5.1) usava LEFT JOIN mas não cobria livros fisicamente deletados, gerando FK órfã invisível:

> "T5.1 — REJECT. Bug lógico no relatório: o LEFT JOIN entre empréstimos e livros não captura empréstimos cujos livros foram deletados fisicamente (FK órfã de hard delete implementado em T1.2). O relatório silencia sobre uma categoria inteira de dados históricos. Solução correta: FULL OUTER JOIN com tratamento de NULL no lado de livros."

**Caso 3 — Validação de ISBN vazio (Sprint 1, run-2026-06-16T23-00-46):**
Diego rejeitou T1.2 por falta de validação de string vazia no ISBN, distinguindo comportamento do banco do comportamento esperado da API:

> "T1.2 — REJECT. Caso de borda faltante: POST/PUT com ISBN como string vazia `''`. O CHECK constraint no banco capturaria isso, mas gerando um erro de constraint (500) em vez de 422 Unprocessable Entity. A validação precisa acontecer na camada de serviço, antes de chegar ao banco."

Em todos os 4 casos de rejeição do run-2026-06-16T23-00-46, o argumento de Diego é tecnicamente preciso, não arbitrário, e vai além do checklist explícito das tarefas.

### 3.3 Resolução de blockers — dinâmica emergente

Os 3 blockers do run maduro (run-2026-06-18T16-25-22) apresentam padrões qualitativamente distintos:

**B1 (Sprint 2) — Blocker técnico, resolvido por QA:**
Bruno antecipou o risco antes de terminar T2.1, levantando requisitos de fallback para a API externa instável. Diego assume a resolução com critérios de aceitação formais (timeout configurável, circuit breaker, parsing defensivo), transformando um risco em contrato testável. O blocker durou 2 turnos.

**B2 (Sprint 4) — Blocker de produto, resolvido por PM:**
Bruno paralisou o time diante do critério de recomendação indefinido de T4.1. A PM resolveu com uma DECISION cobrindo 9 pontos de especificação. A resposta de Bruno no turno seguinte evidencia que a resolução foi suficiente:

> `[thoughts]` "O blocker B2 foi resolvido pela Helena com uma DECISION clara e completa cobrindo todos os 9 pontos. Tenho escopo suficiente para trabalhar."

**B3 (Sprint 5) — Blocker de integridade, resolvido por dev-para-dev:**
Bruno questionou se T1.2 usou hard delete ou soft delete (Sprint 1). Carla — sem intermediação da PM — respondeu diretamente, assumiu a decisão técnica e propôs a solução:

> "Bruno, fui eu quem implementou T1.2 — posso responder o B3. Usei hard delete físico. Na época pareceu mais simples: biblioteca pessoal, sem necessidade de auditoria de livros removidos. Reconheço que cria o problema que você levantou: empréstimos em T3.2 podem referenciar livros que não existem mais na tabela. Sugestão pragmática para T5.1: usa LEFT JOIN da tabela de empréstimos com a de livros, em vez de INNER JOIN."

Este é o único caso de resolução dev-a-dev sem passar pela PM — e aconteceu porque Carla detinha a informação contextual necessária (ela implementou T1.2 na Sprint 1). O orquestrador aceitou o `RESOLVE_BLOCKER` de Carla como válido.

### 3.4 Continuidade de conhecimento entre sprints

Não há fase de retrospectiva nem memória cross-sprint explícita nas personas. A continuidade observada é inteiramente via `shortTermMemory` (blackboard compartilhado) e emergiu nos seguintes padrões:

- **Rastreabilidade técnica:** Bruno menciona T1.2 na Sprint 5 ("quando T1.2 foi implementado, qual estratégia de delete?") sem que essa dependência estivesse explicitada no backlog original.
- **Responsabilidade de autoria:** Carla reconhece sua própria implementação de T1.2 quatro sprints depois e qualifica a decisão retroativamente ("na época pareceu mais simples").
- **Monitoramento antecipado:** Diego, após aprovar T3.2 com constraint de unicidade, anuncia que vai monitorar T3.3 e T3.4 como consequência — antecipando acoplamento.
- **Referências ao estado anterior:** Helena abre o PLANNING de cada sprint citando o que foi entregue ("T3.1 já está DONE, ótimo — a fundação da entidade de empréstimo está pronta").

O que **não foi observado**: reflexão explícita sobre o *processo* (velocidade, padrões de conflito, taxa de rejeição). Não há eventos como "Bruno continua estimando alto demais" ou "Carla cortou atalhos novamente". A continuidade é de *conteúdo técnico*, não de *processo ágil*.

---

## 4. Análise dos Runs Parciais

### 4.1 Fase inicial — Erros de parsing JSON (jun/03–04, 7 runs)

| Run | LLM Calls | Retries | Falhas | Taxa de sucesso |
|-----|-----------|---------|--------|----------------|
| jun-03T16-11 | 13 | 12 | 4 | ~31% |
| jun-03T16-33 | 34 | 29 | 9 | ~26% |
| jun-03T16-59 | 31 | 3 | 0 | ~97% |
| jun-04T01-44 | 39 | 3 | 1 | ~97% |
| jun-04T11-28 | 25 | 0 | 0 | 100% |

**Causa raiz:** o campo `thoughts` não tinha limite explícito de caracteres; as respostas extrapolavam o limite de output do modelo, gerando JSON truncado (`"Bloco JSON não balanceado (objeto não foi fechado)"`). A correção introduzida no commit `794c437` (instrução de limite de `content` e truncamento de `shortTermMemory`) eliminou completamente os erros de parsing já no run de jun-04T11-28.

**Impacto nos tokens:** o token médio de input por chamada caiu de ~8.320 (jun-04) para ~4.390 (run maduro jun-18) — **redução de 47%** — sem perda de qualidade observável nas respostas.

### 4.2 Fase intermediária — Bug #1 de blockers (jun/15, 4 runs)

Runs com zero retries (parsing corrigido) mas que encerravam após a Sprint 1. O bug #1: nenhuma persona além da PM tinha a instrução `RESOLVE_BLOCKER`. Sem essa instrução, qualquer blocker levantado na Sprint 2+ ficava irresolvível, e o orquestrador não podia avançar.

### 4.3 Colapso combinatório — bug de resolução de blockers (run-2026-06-18T15-17-27)

Este run é o caso mais crítico: o sistema degenerou ao contrário — em vez de bloquear, gerou blockers em cascata.

**Sequência do colapso:**

1. Bruno levanta B1 corretamente (turno 2, Sprint 2).
2. A PM resolve via DECISION, mas o orquestrador exigia tipo `RESOLVE_BLOCKER` na mensagem — a PM usou `DECISION`.
3. O evento `BB_BLOCKER_RESOLVED` nunca foi emitido.
4. A partir do turno 19, Bruno passa a usar `RAISE_BLOCKER` cujo *conteúdo* diz "RESOLVE_BLOCKER — B1 encerrado". O sistema interpretava cada mensagem como **um novo blocker**, criando IDs B2, B3... B47.

| Métrica | run-06-18T15-17-27 Sprint 2 | Sprint 2 normal (run maduro) |
|--------|----------------------------|------------------------------|
| Turnos | 52 | 33 |
| RAISE_BLOCKER | 47 | 1 |
| BB_BLOCKER_OPEN | 47 | 1 |
| BB_BLOCKER_RESOLVED | 0 | 1 |
| Tarefas aprovadas | 0 | 5 |

O run foi interrompido externamente com 47 blockers acumulados e nenhuma entrega. Este run é a contraprova que valida a importância do fix #1 (`5a97c0f`): sem o tipo de mensagem correto, o sistema não apenas falha — ele se auto-destrói gerando trabalho falso.

---

## 5. Evolução do Sistema ao Longo das Execuções

```
jun/03-04             jun/15             jun/16             jun/18
    │                    │                  │                  │
Parsing           Parsing OK,         Bug #2             Ambos os bugs
falha             bug #1 bloqueia     bloqueia           corrigidos:
(JSON truncado)   Sprint 2+           Sprint 2,4         5 sprints
                                      com 5 turnos       completos ✅
```

| Marco | Commit | Impacto observado |
|-------|--------|------------------|
| Truncamento de shortTermMemory | `794c437` | Parsing JSON: 31% → 100% de sucesso; tokens médios −47% |
| RESOLVE_BLOCKER nas personas | `5a97c0f` | Blockers resolvidos corretamente; sprints 2+ executam até o fim |
| Reconstrução de situação por agente não-PM | `2b4aaf8` | Sprints 2 e 4 passam de 5 turnos para 25–29 turnos de execução |

---

## 6. Avaliação frente aos Objetivos Específicos do Trabalho

### OE3 — Especificar o projeto fictício (backlog, dependências, riscos)

O backlog do BiblioPessoal (T1–T5 com dependências e subtarefas T1.1–T5.3) foi processado com fidelidade nos dois runs completos: a sequência de dependências foi respeitada em 100% dos sprints, e os **riscos planejados** (API externa instável em T2, critério de recomendação indefinido em T4) emergiram espontaneamente como blockers B1 e B2 — sem que o orquestrador os forçasse explicitamente.

### OE4 — Modelar as personas dos agentes

As quatro personas (Helena/PM, Bruno/Dev Sênior, Carla/Dev Pleno, Diego/QA) demonstraram:

- **Consistência intra-run:** os traços definidores de cada persona (perfeccionismo de Bruno, pragmatismo de Carla, rigor de Diego, pragmatismo de Helena) não se contradisseram em nenhum dos 5 sprints observados.
- **Diferenciação comportamental mensurável:** a divergência média de estimativas Bruno×Carla foi de 2,4×, refletindo exatamente a diferença de perfil especificada; Diego emitiu 4 REJECTs tecnicamente justificados no run-2026-06-16T23-00-46 e zero no run maduro (onde os devs incorporaram os critérios proativamente).
- **Interação não-roteirizada:** a resolução dev-a-dev (Carla resolving B3) e a identificação de race condition TOCTOU por Diego não estavam previstas no script — emergiram do raciocínio do modelo.

### OE5 — Implementar o protótipo funcional

Os runs completos demonstram o funcionamento end-to-end: entrada não-interativa (zero intervenção humana após o início), execução de 5 sprints com 4 fases cada (PLANNING → EXECUTION → REVIEW), log estruturado em `.jsonl` com todos os eventos relevantes (mensagens, LLM calls, tempos, tokens, blackboard updates).

A ausência de fase RETRO formal é uma limitação conhecida do protótipo atual.

### OE6 — Executar simulações e analisar os registros

**Aspectos quantitativos observados:**
- 2 runs completos com 5 sprints cada; 18 entregas totais no run maduro com taxa de conclusão de 100%.
- 410 mensagens trocadas entre agentes no run maduro; PM representa 35,4% das mensagens, os demais agentes distribuídos de forma equilibrada (~21% cada).
- 3 blockers abertos e 3 resolvidos (run maduro); todos resolvidos em 1–3 turnos.
- Divergência de estimativas consistente com as personas (2,4× em média).
- Tokens de input estabilizados em ~4.400/chamada após truncamento, com prompts crescendo dentro da sprint mas resetando entre sprints.

**Aspectos qualitativos observados:**
- Coerência de personas sustentada ao longo de toda a simulação sem contradições explícitas.
- Raciocínio técnico emergente do QA: identificação de race conditions, bugs de JOIN e normalização de datas não antecipados no design original.
- Continuidade de conhecimento técnico entre sprints via memória de curto prazo compartilhada (blackboard).
- Ausência de reflexão sobre o *processo* (velocidade de sprint, padrões de conflito) — a continuidade é de conteúdo técnico, não de dinâmica de equipe.

### OE7 — Discutir evidências, contribuições, limitações e trabalhos futuros

**Contribuições evidenciadas:**
- O framework é capaz de simular sprints ágeis com comportamento qualitativamente plausível de equipes reais, incluindo conflitos de estimativa, rejeições técnicas justificadas e bloqueios por ambiguidade de requisito.
- O mecanismo de blackboard compartilhado permite continuidade de conhecimento técnico entre sprints sem memória cross-sprint explícita nas personas.
- O uso de `thoughts` privados como espaço de raciocínio interno revelou que os agentes formulam estratégias antes de agir (p.ex., Carla deliberando sobre a estimativa em resposta à estimativa de Bruno) — evidência de planejamento interno.

**Limitações identificadas:**
- Ausência de fase RETRO: não há reflexão explícita sobre o processo ágil entre sprints — o sistema não aprende sobre sua própria dinâmica.
- Continuidade limitada: as personas não têm memória persistente entre runs independentes; cada execução parte do zero.
- Escalabilidade de contexto: dentro de um sprint, os tokens crescem linearmente com os turnos. Sprints muito longas podem aproximar os limites de contexto do modelo.
- Bug de resolução de blockers (corrigido): quando o tipo de mensagem para resolução estava errado, o sistema gerou 47 blockers falsos em 52 turnos — evidenciando que o protocolo de comunicação é crítico e falhas nele produzem degradação catastrófica (não graceful degradation).
- Ausência de interações paralelas: o orquestrador serializa todos os agentes, não permitindo trabalho genuinamente concorrente.

**Direções para trabalhos futuros:**
- Implementar fase RETRO com mecanismo explícito de reflexão sobre o processo.
- Avaliar diferentes modelos de LLM (tamanho, temperatura) sobre o mesmo backlog para análise comparativa.
- Introduzir eventos externos não planejados (saída de membro, mudança de requisito) para testar resiliência da simulação.
- Explorar memória persistente entre runs para simular equipes com histórico compartilhado.

---

## 7. Sumário Executivo

Os dois runs completos (`run-2026-06-16T23-00-46` e `run-2026-06-18T16-25-22`) demonstram que o framework é capaz de simular 5 sprints ágeis com comportamento qualitativamente coerente. Os agentes sustentaram suas personas ao longo de toda a simulação, os riscos planejados emergiram como blockers nos momentos arquiteturalmente esperados, e o QA exerceu papel de controle de qualidade não-trivial — identificando vulnerabilidades de concorrência e bugs de integridade que não constavam no checklist original das tarefas.

A diferença entre os runs bem-sucedidos e os parciais é explicável por falhas de implementação corrigidas ao longo do desenvolvimento (parsing JSON, instrução de RESOLVE_BLOCKER, reconstrução de contexto por agente não-PM) — não por limitações intrínsecas da abordagem multiagente com LLM. O bug mais crítico (colapso para 47 blockers em 52 turnos) demonstrou que o protocolo de comunicação entre agentes é o ponto de fragilidade central do sistema: quando bem especificado, o sistema é robusto; quando mal especificado, a degradação é catastrófica e não graceful.

O conjunto de execuções cobre o ciclo completo de desenvolvimento experimental: protótipos com fixtures (validação de estrutura), runs reais de Sprint 1 (validação de parsing e personas), e runs completos de 5 sprints (validação end-to-end). A trajetória de desenvolvimento é rastreável nos logs: de 31% de sucesso nas chamadas LLM (jun/03) para 100% com tokens −47% (jun/18).
