// ═══ BLOCO: FARMÁCIAS VIDALINK (DADOS) ═══
// 28/09/2026. A rede do convênio DIMEG, pedida ao erp (/api/app/farmacias), que lê o localizador
// público da Vidalink e guarda em cache. Sem API oficial: se o erp não conseguir ler, a tela
// oferece o localizador da Vidalink (/farmacias-vidalink) como plano B.
// → erp: src/lib/vidalink-localizador.ts
import { chamarFeegow } from '@/lib/feegowApi';

export type Farmacia = {
  rede: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string | null;
  referencia: string | null;
  aberta24h: boolean;
};

export type ListaFarmacias = {
  uf: string;
  cidade: string;
  farmacias: Farmacia[];
  atualizado_em: string;
  desatualizado: boolean;
};

export type ResultadoFarmacias =
  | { ok: true; dados: ListaFarmacias }
  | { ok: false; precisaCidade: boolean; mensagem: string };

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

/** Sem cidade: o erp usa a do cadastro. */
export async function buscarFarmacias(local?: { uf: string; cidade: string }): Promise<ResultadoFarmacias> {
  const qs = local ? `?uf=${encodeURIComponent(local.uf)}&cidade=${encodeURIComponent(local.cidade)}` : '';
  const r = await chamarFeegow<ListaFarmacias>(`/api/app/farmacias${qs}`);
  if (r.ok) return { ok: true, dados: r.dados };
  return { ok: false, precisaCidade: r.status === 422, mensagem: r.mensagem };
}

export async function buscarCidades(uf: string): Promise<{ ok: true; cidades: string[] } | { ok: false; mensagem: string }> {
  const r = await chamarFeegow<{ cidades: string[] }>(`/api/app/farmacias/cidades?uf=${encodeURIComponent(uf)}`);
  return r.ok ? { ok: true, cidades: r.dados.cidades } : { ok: false, mensagem: r.mensagem };
}

/** Comparação sem acento e sem caixa, para a busca da tela. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
// ── FIM BLOCO ──
