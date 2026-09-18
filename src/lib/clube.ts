// ═══ BLOCO: CLUBE DE DESCONTOS (DR. ACHEI) ═══
// 16/09/2026. O cartão de descontos em farmácias vem da assinatura faturada no Gestor
// GrupoSin. Quem cria é o erp (POST /api/app/drachei/aderir) — o app só informa o que falta
// no cadastro e mostra o número.
//
// 🔴 O APP NÃO GUARDA SENHA DO CLUBE. O login de lá é gerado por eles: usuário é o CPF só
// com números e a senha inicial é a padrão da empresa. São credenciais de OUTRO sistema; a
// senha do app não vale lá e não deve ser pedida aqui.
//
// ⚠️ O número do cartão é lido direto da tabela (RLS deixa cada um ver só o próprio), e não
// da rota: assim a home não depende de chamada externa para desenhar o cartão.
import { supabase } from './supabase';
import { chamarFeegow } from './feegowApi';

/** Onde o beneficiário se autentica para ver/gerar o cartão de farmácias. */
export const URL_CLUBE = 'https://cartaodedescontos.com.br';

export type Sexo = 'M' | 'F';

// "Agora não" vale só enquanto o app estiver aberto: a variável morre com o processo e a
// trava reaparece no próximo carregamento. Deliberadamente NÃO persistido — a adesão é
// obrigatória; o adiamento existe para falha da API deles, não para recusa definitiva.
let dispensado = false;
export function dispensarClubePorAgora(): void {
  dispensado = true;
}
export function clubeDispensado(): boolean {
  return dispensado;
}

export interface CartaoClube {
  numero_cartao: string | null;
  plano_nome: string | null;
  ativa: boolean;
}

export async function getCartaoClube(): Promise<CartaoClube | null> {
  const { data, error } = await supabase
    .from('drachei_assinaturas')
    .select('numero_cartao, plano_nome, status')
    .maybeSingle();
  if (error || !data) return null;
  return {
    numero_cartao: data.numero_cartao,
    plano_nome: data.plano_nome,
    ativa: data.status === 'ativa',
  };
}

export type ResultadoAdesao =
  | { ok: true; numero_cartao: string | null }
  | { ok: false; mensagem: string; faltando?: string[] };

export async function aderirClube(dados: {
  sexo?: Sexo;
  data_nascimento?: string;
}): Promise<ResultadoAdesao> {
  const r = await chamarFeegow<{ numero_cartao: string | null; faltando?: string[] }>(
    '/api/app/drachei/aderir',
    { method: 'POST', body: dados },
  );
  if (r.ok) return { ok: true, numero_cartao: r.dados.numero_cartao };
  return { ok: false, mensagem: r.mensagem };
}
// ── FIM BLOCO ──
