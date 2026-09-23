// ═══ BLOCO: TELA — CLUBE DE DESCONTOS EM WEBVIEW ═══
// 23/09/2026. O clube do parceiro aberto DENTRO do app, com o cabeçalho do DIM+, para parecer
// funcionalidade nativa (decisão do Henrique).
//
// 🔴 O LINK É CREDENCIAL. Esta tela pede o link ela mesma, ao montar, e o guarda só na
// memória do componente: nada de parâmetro de rota (fica no histórico), nada de estado global,
// nada de log. Sair da tela descarta; voltar pede um link novo.
//
// 🔴 `react-native-webview` é carregado TARDE (require dentro do componente), e só depois de
// `temWebView` confirmar que o binário tem o módulo. Import no topo derrubaria o app inteiro
// num binário antigo — já aconteceu com o expo-web-browser em 21/09.
//
// ⚠️ Navegação presa ao clube: páginas do próprio clube abrem aqui; qualquer outro endereço
// (telefone, mapa, site externo) sai para o sistema. Sem isto, um link qualquer no site deles
// transformaria a tela do DIM+ num navegador genérico. A regra vale SÓ para o quadro principal:
// iframes (reCAPTCHA, mapa, pagamento) fazem parte da página e carregam normalmente.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts)
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { abrirClube, abrirForaDoApp, informarVidalink, pedirLinkClube, temWebView } from '@/lib/clube';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

// User-agent do navegador do sistema, SEM o marcador `wv`/WebView: é por ele que o reCAPTCHA
// separa navegador de app embutido. Mantém versões realistas — um UA inventado é pior que
// o padrão.
const UA_NAVEGADOR =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

// ═══ DESTINOS DENTRO DO CLUBE (23/09/2026) ═══
// O link autenticado sempre cai no login do clube. Para abrir já numa seção, a tela espera o
// login concluir e, na PRIMEIRA página logada, navega para o destino. Caminho informado pelo
// Henrique a partir do site em produção — não descoberto por sondagem.
// Só nomes curtos trafegam na rota; o endereço fica aqui, e o token nunca sai da tela.
const DESTINOS: Record<string, string> = {
  farmacia: 'https://www.cartaodedescontos.com.br/cartao-farmacia',
};

// ═══ CAPTURA DA ATIVAÇÃO DO VIDALINK (23/09/2026) ═══
// Lido no código do site em produção (chunk da página /cartao-farmacia): o cartão Vidalink é o
// CPF do titular (o modal do cartão recebe só `user.document` e `vidalink_expire_date`), e a
// ativação é um único `POST .../vidalink/active` que responde `{ success: true }`.
//
// Então não há número para ler da tela: basta saber que a ativação deu certo. Este script
// embrulha XHR e fetch da página e avisa o app quando essa resposta volta com sucesso. Não lê,
// não copia e não repassa mais nada da sessão — só o sinal de "ativou".
//
// ⚠️ Depende do site do parceiro como está hoje. Se a rota mudar, a captura para em silêncio e
// a tela manual de digitar o número volta a ser o caminho. Solução definitiva: endpoint de
// ativação no Gestor, pedido ao José.
const OUVIR_ATIVACAO = `
(function () {
  if (window.__dimVidalink) return; window.__dimVidalink = true;
  function enviarMsg(obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }
  // Sem expressões regulares de propósito: este texto vive dentro de template string do TS,
  // e barra invertida aqui já causou erro de escape.
  function ehAtivacao(url) {
    return typeof url === 'string' && url.indexOf('/vidalink/active') >= 0;
  }
  function tratarAtivacao(url, texto) {
    if (!ehAtivacao(url)) return;
    try { if (JSON.parse(texto).success === true) enviarMsg({ tipo: 'vidalink_ativado' }); } catch (e) {}
  }
  // Status: ao abrir logada, a página busca o usuário e recebe vidalink_expire_date. Procura só
  // esse campo nas respostas JSON (profundidade limitada) e repassa só a data AAAA-MM-DD.
  var ultimaValidade;
  function acharValidade(o, prof) {
    if (!o || typeof o !== 'object' || prof > 6) return undefined;
    if (Object.prototype.hasOwnProperty.call(o, 'vidalink_expire_date')) return o.vidalink_expire_date;
    for (var k in o) { var v = acharValidade(o[k], prof + 1); if (v !== undefined) return v; }
    return undefined;
  }
  function tratarStatus(texto) {
    if (typeof texto !== 'string' || texto.indexOf('vidalink_expire_date') < 0) return;
    try {
      var v = acharValidade(JSON.parse(texto), 0);
      if (v === undefined) return;
      var data = (typeof v === 'string' && v.length >= 10 && v.charAt(4) === '-' && v.charAt(7) === '-')
        ? v.slice(0, 10) : null;
      if (data === ultimaValidade) return;
      ultimaValidade = data;
      enviarMsg({ tipo: 'vidalink_status', validade: data });
    } catch (e) {}
  }
  var abrir = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) { this.__dimUrl = url; return abrir.apply(this, arguments); };
  var enviar = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    var x = this;
    x.addEventListener('load', function () {
      if (x.status < 200 || x.status >= 300) return;
      var t = '';
      try { t = x.responseText; } catch (e) { return; }
      tratarAtivacao(x.__dimUrl, t);
      tratarStatus(t);
    });
    return enviar.apply(this, arguments);
  };
  if (window.fetch) {
    var f = window.fetch;
    window.fetch = function (entrada) {
      var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url);
      var p = f.apply(this, arguments);
      p.then(function (r) {
        if (!r.ok) return;
        return r.clone().text().then(function (t) { tratarAtivacao(url, t); tratarStatus(t); });
      }).catch(function () {});
      return p;
    };
  }
})();
true;`;

// Domínios em que a navegação continua dentro da tela. O resto vai para fora.
const DOMINIOS_DO_CLUBE = ['cartaodedescontos.com.br', 'drachei.com.br', 'dimmsaude.com.br'];

// reCAPTCHA pode abrir o desafio como janela; com `setSupportMultipleWindows={false}` ela
// carrega AQUI como página principal. Só os caminhos do reCAPTCHA — o google.com em geral
// continua indo para fora, senão a tela vira navegador de busca.
function ehRecaptcha(url: string): boolean {
  return /^https:\/\/(www\.)?(google\.com|recaptcha\.net)\/recaptcha\//i.test(url)
    || /^https:\/\/(www\.)?gstatic\.com\/recaptcha\//i.test(url);
}

function ehDoClube(url: string): boolean {
  const m = /^https:\/\/([^/?#]+)/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return DOMINIOS_DO_CLUBE.some((d) => host === d || host.endsWith(`.${d}`)) || ehRecaptcha(url);
}

type Estado =
  | { fase: 'pedindo' }
  | { fase: 'pronto'; url: string }
  | { fase: 'erro'; mensagem: string };

export default function ClubeWeb() {
  const { destino } = useLocalSearchParams<{ destino?: string }>();
  const { cliente, clube, recarregar } = useSession();
  // Um aviso por tela: a página pode reenviar a ativação, o app grava uma vez.
  const jaGravou = useRef(false);

  async function aoReceber(dado: string) {
    let msg: { tipo?: unknown } | null = null;
    try {
      msg = JSON.parse(dado) as { tipo?: unknown };
    } catch {
      return; // mensagem de outro script da página: ignora
    }
    const cpf = String(cliente?.cpf ?? '').replace(/\D/g, '');
    if (cpf.length !== 11) return;

    if (msg?.tipo === 'vidalink_ativado') {
      if (jaGravou.current) return;
      jaGravou.current = true;
      const r = await informarVidalink(cpf);
      if (r.ok) void recarregar();
      else jaGravou.current = false; // falhou: deixa tentar de novo se o site reenviar
      return;
    }

    // Status lido ao abrir a página: cobre quem ativou antes da captura existir e mantém a
    // validade em dia. Só cria cartão com validade FUTURA (vencido não vira cartão novo) e só
    // grava quando algo mudou, para não escrever a cada abertura do clube.
    if (msg?.tipo === 'vidalink_status') {
      const validade = (msg as { validade?: unknown }).validade;
      if (typeof validade !== 'string') return;
      if (clube?.cartao_vidalink && clube.vidalink_validade === validade) return;
      const hoje = new Date().toISOString().slice(0, 10);
      if (validade < hoje && !clube?.cartao_vidalink) return;
      const r = await informarVidalink(cpf, validade);
      if (r.ok) void recarregar();
    }
  }
  const alvo = destino ? DESTINOS[destino] : undefined;
  const [estado, setEstado] = useState<Estado>({ fase: 'pedindo' });
  const [carregandoPagina, setCarregandoPagina] = useState(true);
  // Garante um único salto para o destino: depois dele, a pessoa navega livre pelo clube.
  const jaSaltou = useRef(false);

  async function pedir() {
    setEstado({ fase: 'pedindo' });
    setCarregandoPagina(true);
    const r = await pedirLinkClube();
    setEstado(r.ok ? { fase: 'pronto', url: r.url } : { fase: 'erro', mensagem: r.mensagem });
  }

  useEffect(() => {
    // Binário sem WebView: não há como mostrar aqui. Abre no navegador embutido e volta.
    if (!temWebView) {
      void abrirClube().finally(() => router.back());
      return;
    }
    void pedir();
  }, []);

  if (!temWebView || estado.fase === 'pedindo') {
    return (
      <View style={s.centro}>
        <ActivityIndicator color={color.navy} />
        <Text style={s.aviso}>Abrindo o clube de descontos…</Text>
      </View>
    );
  }

  if (estado.fase === 'erro') {
    return (
      <View style={s.centro}>
        <Text style={s.tituloErro}>Não conseguimos abrir o clube agora</Text>
        <Text style={s.aviso}>{estado.mensagem}</Text>
        <Pressable onPress={() => void pedir()} style={s.botao}>
          <Text style={s.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  // require tardio de propósito — ver o cabeçalho do bloco.
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');

  return (
    <View style={s.tela}>
      <WebView
        source={{ uri: estado.url }}
        style={s.web}
        onLoadStart={() => setCarregandoPagina(true)}
        onLoadEnd={() => setCarregandoPagina(false)}
        onNavigationStateChange={(nav) => {
          // Login concluído = primeira página do clube que já não é a de login. Aí, e só uma
          // vez, troca a origem para o destino pedido.
          if (!alvo || jaSaltou.current || nav.loading) return;
          if (!ehDoClube(nav.url) || /\/login(\b|\?|$)/i.test(nav.url)) return;
          if (nav.url.startsWith(alvo)) {
            jaSaltou.current = true;
            return;
          }
          jaSaltou.current = true;
          setEstado({ fase: 'pronto', url: alvo });
        }}
        onError={() => setEstado({ fase: 'erro', mensagem: 'O site do clube não respondeu.' })}
        injectedJavaScriptBeforeContentLoaded={OUVIR_ATIVACAO}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        onMessage={(e) => void aoReceber(e.nativeEvent.data)}
        onShouldStartLoadWithRequest={(req) => {
          // 🔴 QUADROS EMBUTIDOS SEMPRE CARREGAM (bug de 23/09/2026). O site do clube usa
          // reCAPTCHA do Google num iframe; tratar o iframe como navegação mandava o endereço
          // do Google para o Safari, que abria a página solta com "domínio inválido para a
          // chave do site" e o recurso do clube não funcionava. No iOS este callback também
          // dispara para subquadros (isTopFrame=false); no Android, só para o quadro principal.
          if (req.isTopFrame === false) return true;
          if (req.url === 'about:blank' || ehDoClube(req.url)) return true;
          // Navegação da PÁGINA para fora do clube (telefone, e-mail, mapa, outro site): sistema.
          abrirForaDoApp(req.url);
          return false;
        }}
        // ═══ PARIDADE COM O NAVEGADOR (23/09/2026) ═══
        // O clube funcionava no navegador embutido; aqui tem de funcionar igual. O reCAPTCHA
        // do parceiro pontua o ambiente e desconfia de WebView — então a tela se apresenta e
        // se comporta como o navegador do sistema, em vez de esconder ou remover a proteção
        // deles (que o servidor do clube confere, e sem ela a função é recusada).
        userAgent={UA_NAVEGADOR}
        // Android bloqueia cookie de terceiro por padrão em WebView; o reCAPTCHA vive dele.
        thirdPartyCookiesEnabled
        // iOS: compartilha o cookie store com o sistema, como o navegador faz.
        sharedCookiesEnabled
        // window.open do site (desafio do reCAPTCHA, comprovantes) abre nesta mesma tela.
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        startInLoadingState={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
      />
      {carregandoPagina ? (
        <View style={s.carregando} pointerEvents="none">
          <ActivityIndicator color={color.navy} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.white },
  web: { flex: 1 },
  carregando: {
    position: 'absolute',
    top: space.lg,
    alignSelf: 'center',
    backgroundColor: color.white,
    borderRadius: radius.pill,
    padding: space.sm,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: color.offwhite,
  },
  tituloErro: {
    fontFamily: font.black,
    fontSize: size.lg,
    color: color.navy,
    textAlign: 'center',
  },
  aviso: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    textAlign: 'center',
    marginTop: space.md,
  },
  botao: {
    marginTop: space.xl,
    backgroundColor: color.green,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
});
// ── FIM BLOCO ──
