// ═══ BLOCO: TIPOS DE DOMÍNIO ═══
// Estes tipos espelham o schema REAL do Supabase (projeto bhrxfudnhxqntnnbgyjg),
// compartilhado com o erp-dimplus. A FASE 1c preenche com mock; a 1b troca a fonte
// sem que a forma mude. Se o schema mudar, mude AQUI primeiro.

/** clientes.app_acesso — default no banco é 'bloqueado'. */
export type AppAcesso = 'liberado' | 'suspenso' | 'bloqueado';

/** Chaves de app_features. São 8, fixas. */
export type ModuloKey =
  | 'cartao'
  | 'rede'
  | 'financeiro'
  | 'ajuda'
  | 'agendamento'
  | 'exames'
  | 'telemedicina'
  | 'sos';

export type Cliente = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  /** `planos.nome` via `clientes.plano_id`. O plano pode não estar preenchido no cadastro. */
  plano: string | null;
  app_acesso: AppAcesso;
  /** `data_adesao ?? created_at`. Não existe coluna dedicada. */
  membro_desde: string; // ISO
  /**
   * `clientes.subscription_next_due` — PRÓXIMO VENCIMENTO, não "validade do cartão".
   * ⚠️ Não existe coluna de validade no banco. O mock antigo tinha um campo `validade` que
   * não correspondia a nada; renomeado em 31/07 para não mentir no cartão. NULL é comum —
   * nesse caso o campo SOME da tela (cartão com validade em branco parece cartão vencido).
   *
   * ⚠️ ATÉ 17/08/2026 ESTE COMENTÁRIO EXPLICAVA O NULL COMO "dependente não tem assinatura
   * própria". O dado desmente: são 385 clientes com NULL (48% da base) e apenas 44
   * dependentes — a explicação não cobre os outros 341. A causa real do grosso dos NULLs
   * NÃO foi apurada. Não reintroduzir a explicação antiga; ela induz a concluir que o campo
   * só falta para dependente, o que levaria a tratar 341 casos como anomalia.
   */
  proximo_vencimento: string | null; // ISO
  /**
   * `titular_id IS NOT NULL`. Dependente não tem financeiro próprio: `asaas_id` é NULL, a
   * policy de `pagamentos` casa por `cliente_id OR customer_id = asaas_id` e não devolve nada.
   * Lista vazia aqui é ESTADO CORRETO, não falha de carregamento.
   */
  dependente: boolean;
  /**
   * `clientes.data_nascimento` (ISO `AAAA-MM-DD`) — coluna criada em 17/08/2026. Antes disso
   * NÃO existia nascimento em nenhuma tabela do banco, e sem ele o `age_restriction` da
   * Feegow não podia ser aplicado.
   *
   * ⚠️ NULL é comum e NÃO é falha: 271 dos 809 clientes seguem sem data (são os sem
   * `feegow_paciente_id`, de onde vem a semente) — e os 44 DEPENDENTES estão TODOS aí.
   * Ver `data_nascimento_fonte` no banco para distinguir "nunca tentamos" de "a origem não
   * tinha". Consumir sempre via `idadeEm`, que devolve `null` em vez de chutar.
   */
  data_nascimento: string | null;
};

/** app_features (flag global) já resolvida com o override de cliente_app_features. */
export type Modulo = {
  key: ModuloKey;
  nome: string;
  ativo: boolean;
  exige_pagamento: boolean;
};

/**
 * pagamentos.status vem CRU do Asaas — não há CHECK no banco.
 * Ver ROADMAP-APP § Fronteira, item 5: status novo do Asaas muda o gate sem avisar.
 *
 * ⚠️ ESTA LISTA JÁ MENTIU UMA VEZ. Até 17/08/2026 declarava só 5 valores enquanto a
 * produção tinha 9 — e o `as PagamentoStatus` do data.ts fazia o TypeScript aceitar a
 * mentira em silêncio. Resultado: `rotuloStatus` caía fora do switch, devolvia undefined
 * e a aba Financeiro morria em tela preta para 807 pagamentos (v0.3.3).
 *
 * A união é ABERTA de propósito (`| (string & {})`): a coluna é `text` sem constraint, um
 * status novo do Asaas entra sem aviso, e o consumidor precisa ser obrigado pelo TS a ter
 * um caminho de fallback. NÃO fechar esta união.
 */
export type PagamentoStatusConhecido =
  | 'RECEIVED'
  | 'RECEIVED_IN_CASH'
  | 'CONFIRMED'
  | 'PENDING'
  | 'OVERDUE'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'REFUNDED'
  | 'DELETED';

export type PagamentoStatus = PagamentoStatusConhecido | (string & {});

export type Fatura = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string; // ISO
  status: PagamentoStatus;
  link_pagamento: string | null;
};

export type Parceiro = {
  id: string;
  nome: string;
  categoria: 'Farmácia' | 'Clínica' | 'Laboratório' | 'Odontologia';
  beneficio: string;
  endereco: string;
  cidade: string;
};
// ── FIM BLOCO ──

// ═══ BLOCO: DEPENDENTES (S-C) ═══
// Espelha `fn_app_meus_dependentes()`. A RPC é SECURITY DEFINER e NÃO recebe parâmetro:
// o titular sai do `auth.uid()` DENTRO da função. Isso é deliberado — `fn_dependentes_situacao`
// recebe o titular como argumento e, com EXECUTE aberto, permitia ler o de OUTRA pessoa
// (corrigido em 17/08 por REVOKE). Se algum dia alguém for "simplificar" chamando a função
// do banco direto do app: NÃO. É esse parâmetro que era o furo.

/**
 * Um dependente do titular logado, com a situação do plano JÁ RESOLVIDA pelo banco.
 *
 * ⚠️ Só dado CADASTRAL. Nunca exame, agenda ou financeiro: por decisão de 17/08/2026 o
 * dependente MAIOR de idade tem login próprio e o titular PERDE acesso aos resultados dele.
 * Não acrescentar campo clínico aqui sem rever essa decisão.
 */
export type Dependente = {
  id: string;
  nome: string;
  /** Lista fixa no ERP (v0.155.1). Pode ser null em cadastro antigo. */
  parentesco: string | null;
  /**
   * ⚠️ NULL é o caso NORMAL, não exceção: em 17/08/2026 os 44 dependentes da base estavam
   * TODOS sem data — eles são justamente os que não têm `feegow_paciente_id`, de onde veio a
   * semente do backfill. Sem data não dá para classificar menor/maior; não assumir nenhum
   * dos dois. Ver `idadeEm` em `src/lib/idade.ts`.
   */
  data_nascimento: string | null;
  app_acesso: AppAcesso;
};

/**
 * Situação do plano do titular quanto a dependentes. Vem de `fn_dependentes_situacao` no
 * banco — ⚠️ NUNCA recalcular limite ou valor no app: os números são editáveis em
 * `/dashboard/planos` do ERP e hardcodar aqui os congela (INVARIANTES.md §5 do erp-dimplus).
 */
export type DependentesSituacao = {
  limite: number;
  usados: number;
  /**
   * Já considera a política do plano: `false` quando é `barrar` e o limite estourou.
   * Quando é `cobrar`, vem `true` MESMO no limite — e aí o próximo dependente custa
   * `valor_unitario` por mês. A tela tem que dizer o valor ANTES de deixar solicitar.
   */
  pode_adicionar: boolean;
  politica: 'cobrar' | 'barrar' | (string & {});
  valor_unitario: number;
};
// ── FIM BLOCO ──

// ═══ BLOCO: EXAMES (S2-L2) ═══
// Espelha as rotas `/api/feegow/exames/*` do erp-dimplus. O dado é CRU da Feegow — a
// própria rota do erp já filtra por paciente (posse embutida no `paciente_id` da guarda).

/**
 * Pedido de exame solicitado (`GET .../exames/pedidos` → `{ pedidos: [...] }`).
 *
 * ⚠️ Campos confirmados no erp-dimplus (`docs/FEEGOW-API.md`): `PedidoExameID`,
 * `PacienteID`, `ExameID`, `DataPedido` (`"AAAA-MM-DD HH:MM:SS"`), `ObservacaoPedido`
 * (HTML embutido). **NÃO existe campo de nome do exame confirmado em nenhum lugar do
 * repo do erp** — a doc usa reticências (`ExameID...`) sem listar o resto. `nome` aqui
 * vem de tentativa defensiva de vários nomes de campo candidatos (ver `src/lib/exames.ts`)
 * e é `null` quando nenhum bate — a tela cai para "Exame #{exameId}" nesse caso.
 */
export type PedidoExame = {
  id: number;
  exameId: number | null;
  nome: string | null;
  /** `DataPedido` cru, `"AAAA-MM-DD HH:MM:SS"` — sem parse de Date (evita bug de fuso). */
  dataPedido: string | null;
  /** `ObservacaoPedido` já sem tags HTML. */
  observacao: string | null;
};

/**
 * Laudo pronto (`GET .../exames/laudos` → `{ laudos: [...] }`).
 * Shape CONFIRMADO ao vivo (`docs/FEEGOW-API.md`): `{lab_report_id, request_date,
 * lab_report_date, patient_name}`, datas em `Y-m-d`.
 */
export type Laudo = {
  labReportId: number;
  dataPedido: string | null; // request_date
  dataLaudo: string | null; // lab_report_date
};
// ── FIM BLOCO ──

// ═══ BLOCO: AGENDAMENTO (S2-L3) ═══
// Espelha as rotas `/api/feegow/agendamento*` do erp-dimplus. Dado CRU da Feegow — a
// rota do erp só repassa `content`. Shapes CONFIRMADOS ao vivo em 19/08/2026 (não
// presumidos da doc), exceto `MeuAgendamento` (ver comentário no próprio tipo).

/** `opcoes.especialidades[]`. Só `exibir_agendamento_online === 1` deve aparecer pro
 * cliente — as demais são internas (convênio, retorno etc.), fora do escopo do app. */
export type Especialidade = {
  id: number;
  nome: string;
  exibirAgendamentoOnline: boolean;
};

/** `opcoes.unidades.{matriz,unidades}[]` — as duas listas são concatenadas na leitura;
 * a distinção matriz/filial não importa pro cliente escolher onde ir. */
export type Unidade = {
  id: number;
  nomeFantasia: string;
  cidade: string;
  bairro: string;
};

/** `opcoes.locais[]`. `local_id` é SALA, não unidade — nunca mostrar direto ao cliente.
 * Salas 26/27 (`local: "importado"`) são lixo de import e são filtradas na leitura,
 * nunca chegam a este tipo. */
export type LocalAgenda = {
  id: number;
  unidadeId: number;
};

/** `opcoes.profissionais[]`. `ageRestriction` já normalizado por `lerRestricaoIdade`
 * (`idade.ts`) — ver `FaixaIdade`. */
export type Profissional = {
  id: number;
  nome: string;
  tratamento: string | null;
  especialidadeIds: number[];
};

/** Um horário livre, já achatado e agrupado por unidade (nunca por sala) a partir do
 * shape aninhado de `disponibilidade` (profissional → local → data → horários). Salas
 * 26/27 já foram excluídas antes de chegar aqui. */
export type SlotDisponibilidade = {
  profissionalId: number;
  localId: number;
  unidadeId: number;
  data: string; // AAAA-MM-DD
  horario: string; // HH:MM:SS
};

/**
 * Um item de "meus agendamentos" (`GET /api/feegow/agendamento` → `{ agendamentos: [...] }`).
 *
 * ⚠️ Shape do item **NÃO CONFIRMADO ao vivo** — a conta de teste não tem cadastro na
 * clínica (404, mesmo caso de `exames`), então nunca vimos um agendamento real. O próprio
 * `app-feegow-guard.ts` do erp trata o id como incerto (`agendamento_id` ou
 * `id_agendamento` ou `id` ou `appoint_id`) — sigo a mesma defesa aqui, não invento campo
 * novo. `status`/`data`/`horario`/`profissionalNome` são melhor esforço; `null` quando o
 * candidato não bate, e a tela precisa tolerar isso.
 */
export type MeuAgendamento = {
  id: number;
  profissionalId: number | null;
  data: string | null;
  horario: string | null;
  statusId: number | null;
  profissionalNome: string | null;
  especialidadeNome: string | null;
};

/**
 * `GET /api/feegow/agendamento/procedimentos` (S2-L4b, erp-dimplus v0.258.0) →
 * `{ especialidades, procedimentos, consulta_por_especialidade }`. Preço JÁ na tabela
 * DIM+ (o erp resolve isso, o app nunca vê o particular).
 *
 * ⚠️ `consultaPorEspecialidade` só tem entrada pras especialidades com vínculo OFICIAL
 * confiável na Feegow — o erp já descarta o `consulta_id` default errado (30 das 39
 * especialidades apontavam pro mesmo procedimento genérico antes desse tratamento).
 * Especialidade AUSENTE do mapa = sem caminho de "criar" pelo app pra ela ainda; não
 * inventar procedimento nesse caso.
 */
export type CatalogoProcedimentos = {
  especialidades: { id: number; nome: string }[];
  procedimentos: { id: number; nome: string; valor_centavos?: number }[];
  consultaPorEspecialidade: Map<number, number>;
};
// ── FIM BLOCO ──
