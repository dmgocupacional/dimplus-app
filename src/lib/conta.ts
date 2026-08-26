// ═══ BLOCO: CONTA — EXCLUSÃO (EXIGÊNCIA DE LOJA) ═══
// 26/08/2026. Apple App Review 5.1.1(v) e Google Play exigem que um app com login permita
// excluir a conta DE DENTRO DO APP. Sem isto o app é reprovado na review.
//
// Reaproveita `chamarFeegow` de propósito: o nome fala de Feegow por herança do S2-L1, mas o
// que o helper faz é "chamar o erp-dimplus com o Bearer da sessão e mapear o erro", que é
// exatamente o necessário aqui. Criar um segundo helper duplicaria o mapeamento de status e
// a leitura da sessão — os dois lugares mais fáceis de divergir em silêncio.
//
// 🔴 A rota do erp SUSPENDE o acesso e desvincula o login; ela NÃO apaga o cadastro, porque
// contrato, pagamentos e prontuário têm retenção legal. O texto da tela e o de
// /privacidade dizem isso ao usuário — se a rota mudar, os dois textos mudam junto.
import { chamarFeegow } from './feegowApi';

export type ResultadoExclusao =
  | { ok: true }
  | { ok: false; mensagem: string };

export async function excluirMinhaConta(motivo?: string): Promise<ResultadoExclusao> {
  const r = await chamarFeegow<{ ok: boolean }>('/api/app/conta/excluir', {
    method: 'POST',
    body: { motivo: motivo?.trim() || undefined },
  });
  if (r.ok) return { ok: true };
  return { ok: false, mensagem: r.mensagem };
}
// ── FIM BLOCO ──
