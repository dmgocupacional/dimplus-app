// ═══ BLOCO: TELA — FARMÁCIAS VIDALINK EM WEBVIEW ═══
// 28/09/2026. O localizador oficial da Vidalink (convênio CT000560) DENTRO do app, com o
// cabeçalho do DIM+ e o cartão da pessoa no topo — em vez de jogar para o navegador.
// Decisão do Henrique: o José confirmou (28/09) que não há API da rede de farmácias; o
// localizador é a fonte oficial. Esta tela só o embala.
//
// 🔴 `react-native-webview` é carregado TARDE (require dentro do componente), só depois de
// `temWebView` confirmar o módulo no binário. Import no topo derruba a 4.0.1 da loja.
//
// ⚠️ Navegação presa à Vidalink no quadro principal. Qualquer outro endereço (mapa, rota,
// telefone) sai para o sistema — é assim que "como chegar" abre o app de mapas.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts)
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { URL_FARMACIAS_VIDALINK, abrirFarmaciasVidalink, abrirForaDoApp, temWebView } from '@/lib/clube';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

const DOMINIOS_VIDALINK = ['vidalink.com.br'];

function ehDaVidalink(url: string): boolean {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return DOMINIOS_VIDALINK.some((d) => host === d || host.endsWith(`.${d}`));
}

/** CPF (11 dígitos) formatado; outro número vai em blocos de 4. */
function formatarCartao(numero: string): string {
  const d = numero.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return numero.replace(/(.{4})/g, '$1 ').trim();
}

export default function Farmacias() {
  const { clube } = useSession();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  // Troca a chave para recarregar do zero no "Tentar de novo".
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // Binário sem WebView: abre no navegador embutido e volta — comportamento de antes.
    if (!temWebView) void abrirFarmaciasVidalink().finally(() => sair());
  }, []);

  if (!temWebView) {
    return (
      <View style={s.centro}>
        <ActivityIndicator color={color.navy} />
        <Text style={s.aviso}>Abrindo as farmácias conveniadas…</Text>
      </View>
    );
  }

  // require tardio de propósito — ver o cabeçalho do bloco.
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');

  return (
    <View style={s.tela}>
      {clube?.cartao_vidalink ? (
        <Pressable onPress={() => router.push('/clube' as never)} style={s.faixaCartao}>
          <View style={s.faixaTexto}>
            <Text style={s.faixaRotulo}>SEU CARTÃO FARMÁCIA VIDALINK</Text>
            <Text style={s.faixaNumero}>{formatarCartao(clube.cartao_vidalink)}</Text>
          </View>
          <Text style={s.faixaLink}>Ver cartão</Text>
        </Pressable>
      ) : null}

      {erro ? (
        <View style={s.centro}>
          <Text style={s.tituloErro}>Não conseguimos abrir o localizador agora</Text>
          <Text style={s.aviso}>O site da Vidalink não respondeu.</Text>
          <Pressable
            onPress={() => {
              setErro(false);
              setTentativa((t) => t + 1);
            }}
            style={s.botao}
          >
            <Text style={s.botaoTxt}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.web}>
          <WebView
            key={tentativa}
            source={{ uri: URL_FARMACIAS_VIDALINK }}
            style={s.web}
            onLoadStart={() => setCarregando(true)}
            onLoadEnd={() => setCarregando(false)}
            onError={() => setErro(true)}
            onShouldStartLoadWithRequest={(req) => {
              // Quadros embutidos (mapa do localizador) sempre carregam — lição do clube-web.
              if (req.isTopFrame === false) return true;
              if (req.url === 'about:blank' || ehDaVidalink(req.url)) return true;
              abrirForaDoApp(req.url);
              return false;
            }}
            // O localizador usa sessão ASP.NET em cookie/URL e pode pedir a localização.
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            geolocationEnabled
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
          />
          {carregando ? (
            <View style={s.carregando} pointerEvents="none">
              <ActivityIndicator color={color.navy} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function sair() {
  if (router.canGoBack()) router.back();
  else router.replace('/' as never);
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.white },
  web: { flex: 1 },
  faixaCartao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.navy,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  faixaTexto: { flex: 1 },
  faixaRotulo: { fontFamily: font.bold, fontSize: size.sm, color: color.green },
  faixaNumero: { fontFamily: font.black, fontSize: size.base, color: color.white },
  faixaLink: { fontFamily: font.bold, fontSize: size.sm, color: color.white },
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
  tituloErro: { fontFamily: font.black, fontSize: size.lg, color: color.navy, textAlign: 'center' },
  aviso: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, textAlign: 'center', marginTop: space.md },
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
