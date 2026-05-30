/**
 * backlog.js
 *
 * Definição estática do backlog do projeto BiblioPessoal.
 * Este arquivo é APENAS dado — nenhuma lógica aqui.
 *
 * As dependências, riscos e ambiguidades são intencionais (ver README):
 * elas foram projetadas para estressar a dinâmica da equipe simulada.
 *
 * Esquema de ID: T{sprint}.{n} — ex: T1.1 = primeira tarefa do épico da Sprint 1.
 * Campos `epic` e `sprint` são metadados para os agentes; o Blackboard os ignora.
 */

/**
 * Backlog granular do BiblioPessoal — 5 épicos, 18 tarefas executáveis.
 * Cada item: { id, title, epic, sprint, dependsOn, note }
 *
 * @type {Array<{ id: string, title: string, epic: string, sprint: number, dependsOn: string[], note: string|null }>}
 */
export const BACKLOG = [
  // ── Sprint 1 — Cadastro e listagem de livros ──────────────────────────────
  {
    id:        'T1.1',
    title:     'Modelar schema de livros',
    epic:      'Cadastro e listagem de livros',
    sprint:    1,
    dependsOn: [],
    note:      'Fundação da Sprint 1 — nenhuma outra tarefa de cadastro pode começar antes disto.',
  },
  {
    id:        'T1.2',
    title:     'CRUD de cadastro de livro',
    epic:      'Cadastro e listagem de livros',
    sprint:    1,
    dependsOn: ['T1.1'],
    note:      null,
  },
  {
    id:        'T1.3',
    title:     'Validação de entrada (ISBN único, campos obrigatórios)',
    epic:      'Cadastro e listagem de livros',
    sprint:    1,
    dependsOn: ['T1.2'],
    note:      'Risco plantado: ISBN duplicado ou vazio deve ser rejeitado — caso de borda de qualidade.',
  },
  {
    id:        'T1.4',
    title:     'Listagem de livros com paginação',
    epic:      'Cadastro e listagem de livros',
    sprint:    1,
    dependsOn: ['T1.1'],
    note:      null,
  },

  // ── Sprint 2 — Integração com API de metadados ────────────────────────────
  {
    id:        'T2.1',
    title:     'Cliente HTTP para API externa de metadados',
    epic:      'Integração com API de metadados',
    sprint:    2,
    dependsOn: ['T1.1'],
    note:      null,
  },
  {
    id:        'T2.2',
    title:     'Preenchimento automático de metadados por ISBN',
    epic:      'Integração com API de metadados',
    sprint:    2,
    dependsOn: ['T2.1'],
    note:      null,
  },
  {
    id:        'T2.3',
    title:     'Tratamento de falha/timeout da API externa',
    epic:      'Integração com API de metadados',
    sprint:    2,
    dependsOn: ['T2.1'],
    note:      'Risco plantado: API de terceiros pode ficar instável ou indisponível — exige fallback definido.',
  },
  {
    id:        'T2.4',
    title:     'Cache local de metadados',
    epic:      'Integração com API de metadados',
    sprint:    2,
    dependsOn: ['T2.2'],
    note:      null,
  },

  // ── Sprint 3 — Empréstimo a amigos ────────────────────────────────────────
  {
    id:        'T3.1',
    title:     'Modelar entidade de empréstimo',
    epic:      'Empréstimo a amigos',
    sprint:    3,
    dependsOn: ['T1.2'],
    note:      null,
  },
  {
    id:        'T3.2',
    title:     'Registrar empréstimo',
    epic:      'Empréstimo a amigos',
    sprint:    3,
    dependsOn: ['T3.1'],
    note:      'Risco plantado: emprestar um livro já emprestado deve ser impedido — caso de borda.',
  },
  {
    id:        'T3.3',
    title:     'Registrar devolução',
    epic:      'Empréstimo a amigos',
    sprint:    3,
    dependsOn: ['T3.2'],
    note:      null,
  },
  {
    id:        'T3.4',
    title:     'Histórico de empréstimos por livro e por amigo',
    epic:      'Empréstimo a amigos',
    sprint:    3,
    dependsOn: ['T3.2'],
    note:      null,
  },

  // ── Sprint 4 — Sistema de recomendações ───────────────────────────────────
  {
    id:        'T4.1',
    title:     'Definir critério de recomendação',
    epic:      'Sistema de recomendações',
    sprint:    4,
    dependsOn: [],
    note:      'Risco plantado: critério de recomendação NÃO definido — força negociação de escopo entre PM, devs e QA antes de estimar ou executar.',
  },
  {
    id:        'T4.2',
    title:     'Implementar motor de recomendação',
    epic:      'Sistema de recomendações',
    sprint:    4,
    dependsOn: ['T4.1'],
    note:      null,
  },
  {
    id:        'T4.3',
    title:     'Endpoint de recomendações',
    epic:      'Sistema de recomendações',
    sprint:    4,
    dependsOn: ['T4.2'],
    note:      null,
  },

  // ── Sprint 5 — Relatório mensal ───────────────────────────────────────────
  {
    id:        'T5.1',
    title:     'Agregação de dados de acervo e empréstimos',
    epic:      'Relatório mensal',
    sprint:    5,
    dependsOn: ['T1.1', 'T3.2'],
    note:      'Dupla dependência (acervo + empréstimos) — cria pressão de cronograma na sprint final.',
  },
  {
    id:        'T5.2',
    title:     'Geração do relatório mensal',
    epic:      'Relatório mensal',
    sprint:    5,
    dependsOn: ['T5.1'],
    note:      null,
  },
  {
    id:        'T5.3',
    title:     'Exportação e visualização do relatório',
    epic:      'Relatório mensal',
    sprint:    5,
    dependsOn: ['T5.2'],
    note:      'Risco plantado: mês sem dados deve gerar relatório vazio coerente, não erro — caso de borda.',
  },
];
