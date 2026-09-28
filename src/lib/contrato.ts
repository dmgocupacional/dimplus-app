// ═══ BLOCO: CONTRATO — TERMO PENDENTE E ACEITE ═══
// 26/08/2026. O associado do SUEESSOR (e qualquer beneficiário) aceita o termo aqui, e é o
// aceite que dispara a cobrança do lado do erp.
//
// 🔴 O TEXTO NUNCA MORA NO APP. Vem de `/api/app/contrato/pendente` a cada abertura da tela.
// Um binário de loja fica congelado por semanas e o usuário atualiza quando quer — texto
// embutido coletaria aceite de uma versão que não está mais publicada, e o `hash` do termo
// existe justamente para provar o que foi aceito.
import { chamarFeegow } from './feegowApi';

export type DiaVencimento = 10 | 20 | 30;
export type FormaPagamento = 'BOLETO' | 'PIX' | 'CREDIT_CARD';

export type TermoPendente = {
  pendente: boolean;
  /** 28/09/2026 — quem paga. 'empresa' (plano faturado) e 'sem_custo' não escolhem vencimento. */
  custeio?: 'pessoa' | 'empresa' | 'sem_custo';
  entidade_nome?: string | null;
  /** true = a caixa de consentimento de saúde separada é obrigatória. */
  exige_consentimento_saude?: boolean;
  termo?: { id: string; versao: string; texto: string };
  plano?: { nome: string; valor_mensal: number; valor_adesao: number };
};

export async function buscarTermoPendente(): Promise<TermoPendente | null> {
  const r = await chamarFeegow<TermoPendente>('/api/app/contrato/pendente');
  // Falha de rede NÃO vira "não há termo": devolver `{pendente:false}` aqui esconderia a
  // pendência e o beneficiário usaria o app sem nunca aceitar nada. null = desconhecido.
  return r.ok ? r.dados : null;
}

export type ResultadoAceite =
  | { ok: true; cobranca: 'assinatura' | 'entidade' | 'pendente'; aviso?: string }
  | { ok: false; mensagem: string };

export async function aceitarTermo(opcoes: {
  /** Só quando a pessoa paga. */
  dia?: DiaVencimento;
  forma?: FormaPagamento;
  /** Caixa separada de dados de saúde (termo empresarial 9.8). */
  consentimentoSaude?: boolean;
}): Promise<ResultadoAceite> {
  const r = await chamarFeegow<{ ok: boolean; cobranca?: string; aviso?: string }>(
    '/api/app/contrato/aceite',
    {
      method: 'POST',
      body: {
        ...(opcoes.dia ? { dia_vencimento: opcoes.dia } : {}),
        ...(opcoes.forma ? { forma_pagamento: opcoes.forma } : {}),
        ...(opcoes.consentimentoSaude !== undefined ? { consentimento_saude: opcoes.consentimentoSaude } : {}),
      },
    },
  );
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  return {
    ok: true,
    cobranca: (r.dados.cobranca as 'assinatura' | 'entidade' | 'pendente') ?? 'pendente',
    aviso: r.dados.aviso,
  };
}
// ── FIM BLOCO ──
