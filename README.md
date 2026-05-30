# Um Framework Multiagente baseado em LLMs para Simulação de Projetos de Software

> Trabalho de Conclusão de Curso — Graduação em Sistemas de Informação
> Centro de Informática (CIn) — Universidade Federal de Pernambuco (UFPE)

**Autor:** Marco Antônio Andrade Mendes de Oliveira (`maamo@cin.ufpe.br`)
**Orientador:** Prof. Hermano Perrelli de Moura
**Coorientadora:** Marta Maria Guedes da Silva Neta
**Área:** Gestão de Projetos e Inteligência Artificial

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Motivação e objetivos](#2-motivação-e-objetivos)
3. [Arquitetura conceitual](#3-arquitetura-conceitual)
4. [O cenário simulado: BiblioPessoal](#4-o-cenário-simulado-bibliopessoal)
5. [A equipe simulada](#5-a-equipe-simulada)
6. [Protocolo de comunicação entre agentes](#6-protocolo-de-comunicação-entre-agentes)
7. [Ciclo de execução de uma sprint](#7-ciclo-de-execução-de-uma-sprint)
8. [Stack tecnológica](#8-stack-tecnológica)
9. [Estrutura do repositório](#9-estrutura-do-repositório)
10. [Pré-requisitos](#10-pré-requisitos)
11. [Instalação e configuração](#11-instalação-e-configuração)
12. [Como executar](#12-como-executar)
13. [Saídas geradas](#13-saídas-geradas)
14. [Roadmap de implementação](#14-roadmap-de-implementação)
15. [Limitações conhecidas](#15-limitações-conhecidas)
16. [Como citar](#16-como-citar)
17. [Referências](#17-referências)
18. [Licença](#18-licença)

---

## 1. Visão geral

**BiblioSim** é um framework experimental que simula a execução de um projeto de software por uma equipe ágil cujos integrantes são agentes autônomos controlados por um Large Language Model (LLM). A simulação executa quatro sprints consecutivas, **sem nenhuma interação humana durante o run**, e produz logs estruturados em JSON Lines que permitem análise posterior das dinâmicas observadas (planejamento, estimativas, conflitos, bloqueios, decisões, retrospectivas e *carry-over* de tarefas).

O objetivo do framework não é produzir software real, e sim observar e analisar como agentes baseados em LLMs **se comportam ao representar papéis distintos de uma equipe de desenvolvimento**, com personalidades configuradas para gerar tensão produtiva (perfeccionista vs. pragmático, rigoroso vs. ágil).

## 2. Motivação e objetivos

### Motivação

Sistemas multiagente baseados em LLMs vêm sendo investigados como forma de simular comportamentos humanos em ambientes complexos [4][5]. Aplicar essa abordagem ao contexto de **gestão de projetos de software** abre uma frente pouco explorada: usar simulações como ferramenta de análise de dinâmicas de equipe, antecipação de riscos e estudo de padrões organizacionais — sem o custo e o tempo de envolver pessoas reais.

### Objetivo geral

Desenvolver um framework multiagente, suportado por LLMs, capaz de simular de forma autônoma a execução de um projeto de software por uma equipe ágil ao longo de múltiplas sprints, gerando artefatos analisáveis que permitam avaliar a coerência, a consistência e a riqueza das dinâmicas emergentes.

### Objetivos específicos

- Modelar uma arquitetura multiagente com papéis distintos (Project Manager, Desenvolvedor Sênior, Desenvolvedor Pleno, Quality Analyst), cada um instanciado a partir de um *system prompt* que codifica sua persona e suas heurísticas de decisão.
- Definir um protocolo estruturado de comunicação entre agentes, baseado em mensagens tipadas e validadas por *schema*.
- Implementar um orquestrador determinístico que coordene fases de Planning, Execution, Review e Retrospective, respeitando ordem de turnos e condições de parada.
- Implementar mecanismos de **memória de curto e longo prazo** (sumarização entre sprints) para permitir runs longos sem estouro de contexto.
- Registrar exaustivamente o estado da simulação em logs estruturados (JSONL) que viabilizem análise quantitativa e qualitativa posterior.
- Avaliar os resultados quanto a: coerência das interações, consistência das decisões, fluxo de execução das tarefas e fidelidade dos agentes às suas personas.

## 3. Arquitetura conceitual

O sistema é composto por sete blocos principais:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Orchestrator                            │
│  (controla 4 sprints × 4 fases, ordem de turnos, parada)        │
└──────┬──────────────────────────────────────────────────────────┘
       │ orquestra
       ▼
┌──────────────────┐     lê/escreve     ┌────────────────────────┐
│     Agents       │ ◄────────────────► │     Blackboard         │
│  (PM, Dev1,      │                    │ (backlog, decisões,    │
│   Dev2, QA)      │                    │  blockers, carry-over) │
└──────┬───────────┘                    └────────────────────────┘
       │ chama
       ▼
┌──────────────────┐     valida via     ┌────────────────────────┐
│   LLM Client     │ ◄────────────────► │      Schemas (zod)     │
│  (Anthropic SDK) │                    │  (mensagens tipadas)   │
└──────┬───────────┘                    └────────────────────────┘
       │
       ▼
┌──────────────────┐  resume a cada     ┌────────────────────────┐
│     Logger       │     sprint         │     Summarizer         │
│  (JSON Lines)    │ ◄────────────────► │ (compacta memória      │
│                  │                    │  para próxima sprint)  │
└──────────────────┘                    └────────────────────────┘
```

Os componentes e suas responsabilidades:

- **Agent** — classe base que encapsula a persona (via *system prompt*), a memória de curto prazo (histórico da fase atual) e a memória de longo prazo (sumários de sprints anteriores). Cada agente é uma instância configurada por um arquivo `.md` com sua persona.
- **Blackboard** — estrutura compartilhada que mantém o estado mutável da simulação: backlog, status das tarefas, estimativas, bloqueios ativos, decisões tomadas e histórico de *carry-over*.
- **Orchestrator** — controla o fluxo da simulação: avança sprints, gerencia transições de fase, decide a ordem dos turnos e aplica as condições de parada (turnos máximos por fase, conclusão antecipada).
- **Summarizer** — ao final de cada sprint, gera um resumo executivo que substitui o histórico bruto da sprint anterior na memória dos agentes, evitando que o contexto cresça indefinidamente.
- **Logger** — registra todos os eventos da simulação em formato JSON Lines (um arquivo por sprint), preservando a rastreabilidade completa.
- **Protocol / Schemas** — define os tipos de mensagem trocados entre agentes e valida cada mensagem com [zod](https://zod.dev/) antes que ela entre no fluxo.
- **LLM Client** — wrapper sobre o SDK oficial da Anthropic com tratamento de erro, *retry* e *parsing* tolerante de JSON.

## 4. O cenário simulado: BiblioPessoal

O projeto fictício escolhido para os agentes "construírem" é uma aplicação web de **gestão de biblioteca pessoal com empréstimo a amigos**. O backlog foi desenhado para conter dependências reais, um risco plantado e uma ambiguidade proposital, de forma a estressar a dinâmica da equipe:

| ID | Tarefa | Dependências | Característica |
|----|--------|--------------|----------------|
| T1 | Cadastro e listagem de livros | — | Base de tudo |
| T2 | Integração com API externa de metadados | T1 | **Risco plantado:** API instável |
| T3 | Empréstimo a amigos | T1 | Tarefa "comum" |
| T4 | Sistema de recomendações | T1 | **Ambígua de propósito:** critério não definido |
| T5 | Relatório mensal | T1, T3 | Depende de duas anteriores |

Essa configuração foi escolhida deliberadamente porque:
- **T1 como gargalo** força a equipe a discutir priorização.
- **T2 com risco** testa como os agentes lidam com imprevistos.
- **T4 ambígua** força negociação de escopo — espera-se ver QA e PM pressionando por clareza enquanto os devs reagem de formas diferentes.
- **T5 com dupla dependência** cria pressão de cronograma na sprint final.

## 5. A equipe simulada

Quatro agentes compõem a equipe. As personas foram desenhadas para gerar tensão produtiva:

| Agente | Papel | Persona | Tensão esperada |
|--------|-------|---------|-----------------|
| **Helena** | Project Manager | Organizada, pragmática, foca em prazo | Mediadora dos conflitos abaixo |
| **Bruno** | Dev Sênior | Perfeccionista, prefere arquitetura limpa, estima alto | Choca com Carla |
| **Carla** | Dev Pleno | Pragmática, "entrega e refina depois", estima baixo | Choca com Bruno e com Diego |
| **Diego** | QA | Rigoroso, foca em casos de borda | Choca com Carla |

A premissa é que **a tensão entre perfis é o que torna a simulação interessante** — equipes reais não são homogêneas, e simular isso é parte do contributo do trabalho.

## 6. Protocolo de comunicação entre agentes

Toda mensagem trocada entre agentes segue um formato JSON estrito, validado por *schema* antes de ser aceita:

```json
{
  "thoughts": "raciocínio interno do agente (não compartilhado com outros)",
  "messages": [
    {
      "to": "dev1 | dev2 | qa | pm | all",
      "type": "ASSIGN_TASK",
      "content": "...",
      "refs": ["T1"]
    }
  ]
}
```

### Tipos de mensagem suportados

| Tipo | Quem emite | Propósito |
|------|-----------|-----------|
| `ASSIGN_TASK` | PM | Atribui tarefa a um dev |
| `ASK_ESTIMATE` | PM | Pede estimativa |
| `ESTIMATE` | Dev | Responde estimativa |
| `REPORT_PROGRESS` | Dev | Relata progresso em Execution |
| `RAISE_BLOCKER` | Qualquer | Levanta um bloqueio |
| `REVIEW_REQUEST` | Dev | Pede revisão de QA |
| `APPROVE` | QA | Aprova entrega |
| `REJECT` | QA | Rejeita entrega (com motivo) |
| `REQUEST_CLARIFICATION` | Qualquer | Pede esclarecimento |
| `MEDIATE` | PM | Mediação de conflito |
| `DECISION` | PM | Registra decisão final |
| `CHAT` | Qualquer | Comunicação livre |

O campo `thoughts` é registrado em log para análise posterior, mas **não** é visível para os outros agentes (simula raciocínio privado).

## 7. Ciclo de execução de uma sprint

Cada sprint percorre quatro fases sequenciais, com limites de turnos para garantir terminação:

| Fase | Descrição | Máx. turnos |
|------|-----------|-------------|
| **PLANNING** | PM apresenta backlog, devs estimam, QA questiona, PM decide escopo | 15 |
| **EXECUTION** | Devs reportam progresso e bloqueios; QA pode pedir informações | 25 |
| **REVIEW** | QA aprova ou rejeita as entregas | 10 |
| **RETRO** | Cada agente fala o que funcionou e o que pode melhorar | 6 |

Tarefas que não atingem o critério de "concluída" na fase de Review **escorregam para a sprint seguinte** (mecanismo de *carry-over* explicitamente rastreado).

### Configuração padrão

```js
{
  totalSprints: 4,
  maxTurnsPerPhase: { PLANNING: 15, EXECUTION: 25, REVIEW: 10, RETRO: 6 },
  llm: {
    model: "claude-sonnet-4-5",
    temperature: 0.7,
    maxTokens: 1024
  }
}
```

## 8. Stack tecnológica

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Runtime | Node.js ≥ 20 | `fetch` nativo, ESM estável, ecossistema maduro |
| Linguagem | JavaScript (ESM) | Reduz fricção sobre TypeScript em projeto exploratório |
| LLM | Claude Sonnet 4.6 (via API Anthropic) | Modelo de capacidade adequada à tarefa, custo razoável, *function calling* e *structured output* maduros |
| SDK | [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) | SDK oficial |
| Validação | [`zod`](https://zod.dev/) | Schemas tipados e mensagens de erro claras |
| Ambiente | [`dotenv`](https://www.npmjs.com/package/dotenv) | Carregamento de `.env` |
| Logs | JSON Lines (`.jsonl`) | Apêndices baratos, parseável linha a linha, fácil de analisar com `jq`, pandas, etc. |

## 9. Estrutura do repositório

> A estrutura abaixo reflete o **estado planejado** ao final da implementação. Diretórios marcados com 🚧 ainda não existem na etapa atual.

```
biblio-sim/
├── README.md                    ← este arquivo
├── package.json
├── .env.example
├── .gitignore
│
├── scripts/
│   ├── smoke-test.js            ← teste de conectividade com a API
│   └── run-simulation.js        🚧 ponto de entrada da simulação completa
│
├── src/                         🚧
│   ├── agents/
│   │   ├── Agent.js             ← classe base (persona + memória)
│   │   └── personas/
│   │       ├── pm.md            ← Helena
│   │       ├── dev-senior.md    ← Bruno
│   │       ├── dev-pleno.md     ← Carla
│   │       └── qa.md            ← Diego
│   │
│   ├── core/
│   │   ├── Orchestrator.js      ← controla sprints e fases
│   │   ├── Blackboard.js        ← estado compartilhado
│   │   └── Summarizer.js        ← sumarização entre sprints
│   │
│   ├── protocol/
│   │   └── schemas.js           ← schemas zod do protocolo
│   │
│   ├── llm/
│   │   └── client.js            ← wrapper da API Anthropic
│   │
│   ├── logging/
│   │   └── Logger.js            ← logger JSONL
│   │
│   └── config/
│       └── simulation.js        ← parâmetros da simulação
│
├── runs/                        🚧 (gerado em runtime; ignorado pelo git)
│   └── run-YYYY-MM-DDTHH-MM-SS/
│       ├── sprint-1.jsonl
│       ├── sprint-2.jsonl
│       ├── sprint-3.jsonl
│       ├── sprint-4.jsonl
│       ├── blackboard-final.json
│       └── summary.json
│
└── docs/                        🚧
    ├── decisoes-de-projeto.md   ← log de decisões arquiteturais
    └── notas-de-experimentos.md ← observações de runs específicos
```

## 10. Pré-requisitos

- **Node.js ≥ 20** (verifique com `node -v`)
- **npm ≥ 10** (já vem com Node 20)
- **Chave de API da Anthropic** com créditos disponíveis (gerar em https://console.anthropic.com/)
- **Sistema operacional**: Linux, macOS ou Windows (testado em macOS e Linux)

## 11. Instalação e configuração

```bash
# 1. Clonar o repositório
git clone <url-do-repo> biblio-sim
cd biblio-sim

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite .env e insira sua ANTHROPIC_API_KEY
```

### Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `ANTHROPIC_API_KEY` | sim | — | Chave da API Anthropic |
| `ANTHROPIC_MODEL` | não | `claude-sonnet-4-6` | Modelo a ser utilizado |

## 12. Como executar

### Teste de conectividade (smoke test)

Verifica se o ambiente está corretamente configurado e se há comunicação com a API:

```bash
npm run smoke
```

Saída esperada (latência e tokens variam):

```
[smoke] usando modelo: claude-sonnet-4-6
[smoke] latência: 1234ms
[smoke] stop_reason: end_turn
[smoke] tokens in/out: 28/15
[smoke] resposta:
Sim, estou funcionando.
```

### Simulação completa 🚧

> Disponível a partir da Etapa 12 do roadmap.

```bash
npm run simulate
```

## 13. Saídas geradas

Cada execução cria um diretório `runs/run-YYYY-MM-DDTHH-MM-SS/` contendo:

| Arquivo | Conteúdo |
|---------|----------|
| `sprint-N.jsonl` | Todos os eventos da sprint N: turnos, mensagens, decisões, mudanças de estado |
| `blackboard-final.json` | Estado final do backlog, incluindo histórico completo de *carry-over* |
| `summary.json` | Métricas agregadas: planejado vs. concluído por sprint, taxa de *carry-over*, número de blockers, volume de mensagens por agente |

### Exemplo de evento em `sprint-1.jsonl`

```jsonl
{"ts":"2026-05-20T14:23:11.482Z","sprint":1,"phase":"PLANNING","turn":3,"actor":"pm","event":"MESSAGE","payload":{"to":"dev1","type":"ASK_ESTIMATE","content":"Bruno, sua estimativa para T1?","refs":["T1"]}}
```

## 14. Roadmap de implementação

O desenvolvimento é incremental, com cada etapa entregando algo verificável:

- [x] **Etapa 1** — Setup do projeto + smoke test contra a API
- [x] **Etapa 2** — Logger e estrutura de runs
- [x] **Etapa 3** — Schemas zod e protocolo de mensagens
- [x] **Etapa 4** — LLM client robusto (retry, parsing tolerante)
- [x] **Etapa 5** — Classe Agent + persona da PM
- [x] **Etapa 6** — Blackboard
- [x] **Etapa 7** — Orquestrador mínimo (PLANNING com 2 agentes)
- [x] **Etapa 8** — Equipe completa em PLANNING
- [x] **Etapa 9** — Fases EXECUTION, REVIEW, RETRO
- [ ] **Etapa 10** — Carry-over e múltiplas sprints
- [ ] **Etapa 11** — Summarizer
- [ ] **Etapa 12** — Run completo de 4 sprints com métricas finais
- [ ] **Etapa 13** — Polimento, ajustes de prompts e robustez

## 15. Limitações conhecidas

- **Não há geração de código real:** os agentes "trabalham" no nível conceitual; nenhuma linha de código do BiblioPessoal é efetivamente produzida. Esse recorte é intencional — o foco é analisar dinâmicas de equipe, não capacidade de codificação.
- **Não-determinismo:** com `temperature: 0.7`, runs diferentes produzem resultados diferentes. A análise no TCC considerará múltiplas execuções e padrões agregados, não casos isolados.
- **Custo de API:** cada run completa de 4 sprints consome uma quantidade não-trivial de tokens. Estimativas serão publicadas após a Etapa 12.
- **Vieses do modelo:** o LLM carrega vieses do seu treinamento (estilo de comunicação, normas de equipe, vocabulário). Esses vieses serão discutidos como ameaça à validade no texto da monografia.

## 16. Como citar

Caso este trabalho seja útil para outras pesquisas, sugere-se a seguinte citação (atualizar após defesa):

```bibtex
@misc{oliveira2026bibliosim,
  author = {Oliveira, Marco Antônio Andrade Mendes de},
  title  = {Um Framework Multiagente baseado em LLMs para Simulação de Projetos de Software},
  year   = {2026},
  note   = {Trabalho de Conclusão de Curso, Sistemas de Informação,
            Centro de Informática, Universidade Federal de Pernambuco},
  url    = {https://github.com/MarcoAntonioAndradeMO/UM-FRAMEWORK-MULTIAGENTE-BASEADO-EM-LLMs-PARA-SIMULA-O-DE-PROJETOS-DE-SOFTWARE}
}
```

## 17. Referências

1. Brown, T. et al. **Language Models are Few-Shot Learners.** NeurIPS, 2020.
2. OpenAI. **GPT-4 Technical Report.** 2023.
3. Chen, M. et al. **Evaluating Large Language Models Trained on Code.** arXiv, 2021.
4. Park, J. et al. **Generative Agents: Interactive Simulacra of Human Behavior.** UIST, 2023.
5. Wang, L. et al. **A Survey on Large Language Model based Multi-Agent Systems.** arXiv, 2023.

## 18. Licença

A definir com o orientador. Sugestão: **MIT** para o código e **CC BY 4.0** para o texto da monografia.

---

<sub>Recife, 2026 — Centro de Informática, UFPE.</sub>
