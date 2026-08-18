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
