// ═══ BLOCO: EXAMES (S2-L2) ═══
//
// Primeiro consumidor real de `chamarFeegow` (S2-L1). Deliberadamente SEPARADO de
// `data.ts`: `data.ts` fala com o Supabase direto (RLS decide o que aparece); este
// arquivo fala HTTP autenticado com o erp-dimplus (a guarda de lá decide). Misturar as
// duas fontes no mesmo arquivo esconderia qual caminho cada função usa.
//
// Leitura pura — sem escrita, sem `age_restriction` (isso é só do S2-L3, agendamento).

import { chamarFeegow, type FeegowResultado } from './feegowApi';
import type { Laudo, PedidoExame } from './types';

// ─── Pedidos de exame ───────────────────────────────────────────────────────

/**
 * Tentativa defensiva de achar o nome do exame no item cru da Feegow. Não há campo
 * confirmado — ver comentário em `types.ts` (`PedidoExame.nome`). Mesmo padrão de
 * `extrairIdsAgendamento` em `app-feegow-guard.ts` do erp: candidatos em ordem, primeiro
 * que bater vence, nenhum bate → null (a tela cai para "Exame #id").
 */
function extrairNomeExame(item: Record<string, unknown>): string | null {
  for (const chave of ['ExameNome', 'NomeExame', 'Exame', 'Procedimento', 'NomeProcedimento']) {
    const v = item[chave];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function paraNumero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** Remove tags HTML de `ObservacaoPedido` — o RN `Text` não interpreta HTML; renderizar
 * cru mostraria `<p>`, `<br>` etc. na tela. Não é sanitização de segurança (o texto não
 * vira HTML de novo em lugar nenhum), só limpeza de exibição. */
function semHtml(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpo = v
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return limpo || null;
}

function normalizarPedido(item: unknown): PedidoExame | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = paraNumero(o.PedidoExameID);
  if (id === null) return null; // sem id não dá pra usar como key nem confiar no item
  return {
    id,
    exameId: paraNumero(o.ExameID),
    nome: extrairNomeExame(o),
    dataPedido: typeof o.DataPedido === 'string' ? o.DataPedido : null,
    observacao: semHtml(o.ObservacaoPedido),
  };
}

export async function getPedidosExame(): Promise<FeegowResultado<PedidoExame[]>> {
  const r = await chamarFeegow<{ pedidos: unknown }>('/api/feegow/exames/pedidos');
  if (!r.ok) return r;
  const lista = Array.isArray(r.dados.pedidos) ? r.dados.pedidos : [];
  return { ok: true, dados: lista.map(normalizarPedido).filter((p): p is PedidoExame => p !== null) };
}

// ─── Laudos prontos ─────────────────────────────────────────────────────────

function normalizarLaudo(item: unknown): Laudo | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const labReportId = paraNumero(o.lab_report_id);
  if (labReportId === null) return null;
  return {
    labReportId,
    dataPedido: typeof o.request_date === 'string' ? o.request_date : null,
    dataLaudo: typeof o.lab_report_date === 'string' ? o.lab_report_date : null,
  };
}

export async function getLaudos(): Promise<FeegowResultado<Laudo[]>> {
  const r = await chamarFeegow<{ laudos: unknown }>('/api/feegow/exames/laudos');
  if (!r.ok) return r;
  const lista = Array.isArray(r.dados.laudos) ? r.dados.laudos : [];
  return { ok: true, dados: lista.map(normalizarLaudo).filter((l): l is Laudo => l !== null) };
}

/**
 * URL assinada (S3) do PDF do laudo. Expira em ~20min — chamar na hora de abrir, nunca
 * cachear a URL (só o `labReportId` é reutilizável).
 */
export async function getUrlLaudo(labReportId: number): Promise<FeegowResultado<string>> {
  const r = await chamarFeegow<{ arquivo: { url?: unknown } }>(
    `/api/feegow/exames/laudo/arquivo?lab_report_id=${labReportId}`
  );
  if (!r.ok) return r;
  const url = r.dados.arquivo?.url;
  if (typeof url !== 'string' || !url) {
    return { ok: false, tipo: 'erro_servidor', mensagem: 'Não foi possível obter o link do laudo.' };
  }
  return { ok: true, dados: url };
}
// ── FIM BLOCO ──
