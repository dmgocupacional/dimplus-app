// ═══ BLOCO: MODO DEMONSTRAÇÃO (só na versão WEB) ═══
// 29/09/2026. O site de boas-vindas de cada empresa (bemvindo.<empresa>.dimeg.com.br) mostra
// ESTE app dentro de uma moldura de celular: `dimplus-web.vercel.app/?demo=<empresa>`.
// - Entra sozinho na conta de demonstração da empresa (ERP: /api/public/app-demo-login).
// - Toda escrita é recusada no ERP (a trava é lá, não aqui): o app só mostra a mensagem.
// - O site pode mandar o app para uma tela (capítulos do passo a passo) por postMessage.
// No app das lojas (iOS/Android) nada disto roda.
import { Alert, Platform } from 'react-native';

const CHAVE = 'dimplus_demo_empresa';
const SLUG = /^[a-z0-9-]{2,40}$/;
/** Sites que podem comandar a navegação do app em demonstração. */
const ORIGEM_SITE = /^https:\/\/bemvindo\.[a-z0-9-]+\.dimeg\.com\.br$|^http:\/\/localhost(:\d+)?$/;
/** Rotas que o site pode abrir (nada além disto). */
export const ROTAS_DEMO = new Set(['/', '/rede', '/familia', '/perfil', '/agendar', '/farmacias', '/clube', '/ajuda', '/meus-agendamentos']);

/** Empresa da demonstração, ou null fora dela. Guarda na sessão do navegador: a URL perde o
 *  `?demo=` quando o app navega. */
export function empresaDemo(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const daUrl = new URLSearchParams(window.location.search).get('demo');
    if (daUrl && SLUG.test(daUrl)) { window.sessionStorage.setItem(CHAVE, daUrl); return daUrl; }
    const guardada = window.sessionStorage.getItem(CHAVE);
    return guardada && SLUG.test(guardada) ? guardada : null;
  } catch {
    return null;
  }
}

/** Escuta o site pedindo para abrir uma tela. Devolve a função que para de escutar. */
export function ouvirSite(ir: (rota: string) => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  const ouvir = (e: MessageEvent) => {
    if (!ORIGEM_SITE.test(e.origin)) return;
    const d = e.data as { tipo?: string; rota?: string } | null;
    if (d?.tipo === 'dimplus:ir' && typeof d.rota === 'string' && ROTAS_DEMO.has(d.rota)) ir(d.rota);
  };
  window.addEventListener('message', ouvir);
  return () => window.removeEventListener('message', ouvir);
}

/** Na WEB o `Alert.alert` do React Native não mostra nada — o "Confirmar agendamento?", o aviso
 *  de 24h e os erros simplesmente sumiam. Aqui ele vira `alert`/`confirm` do navegador. */
export function instalarAlertaWeb(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (titulo, mensagem, botoes) => {
    const texto = [titulo, mensagem].filter(Boolean).join('\n\n');
    if (!botoes || botoes.length <= 1) { window.alert(texto); botoes?.[0]?.onPress?.(); return; }
    const cancelar = botoes.find((b) => b.style === 'cancel');
    const acoes = botoes.filter((b) => b.style !== 'cancel');
    const principal = acoes[acoes.length - 1];
    if (window.confirm(texto)) principal?.onPress?.();
    else cancelar?.onPress?.();
  };
}
// ── FIM BLOCO ──
