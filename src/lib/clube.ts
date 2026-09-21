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
import { requireOptionalNativeModule } from 'expo';
import { Linking } from 'react-native';

import { supabase } from './supabase';
import { chamarFeegow } from './feegowApi';

/** Onde o beneficiário se cadastra no clube e gera o cartão Vidalink. */
// 21/09/2026: portal WHITE-LABEL que o Dr. Achei montou para a DIMEG, no nosso domínio.
// Até aqui apontava para o cartaodedescontos.com.br genérico — destino errado, identificado
// em 18/09 e só corrigido agora. Provisório até a API white-label (cadastro e cartão por
// dentro do app) ser liberada pelo José.
export const URL_CLUBE = 'https://portal.dimmsaude.com.br/login';

/**
 * Abre o clube SEM sair do app: Custom Tabs no Android, SFSafariViewController no iOS.
 *
 * ⚠️ Escolhido no lugar de WebView de propósito (18/09/2026). O site é de TERCEIRO e pede
 * senha: no navegador do sistema a pessoa vê o endereço de quem está pedindo a senha, o
 * gerenciador de senhas do celular funciona, e mudança de layout do parceiro não quebra
 * tela nossa. WebView seria o caminho se o conteúdo fosse nosso.
 */
//
// 🔴 NÃO importar `expo-web-browser` no topo (21/09/2026). Ele é módulo NATIVO e faz
// `requireNativeModule('ExpoWebBrowser')` na carga: num binário compilado antes dele (dev build
// 94aa9f8d, de 11/09), a OTA com o import fixo derrubou o app INTEIRO na abertura, porque a
// runtimeVersion (sdkVersion) não distingue binários com módulos nativos diferentes. Aqui o
// módulo só é carregado se existir no binário; senão, o clube abre no navegador do sistema.
const temNavegadorEmbutido = requireOptionalNativeModule('ExpoWebBrowser') != null;

export async function abrirClube(): Promise<void> {
  if (!temNavegadorEmbutido) {
    await Linking.openURL(URL_CLUBE);
    return;
  }
  // require tardio de propósito: só avalia o pacote quando o módulo nativo existe.
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  await WebBrowser.openBrowserAsync(URL_CLUBE, {
    toolbarColor: '#202745', // navy da marca
    controlsColor: '#FFFFFF',
    enableBarCollapsing: true,
    showTitle: true,
  });
}

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
  /** Número do cartão Vidalink informado pela pessoa. `null` = ainda não gerou. */
  cartao_vidalink: string | null;
}

export async function getCartaoClube(): Promise<CartaoClube | null> {
  const { data, error } = await supabase
    .from('drachei_assinaturas')
    .select('numero_cartao, plano_nome, status, cartao_vidalink')
    .maybeSingle();
  if (error || !data) return null;
  return {
    numero_cartao: data.numero_cartao,
    plano_nome: data.plano_nome,
    ativa: data.status === 'ativa',
    cartao_vidalink: data.cartao_vidalink ?? null,
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

/**
 * Grava o número do cartão Vidalink gerado no portal. PROVISÓRIO: sem API da Vidalink, o
 * número não é conferido na origem — vale o que a pessoa informou.
 */
export async function informarVidalink(
  numero: string,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const r = await chamarFeegow<{ cartao_vidalink: string }>('/api/app/drachei/vidalink', {
    method: 'POST',
    body: { numero },
  });
  return r.ok ? { ok: true } : { ok: false, mensagem: r.mensagem };
}
// ── FIM BLOCO ──
