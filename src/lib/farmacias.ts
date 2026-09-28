// ═══ BLOCO: FARMÁCIAS VIDALINK (DADOS) ═══
// 28/09/2026. A rede do convênio DIMEG, pedida ao erp (/api/app/farmacias), que lê o localizador
// público da Vidalink e guarda em cache. Sem API oficial: se o erp não conseguir ler, a tela
// oferece o localizador da Vidalink (/farmacias-vidalink) como plano B.
// → erp: src/lib/vidalink-localizador.ts
import { requireOptionalNativeModule } from 'expo';

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
  /** Coordenada geocodificada pelo erp. `null` = ainda não calculada ou não achada. */
  lat: number | null;
  lon: number | null;
  /** 'bairro' = aproximada (só o bairro foi achado). */
  precisao: 'endereco' | 'bairro' | 'nenhum' | null;
};

export type ListaFarmacias = {
  uf: string;
  cidade: string;
  farmacias: Farmacia[];
  /** Quantas ainda estão sem coordenada (o erp calcula aos poucos, depois da resposta). */
  geocode_pendente: number;
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

// ═══ LOCALIZAÇÃO DO CELULAR (28/09/2026) ═══
// Para abrir na cidade onde a pessoa ESTÁ e ordenar por distância. `expo-location` é nativo:
// carregado tarde e só se existir no binário (a 4.0.1 da loja não tem) — mesmo padrão do SOS.
const temLocalizacao = requireOptionalNativeModule('ExpoLocation') != null;

export type Posicao = { lat: number; lon: number };
export type Localizacao =
  | { tipo: 'ok'; pos: Posicao; uf: string | null; cidade: string | null }
  | { tipo: 'negada' }
  | { tipo: 'indisponivel' };

const UF_POR_NOME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amazonas: 'AM', amapa: 'AP', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'minas gerais': 'MG', 'mato grosso do sul': 'MS', 'mato grosso': 'MT', para: 'PA',
  paraiba: 'PB', pernambuco: 'PE', piaui: 'PI', parana: 'PR', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', rondonia: 'RO', roraima: 'RR', 'rio grande do sul': 'RS',
  'santa catarina': 'SC', sergipe: 'SE', 'sao paulo': 'SP', tocantins: 'TO',
};

/** O reverso do celular devolve a UF como "SP" ou "São Paulo", conforme o sistema. */
function paraUf(regiao: string | null | undefined): string | null {
  if (!regiao) return null;
  const r = regiao.trim();
  if (/^[A-Za-z]{2}$/.test(r)) return r.toUpperCase();
  return UF_POR_NOME[normalizar(r)] ?? null;
}

export async function pegarLocalizacao(): Promise<Localizacao> {
  if (!temLocalizacao) return { tipo: 'indisponivel' };
  const Location = require('expo-location') as typeof import('expo-location');
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { tipo: 'negada' };
    // Balanceada: para achar farmácia, 100 m bastam, e responde bem mais rápido que a alta.
    // Limite de 8 s: GPS lento não pode prender a tela; passou disso, cai na cidade do cadastro.
    const atual = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8_000)),
    ]);
    if (!atual) return { tipo: 'indisponivel' };
    const pos = { lat: atual.coords.latitude, lon: atual.coords.longitude };
    try {
      const [e] = await Location.reverseGeocodeAsync({ latitude: pos.lat, longitude: pos.lon });
      return { tipo: 'ok', pos, uf: paraUf(e?.region), cidade: e?.city ?? e?.subregion ?? null };
    } catch {
      return { tipo: 'ok', pos, uf: null, cidade: null };
    }
  } catch {
    return { tipo: 'indisponivel' };
  }
}

/** Distância em metros (haversine). */
export function distanciaM(a: Posicao, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat - a.lat) * rad;
  const dLon = (lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function formatarDistancia(m: number, aproximada: boolean): string {
  const txt = m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
  return aproximada ? `~${txt}` : txt;
}
// ── FIM BLOCO ──
