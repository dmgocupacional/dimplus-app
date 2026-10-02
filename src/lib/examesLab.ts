// ═══ BLOCO: RESULTADOS DO LABORATÓRIO (DB DIAGNÓSTICOS) ═══
// Sprint 1 (02/10/2026). Vem do erp (/api/app/exames-lab): pedidos do titular e dependentes,
// só os identificados com segurança (o erp decide quem vê). Laudo abre por link de 5 min.
import { chamarFeegow } from '@/lib/feegowApi';

export type EtapaTrilha = { chave: string; rotulo: string; em: string | null; feita: boolean };
export type ExameLab = { nome: string; pronto: boolean; etapas: EtapaTrilha[] };
export type PedidoLab = {
  id: string;
  paciente: string | null;
  dependente: boolean;
  coletado_em: string | null;
  exames: ExameLab[];
  laudo_disponivel: boolean;
};

export async function buscarExamesLab(): Promise<PedidoLab[] | null> {
  const r = await chamarFeegow<{ pedidos: PedidoLab[] }>('/api/app/exames-lab');
  return r.ok ? r.dados.pedidos : null;
}

export async function linkDoLaudo(pedidoId: string): Promise<string | null> {
  const r = await chamarFeegow<{ url: string }>('/api/app/exames-lab/link', { method: 'POST', body: { pedido_id: pedidoId } });
  return r.ok ? r.dados.url : null;
}

export async function laudoPorEmail(pedidoId: string): Promise<{ ok: true; para: string } | { ok: false; mensagem: string }> {
  const r = await chamarFeegow<{ para: string }>('/api/app/exames-lab/email', { method: 'POST', body: { pedido_id: pedidoId } });
  return r.ok ? { ok: true, para: r.dados.para } : { ok: false, mensagem: r.mensagem };
}
// ── FIM BLOCO ──
