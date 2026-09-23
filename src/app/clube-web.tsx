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
// transformaria a tela do DIM+ num navegador genérico.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts)
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { abrirClube, abrirForaDoApp, pedirLinkClube, temWebView } from '@/lib/clube';
import { color, font, radius, size, space } from '@/theme/tokens';

// Domínios em que a navegação continua dentro da tela. O resto vai para fora.
const DOMINIOS_DO_CLUBE = ['cartaodedescontos.com.br', 'drachei.com.br', 'dimmsaude.com.br'];

function ehDoClube(url: string): boolean {
  const m = /^https:\/\/([^/?#]+)/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return DOMINIOS_DO_CLUBE.some((d) => host === d || host.endsWith(`.${d}`));
}

type Estado =
  | { fase: 'pedindo' }
  | { fase: 'pronto'; url: string }
  | { fase: 'erro'; mensagem: string };

export default function ClubeWeb() {
  const [estado, setEstado] = useState<Estado>({ fase: 'pedindo' });
  const [carregandoPagina, setCarregandoPagina] = useState(true);

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
        onError={() => setEstado({ fase: 'erro', mensagem: 'O site do clube não respondeu.' })}
        onShouldStartLoadWithRequest={(req) => {
          if (ehDoClube(req.url)) return true;
          // tel:, mailto:, mapas e sites de fora: sistema operacional, não esta tela.
          if (req.url !== 'about:blank') abrirForaDoApp(req.url);
          return false;
        }}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        domStorageEnabled
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
