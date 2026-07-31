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
   * não correspondia a nada; renomeado em 31/07 para não mentir no cartão. NULL é comum
   * (dependente não tem assinatura própria) — nesse caso o campo some da tela.
   */
  proximo_vencimento: string | null; // ISO
  /**
   * `titular_id IS NOT NULL`. Dependente não tem financeiro próprio: `asaas_id` é NULL, a
   * policy de `pagamentos` casa por `cliente_id OR customer_id = asaas_id` e não devolve nada.
   * Lista vazia aqui é ESTADO CORRETO, não falha de carregamento.
   */
  dependente: boolean;
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
 */
export type PagamentoStatus =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'PENDING'
  | 'OVERDUE'
  | 'DUNNING_REQUESTED';

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
