// ═══ BLOCO: CAMADA DE DADOS ═══
//
// FASE 1b/SPRINT B — dados REAIS do Supabase, exceto a rede parceira (ver abaixo).
//
// O contrato desta camada não mudou desde a 1c: as assinaturas são as mesmas, e por isso
// nenhuma tela precisou ser reescrita quando o mock saiu. Era esse o ponto da indireção.
//
// ⚠️ TODA função aqui depende de SESSÃO. Sem `auth.uid()` o RLS da FASE 0 não devolve linha
// alguma — e devolver vazio é o comportamento CERTO, não um erro a ser tratado com retry.
// Conta recém-criada loga e não enxerga nada até o staff aprovar: quem chama tem que saber
// distinguir "sem sessão", "sessão sem cliente" (aguardando aprovação) e "sessão com cliente".

import { supabase } from './supabase';
import type {
  Cliente,
  Dependente,
  DependentesSituacao,
  Fatura,
  Modulo,
  ModuloKey,
  PagamentoStatus,
  UnidadeRede,
} from './types';

// ─── Cliente ────────────────────────────────────────────────────────────────
// A policy `clientes_app_own_select` filtra por `user_id = auth.uid()`, então não é preciso
// (nem possível) filtrar por id aqui. `maybeSingle` porque zero linhas é caso legítimo.
export async function getCliente(): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select(
      'id, nome, cpf_cnpj, telefone, app_acesso, data_adesao, created_at, subscription_next_due, titular_id, data_nascimento, planos:plano_id (nome)'
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // O embed do PostgREST vem como objeto ou array dependendo de como ele resolve a
  // cardinalidade da FK. Normalizar aqui evita `plano` virar "[object Object]" na tela.
  const planoRaw = (data as { planos?: { nome?: string | null } | { nome?: string | null }[] | null })
    .planos;
  const plano = Array.isArray(planoRaw) ? (planoRaw[0]?.nome ?? null) : (planoRaw?.nome ?? null);

  return {
    id: data.id,
    nome: data.nome ?? '',
    cpf: (data.cpf_cnpj ?? '').replace(/\D/g, ''),
    telefone: data.telefone ?? null,
    plano,
    app_acesso: (data.app_acesso ?? 'bloqueado') as Cliente['app_acesso'],
    membro_desde: data.data_adesao ?? data.created_at ?? '',
    proximo_vencimento: data.subscription_next_due ?? null,
    dependente: data.titular_id !== null,
    // NULL aqui é estado legítimo (271 clientes, incluindo TODOS os dependentes) — quem
    // consome usa `idadeEm`, que devolve null em vez de assumir idade. → BLOCO: IDADE E RESTRIÇÃO DE FAIXA
    data_nascimento: data.data_nascimento ?? null,
  };
}

// ─── Módulos ────────────────────────────────────────────────────────────────
// Duas tabelas: `app_features` (flag global, legível por qualquer autenticado) e
// `cliente_app_features` (override do próprio cliente). A precedência — override > global —
// é a MESMA definida em `fn_cliente_pode` no banco. Aqui ela só decide se a tela pinta cadeado;
// quem realmente barra a leitura é o RLS. Se a precedência mudar no banco, muda aqui junto.
export async function getModulos(): Promise<Modulo[]> {
  const [{ data: globais }, { data: overrides }] = await Promise.all([
    supabase.from('app_features').select('chave, nome, ativo, exige_pagamento, ordem').order('ordem'),
    supabase.from('cliente_app_features').select('chave, ativo'),
  ]);

  const porChave = new Map((overrides ?? []).map((o) => [o.chave, o.ativo]));

  return (globais ?? []).map((f) => {
    const override = porChave.get(f.chave);
    return {
      key: f.chave as ModuloKey,
      nome: f.nome ?? f.chave,
      // `null`/ausente = sem override = segue a flag global.
      ativo: override === null || override === undefined ? !!f.ativo : override,
      exige_pagamento: !!f.exige_pagamento,
    };
  });
}

// ─── Faturas ────────────────────────────────────────────────────────────────
// A policy de `pagamentos` já embute o gate do módulo `financeiro` E o casamento por
// `cliente_id OR customer_id = asaas_id` (827 pagamentos têm `cliente_id` NULL; 704 se
// recuperam pelo `asaas_id`). Não replicar esse OR aqui — perderia a metade recuperada.
//
// Dependente recebe lista VAZIA por construção: `asaas_id` é NULL e não há pagamento com o
// `cliente_id` dele. A tela trata; esta função não inventa fatura de titular.
// ═══ BLOCO: ELEGIBILIDADE ═══
// 16/09/2026 — a mesma régua do balcão (`fn_elegibilidade`), escopada no próprio cadastro pela
// `fn_minha_elegibilidade`. É ela que o servidor aplica nos módulos pagos (`fn_cliente_pode`);
// aqui serve só para a tela mostrar o estado certo. `null` = falha de rede: quem chama cai no
// cálculo antigo pelas faturas, e o servidor continua decidindo de verdade.
export type Elegibilidade = { elegivel: boolean; motivo: string };

export async function getElegibilidade(): Promise<Elegibilidade | null> {
  const { data, error } = await supabase.rpc('fn_minha_elegibilidade');
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const linha = data[0] as { elegivel?: unknown; motivo?: unknown };
  if (typeof linha.elegivel !== 'boolean') return null;
  return { elegivel: linha.elegivel, motivo: typeof linha.motivo === 'string' ? linha.motivo : '' };
}
// ── FIM BLOCO ──

export async function getFaturas(): Promise<Fatura[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, description, value, due_date, status, invoice_url, payment_link_url')
    .order('due_date', { ascending: false })
    .limit(24);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    // ⚠️ NÃO trocar por `?? 'Mensalidade'`. O `??` só cobre null/undefined, e a coluna nunca
    // é NULL: são 147 registros com `description` = STRING VAZIA (conferido em 17/08/2026,
    // `count(*) filter (where description is not null and btrim(description) = '')`).
    // Com `??` o fallback era letra morta e a linha da fatura renderizava título em branco.
    descricao: (p.description ?? '').trim() || 'Mensalidade',
    valor: Number(p.value ?? 0),
    vencimento: (p.due_date ?? '').slice(0, 10),
    // ⚠️ `status` vem CRU do Asaas — não há CHECK no banco. Um status novo do Asaas cairia
    // aqui sem aviso; o `rotuloStatus` da tela precisa continuar tolerando desconhecido.
    status: (p.status ?? 'PENDING') as PagamentoStatus,
    link_pagamento: p.payment_link_url ?? p.invoice_url ?? null,
  }));
}

// ─── Rede ───────────────────────────────────────────────────────────────────
// 24/09/2026 — FIM DO MOCK. Até aqui a tela mostrava cinco parceiros escritos à mão
// (Drogaria São Paulo, Droga Raia, Delboni…) sem parceria nenhuma por trás — e isso chegou a
// ir para a revisão da Apple na 4.23.0. A rede agora é só o que é real:
//   · as unidades DIMEG, lidas de `unidades` (sincronizada da Feegow; policy de leitura para
//     quem está logado criada nesta data);
//   · o localizador oficial de farmácias Vidalink e o clube de descontos, na própria tela.
// 🔴 Parceiro novo só entra com fonte real (tabela + cadastro no ERP). Não voltar a escrever
// nome de empresa aqui.
export async function getRede(): Promise<UnidadeRede[]> {
  const { data, error } = await supabase
    .from('unidades')
    .select('unidade_id, nome, endereco, numero, bairro, cidade, estado, cep, telefone, agendamento_online')
    .eq('ativo', true)
    .order('unidade_id');
  if (error || !data) return [];
  return data.map((u) => ({
    id: String(u.unidade_id),
    nome: nomeUnidade(u.nome ?? ''),
    endereco: [u.endereco, u.numero].filter(Boolean).join(', '),
    bairro: u.bairro ?? '',
    cidade: u.cidade ?? '',
    uf: u.estado ?? '',
    cep: u.cep ?? '',
    telefone: (u.telefone ?? '').replace(/\D/g, '') || null,
    agendaOnline: u.agendamento_online === true,
  }));
}

/** "DIMEG OSASCO (Rua João Crudo, 120)" → "DIMEG Osasco": o endereço já vai na linha de baixo. */
function nomeUnidade(bruto: string): string {
  const semParenteses = bruto.replace(/\s*\(.*\)\s*$/, '').trim();
  return semParenteses
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/\bDimeg\b/g, 'DIMEG')
    .replace(/\bIi\b/g, 'II')
    .replace(/\bClinica\b/g, 'Clínica'); // a Feegow grava sem acento
}
// ── FIM BLOCO ──

// ─── Dependentes (S-C) ──────────────────────────────────────────────────────
// Leitura pura. A inclusão (S-D) NÃO passa por aqui: ela vai virar solicitação com
// aprovação de staff, nunca INSERT direto em `clientes` pelo app.

export type MeusDependentes = {
  lista: Dependente[];
  situacao: DependentesSituacao | null;
};

/**
 * Dependentes do titular logado + a situação do plano.
 *
 * A RPC não recebe parâmetro de propósito (ver BLOCO: DEPENDENTES em types.ts).
 *
 * ⚠️ `situacao` é null quando a RPC não devolve linha, e isso acontece em DOIS casos
 * diferentes que a tela precisa distinguir do erro: titular sem nenhum dependente, e sessão
 * sem cliente vinculado. Nos dois, lista vazia é ESTADO CORRETO — não tentar retry.
 *
 * 🔴 Em 17/08/2026 NENHUM dos 18 titulares com dependentes tinha login (`user_id`), então
 * em produção esta tela nasce vazia em 100% dos casos reais. O estado vazio não é caminho
 * de exceção aqui: é o único caminho até o primeiro titular com dependente ganhar acesso.
 */
export async function getMeusDependentes(): Promise<MeusDependentes> {
  const { data, error } = await supabase.rpc('fn_app_meus_dependentes');

  if (error || !data || data.length === 0) return { lista: [], situacao: null };

  const linhas = data as {
    dependente_id: string;
    nome: string | null;
    parentesco: string | null;
    data_nascimento: string | null;
    app_acesso: string | null;
    limite: number | null;
    usados: number | null;
    pode_adicionar: boolean | null;
    politica: string | null;
    valor_unitario: number | string | null;
  }[];

  // A situação vem repetida em toda linha (cross join no banco). Ler da primeira.
  const p = linhas[0];
  const situacao: DependentesSituacao = {
    limite: p.limite ?? 0,
    usados: p.usados ?? linhas.length,
    pode_adicionar: p.pode_adicionar ?? false,
    politica: (p.politica ?? 'barrar') as DependentesSituacao['politica'],
    // `numeric` do Postgres chega como STRING no supabase-js — Number() aqui evita
    // "29.90" virar concatenação em vez de soma na tela.
    valor_unitario: Number(p.valor_unitario ?? 0),
  };

  const lista: Dependente[] = linhas.map((l) => ({
    id: l.dependente_id,
    nome: l.nome ?? '',
    parentesco: l.parentesco ?? null,
    data_nascimento: l.data_nascimento ?? null,
    app_acesso: (l.app_acesso ?? 'bloqueado') as Dependente['app_acesso'],
  }));

  return { lista, situacao };
}
// ── FIM BLOCO ──
