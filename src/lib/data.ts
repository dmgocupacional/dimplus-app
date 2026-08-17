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
import type { Cliente, Fatura, Modulo, ModuloKey, Parceiro, PagamentoStatus } from './types';

// ─── Cliente ────────────────────────────────────────────────────────────────
// A policy `clientes_app_own_select` filtra por `user_id = auth.uid()`, então não é preciso
// (nem possível) filtrar por id aqui. `maybeSingle` porque zero linhas é caso legítimo.
export async function getCliente(): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select(
      'id, nome, cpf_cnpj, telefone, app_acesso, data_adesao, created_at, subscription_next_due, titular_id, planos:plano_id (nome)'
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

// ─── Rede parceira ──────────────────────────────────────────────────────────
// 🟡 AINDA MOCK, E DE PROPÓSITO. Não existe tabela de parceiros no banco (conferido no
// schema em 31/07/2026: nada com `parceir%`/`rede%`). Criar uma agora, sem CRUD no ERP,
// pariria uma tabela órfã — alguém teria que inserir farmácia por SQL, e o primeiro parceiro
// novo já quebraria o processo. O par certo é `tabela + tela em /dashboard/parceiros + policy
// de leitura pro cliente`, e isso é lote do erp-dimplus, não do app.
//
// Enquanto isso a tela mostra estes cinco com rodapé honesto ("rede em expansão").
// Decisão do Henrique, 31/07/2026.
const PARCEIROS: Parceiro[] = [
  {
    id: 'p1',
    nome: 'Drogaria São Paulo',
    categoria: 'Farmácia',
    beneficio: 'Até 30% em genéricos',
    endereco: 'Av. dos Autonomistas, 1400',
    cidade: 'Osasco',
  },
  {
    id: 'p2',
    nome: 'Droga Raia',
    categoria: 'Farmácia',
    beneficio: 'Até 25% em medicamentos',
    endereco: 'R. Antônio Agu, 210',
    cidade: 'Osasco',
  },
  {
    id: 'p3',
    nome: 'Clínica DMG Ocupacional',
    categoria: 'Clínica',
    beneficio: 'Consulta com valor reduzido',
    endereco: 'R. Narciso Sturlini, 88',
    cidade: 'Osasco',
  },
  {
    id: 'p4',
    nome: 'Laboratório Delboni',
    categoria: 'Laboratório',
    beneficio: 'Exames a partir de R$ 19',
    endereco: 'Av. Hilário Pereira de Souza, 500',
    cidade: 'Osasco',
  },
  {
    id: 'p5',
    nome: 'OdontoCare Itapevi',
    categoria: 'Odontologia',
    beneficio: 'Limpeza + avaliação sem custo',
    endereco: 'Av. Pres. Vargas, 77',
    cidade: 'Itapevi',
  },
];

export async function getRede(): Promise<Parceiro[]> {
  return PARCEIROS;
}

/** A tela usa isto para mostrar o rodapé de "rede em expansão" sem chutar o motivo. */
export const REDE_E_MOCK = true;
// ── FIM BLOCO ──
