// ═══ BLOCO: MAPA — FARMÁCIAS CONVENIADAS ═══
// 28/09/2026. Mapa DENTRO do app (pedido do Henrique: sem chamar o Maps do celular para ver):
// pins das farmácias + ponto azul de onde a pessoa está. Leaflet + OpenStreetMap no WebView,
// mesmo padrão do mapa do SOS (grátis, sem chave de API). Tocar num pin avisa a tela
// (postMessage) e ela mostra o card da farmácia embaixo do mapa.
//
// 🔴 `react-native-webview` carregado TARDE e só se existir no binário (4.19+) — igual ao SOS.
// ⚠️ A atribuição "© OpenStreetMap" é exigência da licença e fica visível no canto.
// ⚠️ baseUrl identificado: a política de uso dos mapas do OSM pede Referer.
// → BLOCO: MAPA DO SOS (src/app/sos.tsx)
import { createElement, useEffect } from 'react';
import { Platform, StyleSheet, TurboModuleRegistry, View } from 'react-native';

import { color, radius } from '@/theme/tokens';

// Na WEB o mapa vai num <iframe> do próprio navegador (29/09/2026: o app web e o robô do tutorial).
export const temMapa = Platform.OS === 'web' || TurboModuleRegistry?.get?.('RNCWebViewModule') != null;

export type PinFarmacia = { i: number; lat: number; lon: number; nome: string; aproximado: boolean };

function htmlMapa(pins: PinFarmacia[], eu: { lat: number; lon: number } | null, selecionado: number | null): string {
  // JSON dentro de <script>: neutraliza "</" para nenhum nome de farmácia fechar a tag.
  const dados = JSON.stringify({ pins, eu, sel: selecionado }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
html,body,#m{height:100%;margin:0;font-family:-apple-system,Roboto,sans-serif}
.pin{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color.navy};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.pin.aprox{background:${color.ink3}}
.pin.sel{background:${color.greenDeep};width:32px;height:32px}
.pin i{display:block;width:8px;height:8px;border-radius:50%;background:#fff;margin:9px}
.pin.sel i{margin:12px}
.eu{width:16px;height:16px;border-radius:50%;background:#2F80ED;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,128,237,.25)}
</style></head><body><div id="m"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var D=${dados};
var m=L.map('m',{zoomControl:false,attributionControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
var pts=[];
D.pins.forEach(function(p){
  var sel=D.sel===p.i;
  var ic=L.divIcon({className:'',html:'<div class="pin'+(p.aproximado?' aprox':'')+(sel?' sel':'')+'"><i></i></div>',iconSize:sel?[32,32]:[26,26],iconAnchor:sel?[16,32]:[13,26]});
  L.marker([p.lat,p.lon],{icon:ic,zIndexOffset:sel?1000:0}).addTo(m).on('click',function(){
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(String(p.i));}
    else if(window.parent&&window.parent!==window){window.parent.postMessage('farmacia:'+p.i,'*');}
  });
  pts.push([p.lat,p.lon]);
});
if(D.eu){L.marker([D.eu.lat,D.eu.lon],{icon:L.divIcon({className:'',html:'<div class="eu"></div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(m);}
var alvo=D.sel!=null?D.pins.filter(function(p){return p.i===D.sel})[0]:null;
if(alvo){m.setView([alvo.lat,alvo.lon],16);}
else if(D.eu&&pts.length){
  // perto de mim: enquadra a pessoa e as 8 farmácias mais próximas (já vêm ordenadas)
  m.fitBounds(pts.slice(0,8).concat([[D.eu.lat,D.eu.lon]]),{padding:[40,40],maxZoom:16});
}
else if(pts.length){m.fitBounds(pts,{padding:[30,30],maxZoom:15});}
else if(D.eu){m.setView([D.eu.lat,D.eu.lon],14);}
else{m.setView([-23.53,-46.79],11);}
</script></body></html>`;
}

export function MapaFarmacias({
  pins,
  eu,
  selecionado,
  onSelecionar,
}: {
  pins: PinFarmacia[];
  eu: { lat: number; lon: number } | null;
  selecionado: number | null;
  onSelecionar: (i: number) => void;
}) {
  // Web: o toque no pin chega por postMessage do <iframe>.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const ouvir = (e: MessageEvent) => {
      const m = typeof e.data === 'string' ? /^farmacia:(\d+)$/.exec(e.data) : null;
      if (m) onSelecionar(Number(m[1]));
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [onSelecionar]);

  if (!temMapa) return null;
  if (Platform.OS === 'web') {
    return (
      <View style={s.mapa}>
        {createElement('iframe', {
          srcDoc: htmlMapa(pins, eu, selecionado),
          title: 'Mapa das farmácias conveniadas',
          style: { border: 0, width: '100%', height: '100%' },
        })}
      </View>
    );
  }
  // require tardio de propósito — ver temMapa.
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');
  return (
    <View style={s.mapa}>
      <WebView
        source={{ html: htmlMapa(pins, eu, selecionado), baseUrl: 'https://dimmsaude.com.br' }}
        originWhitelist={['*']}
        onMessage={(e) => {
          const i = Number(e.nativeEvent.data);
          if (Number.isInteger(i)) onSelecionar(i);
        }}
        // Links externos (atribuição do OSM) não navegam dentro do mapa.
        onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:') || r.url.startsWith('https://dimmsaude.com.br')}
        style={s.web}
      />
    </View>
  );
}

const s = StyleSheet.create({
  mapa: {
    height: 380,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: 12,
  },
  web: { flex: 1 },
});
// ── FIM BLOCO ──
