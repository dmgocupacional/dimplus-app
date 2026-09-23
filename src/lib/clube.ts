// ═══ BLOCO: CLUBE DE DESCONTOS (DR. ACHEI) ═══
// 16/09/2026. O cartão de descontos em farmácias vem da assinatura faturada no Gestor
// GrupoSin. Quem cria é o erp (POST /api/app/drachei/aderir) — o app só informa o que falta
// no cadastro e mostra o número.
//
// 🔴 O APP NÃO GUARDA SENHA DO CLUBE. Desde 23/09/2026 nem precisa: o clube abre com link de
// sessão gerado pelo Gestor (/auth/clube). A pessoa não cria conta nem digita senha lá.
//
// ⚠️ O número do cartão é lido direto da tabela (RLS deixa cada um ver só o próprio), e não
// da rota: assim a home não depende de chamada externa para desenhar o cartão.
import { requireOptionalNativeModule } from 'expo';
import { Linking, TurboModuleRegistry } from 'react-native';

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

/**
 * 23/09/2026 — o clube passou a abrir em WEBVIEW, como tela do próprio app (decisão do
 * Henrique). Só possível porque o link já vem autenticado: não há senha a digitar, que era o
 * motivo de o navegador embutido ter sido preferido em 18/09.
 *
 * 🔴 Mesma regra do expo-web-browser: `react-native-webview` é NATIVO e chegou num binário
 * novo. Import fixo num binário antigo derruba o app inteiro na abertura, e a runtimeVersion
 * não distingue os binários. Aqui só se sabe se ele existe; quem importa é a tela, tarde.
 */
export const temWebView = TurboModuleRegistry.get('RNCWebViewModule') != null;

/** Abre qualquer URL no navegador embutido, ou no do sistema se o binário não tiver o módulo. */
async function abrirUrl(url: string): Promise<void> {
  if (!temNavegadorEmbutido) {
    await Linking.openURL(url);
    return;
  }
  // require tardio de propósito: só avalia o pacote quando o módulo nativo existe.
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  await WebBrowser.openBrowserAsync(url, {
    toolbarColor: '#202745', // navy da marca
    controlsColor: '#FFFFFF',
    enableBarCollapsing: true,
    showTitle: true,
  });
}

export type ResultadoAbrir = { ok: true } | { ok: false; mensagem: string };

/**
 * 23/09/2026 — o clube abre JÁ AUTENTICADO. O erp pede ao Gestor um link de sessão
 * (/auth/clube) e o app só redireciona: nada de segundo cadastro nem de senha do parceiro.
 *
 * 🔴 A URL devolvida é CREDENCIAL (token de sessão na query). Usar uma vez e descartar: não
 * guardar em estado, não logar, não reaproveitar. Cada toque pede um link novo.
 *
 * Sem link (parceiro fora do ar, cadastro pendente lá) o app NÃO cai no portal genérico:
 * lá a pessoa teria de criar outra conta, que é justamente o que este fluxo elimina.
 */
/** Pede ao erp um link de sessão novo. Quem chama usa uma vez e descarta. */
export async function pedirLinkClube(): Promise<{ ok: true; url: string } | { ok: false; mensagem: string }> {
  const r = await chamarFeegow<{ url: string }>('/api/app/drachei/clube', { method: 'POST', body: {} });
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  return { ok: true, url: r.dados.url };
}

/**
 * Caminho para binário SEM WebView: abre no navegador embutido. Com WebView, a tela
 * `/clube-web` chama `pedirLinkClube` ela mesma — assim o link nunca trafega por parâmetro de
 * rota, que fica no histórico de navegação.
 */
export async function abrirClube(): Promise<ResultadoAbrir> {
  const r = await pedirLinkClube();
  if (!r.ok) return r;
  await abrirUrl(r.url);
  return { ok: true };
}

/** Links que saem do clube (telefone, mapa, outro site) vão para fora do app. */
export function abrirForaDoApp(url: string): void {
  void Linking.openURL(url);
}

/**
 * Abre um atendimento de telemedicina e leva à pré-consulta.
 * 🔴 Cada chamada CRIA um atendimento no parceiro — só no toque explícito, nunca em retry.
 */
export async function abrirTelemedicina(dependenteId?: string): Promise<ResultadoAbrir> {
  const r = await chamarFeegow<{ url: string; mensagem: string }>('/api/app/drachei/telemedicina', {
    method: 'POST',
    body: dependenteId ? { dependente_id: dependenteId } : {},
  });
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  await abrirUrl(r.dados.url);
  return { ok: true };
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

/** O que o app pode completar do cadastro. Os nomes batem com as colunas de `clientes`. */
export interface DadosAdesao {
  sexo?: Sexo;
  data_nascimento?: string;
  naturalidade?: string;
  email?: string;
  endereco_cep?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_complemento?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
}

/**
 * ⚠️ 23/09/2026 — o parceiro passou a exigir e-mail, naturalidade e endereço completo. O erp
 * responde 422 com `faltando` (nomes das chaves que faltam); a tela usa essa lista para
 * perguntar SÓ o que falta, em vez de um formulário cheio de coisas que já temos.
 */
export async function aderirClube(dados: DadosAdesao): Promise<ResultadoAdesao> {
  const r = await chamarFeegow<{ numero_cartao: string | null }>('/api/app/drachei/aderir', {
    method: 'POST',
    body: dados,
  });
  if (r.ok) return { ok: true, numero_cartao: r.dados.numero_cartao };
  const faltando = (r.corpo as { faltando?: unknown } | undefined)?.faltando;
  return {
    ok: false,
    mensagem: r.mensagem,
    faltando: Array.isArray(faltando) ? faltando.filter((f): f is string => typeof f === 'string') : undefined,
  };
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
