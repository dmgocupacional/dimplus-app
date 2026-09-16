// ═══ BLOCO: GATE DE ACESSO ═══
//
// ⚠️  ISTO É UM STUB DE UI, NÃO É O GATE.
//
// O gate de verdade mora no BANCO: fn_cliente_pode(cliente, modulo), aplicada via RLS.
// Bloqueio de UI em app de saúde é cosmético — quem quiser furar, fura. O que este
// arquivo faz é uma coisa só: decidir se a tela mostra o módulo aberto ou cadeado.
//
// A álgebra abaixo é uma CÓPIA FIEL da do ROADMAP-APP. Ela existe aqui só porque, na
// FASE 1c, não há sessão autenticada — logo não há auth.uid(), logo não há RLS para
// consultar. Quando a 1b entrar, a fonte da verdade passa a ser o banco e este arquivo
// vira um cache de exibição, não uma decisão.
//
// REGRA: se a semântica de fn_cliente_pode mudar no banco, ESTE ARQUIVO MUDA JUNTO.
// Duplicação de regra de negócio é dívida — está assumida e datada (13/07/2026).

import type { AppAcesso, Fatura, Modulo, PagamentoStatus } from './types';

/** Status do Asaas que caracterizam inadimplência (espelha fn_cliente_adimplente). */
const STATUS_INADIMPLENTE: readonly PagamentoStatus[] = ['OVERDUE', 'DUNNING_REQUESTED'];

export function isAdimplente(faturas: readonly Fatura[]): boolean {
  return !faturas.some((f) => STATUS_INADIMPLENTE.includes(f.status));
}

export type MotivoBloqueio = 'sem_acesso' | 'modulo_desativado' | 'inadimplente' | null;

/**
 * acesso = app_acesso ∈ {liberado, suspenso}
 *          ∧ flag do módulo ligada
 *          ∧ (¬exige_pagamento ∨ (app_acesso = 'liberado' ∧ adimplente))
 */
// `elegivel` vem da fn_elegibilidade (via sessão) desde 16/09/2026 — não é mais só adimplência.
export function podeAcessar(
  acesso: AppAcesso,
  modulo: Modulo,
  elegivel: boolean
): { pode: boolean; motivo: MotivoBloqueio } {
  if (acesso === 'bloqueado') return { pode: false, motivo: 'sem_acesso' };
  if (!modulo.ativo) return { pode: false, motivo: 'modulo_desativado' };
  if (!modulo.exige_pagamento) return { pode: true, motivo: null };
  if (acesso === 'liberado' && elegivel) return { pode: true, motivo: null };
  return { pode: false, motivo: 'inadimplente' };
}

/** Selo de estado do plano — fonte única para o cartão (Início) e o Perfil. */
export function rotuloEstadoPlano(
  acesso: AppAcesso,
  elegivel: boolean,
  adimplente: boolean
): { texto: string; tom: 'ok' | 'aviso' | 'erro' } {
  if (acesso === 'bloqueado') return { texto: 'sem acesso', tom: 'erro' };
  if (acesso === 'suspenso') return { texto: 'suspenso', tom: 'aviso' };
  // Inelegível SEM fatura em aberto = plano cancelado/encerrado. "Em atraso" seria falso.
  if (!elegivel) return { texto: adimplente ? 'inativo' : 'em atraso', tom: 'erro' };
  return { texto: 'ativo', tom: 'ok' };
}

export function mensagemBloqueio(motivo: MotivoBloqueio): string {
  switch (motivo) {
    case 'sem_acesso':
      return 'Seu acesso ao app ainda não foi liberado.';
    case 'modulo_desativado':
      return 'Este serviço estará disponível em breve.';
    case 'inadimplente':
      return 'Benefício bloqueado. Veja a aba Financeiro ou fale com a central.';
    default:
      return '';
  }
}
// ── FIM BLOCO ──
