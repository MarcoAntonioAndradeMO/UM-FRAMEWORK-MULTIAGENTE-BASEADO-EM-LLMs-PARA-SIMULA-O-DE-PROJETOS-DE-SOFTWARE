/**
 * mockResponses.js
 *
 * Fixtures de resposta para o modo mock do LLMClient.
 * Cada fixture é uma STRING bruta — exatamente como o modelo a devolveria —
 * para que o pipeline extractJson → safeParse seja exercitado de verdade.
 *
 * Inclui casos válidos, JSON embrulhado em markdown, JSON malformado e
 * JSON sintaticamente correto mas que falha na validação do schema.
 */

// ─── Fixtures válidas ─────────────────────────────────────────────────────────

/** Helena (PM) abre o planning e atribui T1.1 a Bruno */
const PM_PLANNING_OPEN = JSON.stringify({
  thoughts: 'T1.1 é a fundação da Sprint 1. Nenhuma outra tarefa pode começar sem o schema modelado. Bruno tem a senioridade para liderar, mas quero ouvir a estimativa de Carla também.',
  messages: [
    {
      to: 'dev1',
      type: 'ASSIGN_TASK',
      content: 'Bruno, você está responsável por T1.1 nesta sprint. Comece pela modelagem do schema de livros — é o desbloqueador de tudo.',
      refs: ['T1.1'],
    },
    {
      to: 'all',
      type: 'ASK_ESTIMATE',
      content: 'Pessoal, precisamos de estimativas para as tarefas da Sprint 1 antes de fechar o escopo. Bruno e Carla, quanto tempo cada um precisaria para T1.1, T1.2, T1.3 e T1.4?',
      refs: ['T1.1', 'T1.2', 'T1.3', 'T1.4'],
    },
  ],
});

/** Bruno (dev1) dá estimativa conservadora para T1.1 */
const DEV1_ESTIMATE = JSON.stringify({
  thoughts: 'T1.1 parece simples mas tem bastante coisa: schema, migrações, índices, validações, testes unitários mínimos. Não quero comprometer uma estimativa otimista e depois correr.',
  messages: [
    {
      to: 'pm',
      type: 'ESTIMATE',
      content: 'Helena, minha estimativa para T1.1 é 5 dias. Preciso de tempo para a modelagem correta do schema e para não criar dívida técnica logo de cara.',
      refs: ['T1.1'],
    },
  ],
});

/** Carla (dev2) dá estimativa mais otimista e discorda de Bruno */
const DEV2_ESTIMATE = JSON.stringify({
  thoughts: 'Bruno está superestimando de novo. Com um schema simples e uma API REST básica, 3 dias são suficientes. Podemos refinar nas próximas sprints.',
  messages: [
    {
      to: 'pm',
      type: 'ESTIMATE',
      content: 'Discordo do Bruno. 3 dias são o suficiente para T1.1. Schema simples, entregamos e refinamos depois.',
      refs: ['T1.1'],
    },
    {
      to: 'dev1',
      type: 'CHAT',
      content: 'Bruno, você está exagerando o escopo de novo. T1.1 não precisa ser perfeito para desbloquear as outras tarefas.',
    },
  ],
});

/** Helena (PM) media conflito e toma decisão */
const PM_DECISION = JSON.stringify({
  thoughts: 'Preciso mediar isso antes que vire uma briga. Vou propor um meio-termo: 4 dias, com entrega incremental. Isso satisfaz Bruno com tempo de qualidade e Carla com prazo razoável.',
  messages: [
    {
      to: 'all',
      type: 'MEDIATE',
      content: 'Pessoal, precisamos avançar. Estou ouvindo 5 dias de Bruno e 3 de Carla.',
    },
    {
      to: 'all',
      type: 'DECISION',
      content: 'Decisão final: T1.1 tem estimativa de 4 dias. Bruno lidera, Carla suporta. Entrega incremental ao final do dia 4.',
      refs: ['T1.1'],
    },
  ],
});

/** Diego (QA) rejeita entrega de T1.3 com motivo claro */
const QA_REVIEW_REJECT = JSON.stringify({
  thoughts: 'A validação de entrada não cobre o caso de ISBN duplicado nem o de livro sem autor. Esses são casos de borda básicos que qualquer sistema de biblioteca precisa tratar.',
  messages: [
    {
      to: 'dev1',
      type: 'REJECT',
      content: 'T1.3 rejeitada. Dois casos de borda não cobertos: (1) tentativa de cadastrar ISBN duplicado — nenhuma validação; (2) livro sem campo autor aceito silenciosamente. Precisam ser tratados antes da aprovação.',
      refs: ['T1.3'],
    },
  ],
});

/** Bruno (dev1) levanta bloqueio em T2.1 */
const DEV1_RAISE_BLOCKER = JSON.stringify({
  thoughts: 'A API externa de metadados está fora do ar há 2 horas. Não consigo avançar em T2.1 sem ela. Preciso escalar isso agora.',
  messages: [
    {
      to: 'all',
      type: 'RAISE_BLOCKER',
      content: 'Bloqueio em T2.1: a API externa de metadados de livros está inacessível (timeout em todas as chamadas). Não consigo integrar sem ela. Aguardando resolução ou decisão de fallback.',
      refs: ['T2.1'],
    },
    {
      to: 'pm',
      type: 'REQUEST_CLARIFICATION',
      content: 'Helena, temos um fallback planejado caso a API de metadados fique indisponível? Devemos mockar localmente para não bloquear a sprint?',
      refs: ['T2.1'],
    },
  ],
});

// ─── Fixtures de PLANNING — agentes não-PM respondendo ───────────────────────
// Usam type: "CHAT" para estimativas, conforme as personas (ver dev1.md/dev2.md).

/** Bruno (dev1) responde ao ASK_ESTIMATE com estimativa conservadora via CHAT */
const DEV1_PLANNING = JSON.stringify({
  thoughts: 'Helena pediu estimativa para T1.1. Schema parece simples mas envolve índices, migrações, validações e testes unitários mínimos. Vou ser honesto: 8 pontos é o mínimo seguro.',
  messages: [
    {
      to:      'pm',
      type:    'CHAT',
      content: 'Estimativa T1.1: 8 pontos. Justificativa: schema com índice em ISBN, migrações, estrutura base que vai ser consumida por T1.2 e T1.4. Qualquer atalho aqui vai aparecer como bug em T3.1 e T5.1.',
      refs:    ['T1.1'],
    },
  ],
});

/** Carla (dev2) responde com estimativa mais otimista, defende versão mínima */
const DEV2_PLANNING = JSON.stringify({
  thoughts: 'Bruno está exagerando de novo. T1.1 é schema básico. 5 pontos no máximo — o importante é desbloquear T3.1 e T5.1 rápido. Refinamos nas próximas sprints.',
  messages: [
    {
      to:      'pm',
      type:    'CHAT',
      content: 'Estimativa T1.1: 5 pontos. Schema simples, entrega funcional. Não precisamos de perfeição na Sprint 1 — o importante é desbloquear T1.2, T1.4 e os dependentes de sprints futuras.',
      refs:    ['T1.1'],
    },
  ],
});

/** Diego (QA) levanta questões de qualidade no PLANNING antes de fechar o escopo */
const QA_PLANNING = JSON.stringify({
  thoughts: 'T4.1 sem critério de recomendação é inaceitável do ponto de vista de QA — não consigo definir casos de aceitação. E T2.3 com API instável precisa de plano de fallback antes de entrar no escopo.',
  messages: [
    {
      to:      'pm',
      type:    'REQUEST_CLARIFICATION',
      content: 'Antes de fechar o escopo, tenho dois pontos de qualidade: (1) T4.1 — qual o critério de recomendação? Sem definição não consigo escrever casos de aceitação. (2) T2.3 — há fallback planejado para quando a API externa cair? Precisamos cobrir esse caso de borda.',
      refs:    ['T4.1', 'T2.3'],
    },
  ],
});

// ─── Fixtures de EXECUTION — Sprint 1 ────────────────────────────────────────
// Sequência: PM abre execução → dev1 CLAIM_TASK + REVIEW_REQUEST → dev2 RAISE_BLOCKER
// → qa CHAT aguardando → _shouldStopPhase detecta "sem acionáveis" → para.

/** Helena (PM) abre a fase EXECUTION da Sprint 1 */
const PM_EXECUTION_OPEN = JSON.stringify({
  thoughts: 'EXECUTION iniciada. T1.1 está atribuída ao Bruno desde o planning. É o gargalo da Sprint 1 — nada mais pode começar antes do schema estar aprovado.',
  messages: [
    {
      to:      'all',
      type:    'CHAT',
      content: 'Sprint 1 — EXECUTION iniciada. Foco total em T1.1 (schema de livros). Bruno, assuma com CLAIM_TASK e envie para revisão do Diego quando concluído. Carla, aguarde aprovação de T1.1 para iniciar T1.2.',
    },
  ],
});

/** Bruno (dev1) assume T1.1 e já pede revisão */
const DEV1_EXECUTION = JSON.stringify({
  thoughts: 'T1.1 já está atribuída a mim desde o planning. Vou assumir formalmente com CLAIM_TASK e mandar direto para revisão do Diego — o schema está pronto com índice ISBN, campos obrigatórios e estrutura base.',
  messages: [
    {
      to:      'all',
      type:    'CLAIM_TASK',
      content: 'Assumindo T1.1 (Modelar schema de livros). Iniciando agora: tabela livros com índice único em ISBN, campos obrigatórios (título, autor, isbn), migração gerada e pronta para T1.2 e T1.4.',
      refs:    ['T1.1'],
    },
    {
      to:      'qa',
      type:    'REVIEW_REQUEST',
      content: 'Diego, T1.1 concluída. Schema modelado: índice único em ISBN, campos obrigatórios validados na camada de modelo, migração gerada. Pronto para revisão de qualidade.',
      refs:    ['T1.1'],
    },
  ],
});

/** Carla (dev2) não pode iniciar T1.2 (dep T1.1 não aprovada); levanta bloqueio de ambiente */
const DEV2_EXECUTION = JSON.stringify({
  thoughts: 'T1.2 depende de T1.1, que acabou de ir para IN_REVIEW. Não posso iniciar ainda. Mas o banco de dados de desenvolvimento está com latência alta — vou registrar como blocker para não perder.',
  messages: [
    {
      to:      'all',
      type:    'RAISE_BLOCKER',
      content: 'Bloqueio de ambiente em T1.2: banco de dados de desenvolvimento com latência >500ms nas últimas 2 horas. T1.2 aguarda aprovação de T1.1, mas o ambiente precisa de atenção antes do início.',
      refs:    ['T1.2'],
    },
  ],
});

/** Diego (QA) confirma recebimento de T1.1 para revisão */
const QA_EXECUTION = JSON.stringify({
  thoughts: 'Recebi o REVIEW_REQUEST de T1.1. Vou confirmar recebimento — a revisão formal (APPROVE/REJECT) virá depois de checar o schema contra os critérios: ISBN único, campos obrigatórios, compatibilidade com dependentes.',
  messages: [
    {
      to:      'dev1',
      type:    'CHAT',
      content: 'Bruno, confirmando recebimento de T1.1 para revisão. Vou checar: índice ISBN único, campos obrigatórios e compatibilidade com T1.2 e T1.4. Retorno em breve com APPROVE ou REJECT.',
    },
  ],
});

// ─── Fixtures de REVIEW — Sprint 1 ───────────────────────────────────────────
// Ciclo demonstrado:
//   Turno 1: PM abre → QA aprova T1.1 (sem risco) e rejeita T1.3 (risco ISBN).
//   Turno 2: PM endereça dev1 → dev1 corrige e resubmete T1.3 via REVIEW_REQUEST.
//   Turno 3: PM endereça QA → QA aprova T1.3 → _shouldStopPhase → REVIEW_COMPLETE.
//
// A lógica "rejeitar na 1ª, aprovar na 2ª" fica nos fixtures, não no Orchestrator.

/** Helena (PM) abre a fase REVIEW, delega revisão ao QA */
const PM_REVIEW_OPEN = JSON.stringify({
  thoughts: 'T1.1 e T1.3 estão em IN_REVIEW. T1.1 não tem risco explícito; T1.3 tem a nota de ISBN duplicado que é exatamente o tipo de coisa que o Diego vai pegar. Vou pedir que ele revise as duas.',
  messages: [
    {
      to:      'qa',
      type:    'CHAT',
      content: 'Diego, temos T1.1 (schema de livros) e T1.3 (validação de entrada) aguardando revisão. Por favor revise as duas e emita APPROVE ou REJECT com refs obrigatório.',
      refs:    ['T1.1', 'T1.3'],
    },
  ],
});

/** Diego (QA) aprova T1.1 e rejeita T1.3 pelos casos de borda da nota */
const QA_REVIEW_FIRST = JSON.stringify({
  thoughts: 'T1.1 está sólido — índice único ISBN, campos obrigatórios, migração gerada. APPROVE. T1.3 é o problema: a nota da tarefa alertava sobre ISBN duplicado e livro sem autor, e nenhum dos dois está coberto. REJECT com motivo técnico preciso.',
  messages: [
    {
      to:      'all',
      type:    'APPROVE',
      content: 'T1.1 aprovada. Schema correto: índice único em ISBN, campos obrigatórios validados, migração gerada. Sem pendências.',
      refs:    ['T1.1'],
    },
    {
      to:      'dev1',
      type:    'REJECT',
      content: 'T1.3 rejeitada. Dois casos de borda não cobertos (ambos descritos na nota da tarefa): (1) ISBN duplicado é aceito silenciosamente — deve retornar erro; (2) livro sem campo autor é aceito — deve ser obrigatório. Corrija e reenvie.',
      refs:    ['T1.3'],
    },
  ],
});

/** Helena (PM) pede a Bruno que corrija T1.3 e resubmeta */
const PM_REVIEW_FOLLOWUP = JSON.stringify({
  thoughts: 'Diego rejeitou T1.3 pelos dois casos que a nota já alertava. Bruno precisa corrigir. Vou endereçá-lo explicitamente para que ele resubmeta via REVIEW_REQUEST.',
  messages: [
    {
      to:      'dev1',
      type:    'CHAT',
      content: 'Bruno, Diego rejeitou T1.3 pelos casos de borda indicados na nota da tarefa: ISBN duplicado e autor ausente. Corrija os dois e reenvie com REVIEW_REQUEST quando estiver pronto.',
      refs:    ['T1.3'],
    },
  ],
});

/** Bruno (dev1) corrige e resubmete T1.3 via REVIEW_REQUEST */
const DEV1_RESUBMIT = JSON.stringify({
  thoughts: 'Diego tinha razão — a nota de T1.3 já avisava esses casos. Corrigi os dois: ISBN duplicado retorna 422, autor ausente é validado na camada de modelo. Reenviando para revisão.',
  messages: [
    {
      to:      'qa',
      type:    'REVIEW_REQUEST',
      content: 'T1.3 corrigida: (1) ISBN duplicado agora retorna 422 com mensagem clara; (2) campo autor obrigatório validado na camada de modelo — rejeita sem ele. Pronto para segunda revisão.',
      refs:    ['T1.3'],
    },
  ],
});

/** Helena (PM) chama Diego para segunda revisão de T1.3 */
const PM_REVIEW_CLOSE = JSON.stringify({
  thoughts: 'Bruno resubmeteu T1.3 após a correção. Diego precisa fazer a revisão final para fecharmos a Sprint 1.',
  messages: [
    {
      to:      'qa',
      type:    'CHAT',
      content: 'Diego, Bruno resubmeteu T1.3 com as duas correções. Por favor faça a revisão final e emita APPROVE ou REJECT.',
      refs:    ['T1.3'],
    },
  ],
});

/** Diego (QA) aprova T1.3 na segunda revisão — Sprint 1 fechada */
const QA_REVIEW_SECOND = JSON.stringify({
  thoughts: 'Vou verificar os dois casos de borda: ISBN duplicado → 422 ✓, autor ausente → erro de validação ✓. Ambos cobertos conforme a nota de T1.3 exigia. APPROVE.',
  messages: [
    {
      to:      'all',
      type:    'APPROVE',
      content: 'T1.3 aprovada. ISBN duplicado retorna 422 corretamente. Campo autor obrigatório validado na camada de modelo. Sprint 1 encerrada com qualidade.',
      refs:    ['T1.3'],
    },
  ],
});

// ─── Fixture com JSON embrulhado em markdown ──────────────────────────────────
// Simula o caso em que o modelo "explica" antes de dar o JSON,
// ignorando a instrução de responder apenas com JSON.

const VALID_INNER = {
  thoughts: 'Diego precisa revisar T3.2. Vou formatar minha solicitação corretamente.',
  messages: [
    {
      to: 'qa',
      type: 'REVIEW_REQUEST',
      content: 'Diego, T3.2 (Registrar empréstimo) está pronto para revisão. Implementei os fluxos de empréstimo, devolução e controle de prazo.',
      refs: ['T3.2'],
    },
  ],
};

const MARKDOWN_WRAPPED =
  `Claro! Aqui está minha resposta estruturada conforme o protocolo:\n\n` +
  '```json\n' +
  JSON.stringify(VALID_INNER) +
  '\n```\n\n' +
  `Aguardo a revisão do Diego.`;

// ─── Fixture com JSON malformado ──────────────────────────────────────────────
// Simula truncamento de resposta (string não fechada, objeto incompleto).

const MALFORMED_JSON =
  '{"thoughts": "Vou relatar meu progresso em T1.1.", "messages": [{"to": "pm", "type": "REPORT_PROGRESS", "content": "T1.1 está 70% concluído...}]}';

// ─── Fixture com schema inválido ──────────────────────────────────────────────
// JSON sintaticamente correto mas com tipo de mensagem fora do enum.
// Testa que o safeParse do schema zod rejeita corretamente.

const INVALID_SCHEMA = JSON.stringify({
  thoughts: 'Vou usar um tipo de mensagem customizado para urgência.',
  messages: [
    {
      to: 'dev1',
      type: 'URGENT_PING',   // não existe em MessageType
      content: 'T1.1 precisa ser entregue hoje!',
      refs: ['T1.1'],
    },
  ],
});

// ─── Exportações ──────────────────────────────────────────────────────────────

/**
 * Todas as fixtures disponíveis, acessíveis por chave.
 * Use FIXTURES.nome para selecionar uma fixture específica nos cenários.
 */
export const FIXTURES = {
  // ── PLANNING ──────────────────────────────────────────────────────────────
  pm_planning_open:   PM_PLANNING_OPEN,
  dev1_estimate:      DEV1_ESTIMATE,      // usa type ESTIMATE (fixture legada)
  dev2_estimate:      DEV2_ESTIMATE,      // usa type ESTIMATE (fixture legada)
  pm_decision:        PM_DECISION,
  qa_review_reject:   QA_REVIEW_REJECT,
  dev1_raise_blocker: DEV1_RAISE_BLOCKER,
  dev1_planning:      DEV1_PLANNING,      // usa type CHAT, conforme persona
  dev2_planning:      DEV2_PLANNING,      // usa type CHAT, conforme persona
  qa_planning:        QA_PLANNING,        // REQUEST_CLARIFICATION no PLANNING
  // ── EXECUTION — Sprint 1 ──────────────────────────────────────────────────
  pm_execution_open:  PM_EXECUTION_OPEN,  // PM inicia EXECUTION
  dev1_execution:     DEV1_EXECUTION,     // CLAIM_TASK T1.1 + REVIEW_REQUEST
  dev2_execution:     DEV2_EXECUTION,     // RAISE_BLOCKER T1.2 (ambiente)
  qa_execution:       QA_EXECUTION,       // CHAT confirmando revisão pendente
  // ── REVIEW — Sprint 1 ─────────────────────────────────────────────────────
  pm_review_open:     PM_REVIEW_OPEN,     // PM abre REVIEW, endereça QA
  qa_review_first:    QA_REVIEW_FIRST,    // APPROVE T1.1, REJECT T1.3
  pm_review_followup: PM_REVIEW_FOLLOWUP, // PM pede correção ao dev1
  dev1_resubmit:      DEV1_RESUBMIT,      // REVIEW_REQUEST T1.3 (resubmissão)
  pm_review_close:    PM_REVIEW_CLOSE,    // PM chama QA para segunda revisão
  qa_review_second:   QA_REVIEW_SECOND,   // APPROVE T1.3 → REVIEW_COMPLETE
  // ── Fixtures de teste de parser ───────────────────────────────────────────
  markdown_wrapped:   MARKDOWN_WRAPPED,
  malformed_json:     MALFORMED_JSON,
  invalid_schema:     INVALID_SCHEMA,
};

/**
 * Sequência padrão para o modo mock — apenas fixtures válidas,
 * usada quando o cliente não recebe mockFixtures explícitas.
 */
export const DEFAULT_SEQUENCE = [
  PM_PLANNING_OPEN,
  DEV1_ESTIMATE,
  DEV2_ESTIMATE,
  PM_DECISION,
  QA_REVIEW_REJECT,
  DEV1_RAISE_BLOCKER,
];
