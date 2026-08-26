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

export async function aceitarTermo(
  dia: DiaVencimento,
  forma: FormaPagamento,
): Promise<ResultadoAceite> {
  const r = await chamarFeegow<{ ok: boolean; cobranca?: string; aviso?: string }>(
    '/api/app/contrato/aceite',
    { method: 'POST', body: { dia_vencimento: dia, forma_pagamento: forma } },
  );
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  return {
    ok: true,
    cobranca: (r.dados.cobranca as 'assinatura' | 'entidade' | 'pendente') ?? 'pendente',
    aviso: r.dados.aviso,
  };
}
// ── FIM BLOCO ──
