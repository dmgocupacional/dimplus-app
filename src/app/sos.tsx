// ═══ BLOCO: TELA — SOS ═══
// 23/09/2026. Resolve o "toque morto" do tile SOS registrado em 17/08.
//
// 🔴 O APP NÃO ACIONA O SAMU NEM OS BOMBEIROS. Não existe integração pública do 192/193 para
// aplicativo privado. Tudo aqui ajuda a PESSOA a ligar e a informar onde está — e o texto da
// tela diz isso com todas as letras. Nunca escrever algo como "avisamos o socorro": quem
// acredita que foi atendido deixa de ligar.
//
// 🔴 `expo-location` é NATIVO e chegou num binário novo. Carregado tarde e só se existir no
// binário (mesma regra de 21/09 do expo-web-browser): sem ele a tela continua útil — os botões
// de ligar funcionam, só o endereço não aparece.
//
// ⚠️ Localização SÓ com a tela aberta (permissão "em uso"); nada em segundo plano, nada
// gravado, nada enviado ao erp. A coordenada vive na memória desta tela.
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { color, font, radius, size, space } from '@/theme/tokens';

const temLocalizacao = requireOptionalNativeModule('ExpoLocation') != null;

type Posicao = { lat: number; lon: number; precisao: number | null; endereco: string | null };

type EstadoLocal =
  | { fase: 'buscando' }
  | { fase: 'pronto'; pos: Posicao }
  | { fase: 'sem_permissao' }
  | { fase: 'indisponivel'; motivo: string };

function linkMapa(p: Posicao): string {
  return `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
}

export default function Sos() {
  const [local, setLocal] = useState<EstadoLocal>({ fase: 'buscando' });

  async function localizar() {
    if (!temLocalizacao) {
      setLocal({ fase: 'indisponivel', motivo: 'Atualize o aplicativo para ver sua localização aqui.' });
      return;
    }
    setLocal({ fase: 'buscando' });
    // require tardio de propósito — ver o cabeçalho do bloco.
    const Location = require('expo-location') as typeof import('expo-location');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocal({ fase: 'sem_permissao' });
        return;
      }
      const atual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = atual.coords.latitude;
      const lon = atual.coords.longitude;
      let endereco: string | null = null;
      try {
        const [e] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (e) {
          const rua = [e.street, e.streetNumber].filter(Boolean).join(', ');
          endereco = [rua, e.district, [e.city ?? e.subregion, e.region].filter(Boolean).join(' - ')]
            .filter((x) => x && String(x).trim())
            .join(' · ') || null;
        }
      } catch {
        // Sem endereço, a coordenada e o link do mapa ainda servem.
      }
      setLocal({
        fase: 'pronto',
        pos: { lat, lon, precisao: atual.coords.accuracy ?? null, endereco },
      });
    } catch {
      setLocal({ fase: 'indisponivel', motivo: 'Não foi possível obter a localização. Verifique se o GPS está ligado.' });
    }
  }

  useEffect(() => {
    void localizar();
  }, []);

  function ligar(numero: string) {
    void Linking.openURL(`tel:${numero}`);
  }

  async function compartilhar() {
    if (local.fase !== 'pronto') return;
    const p = local.pos;
    const texto = [
      'Preciso de ajuda. Esta é a minha localização agora:',
      p.endereco ?? null,
      linkMapa(p),
    ]
      .filter(Boolean)
      .join('\n');
    await Share.share({ message: texto });
  }

  return (
    <ScrollView style={s.tela} contentContainerStyle={s.conteudo}>
      <View style={s.alerta}>
        <Ionicons name="warning" size={18} color={color.white} />
        <Text style={s.alertaTxt}>
          Em emergência, ligue agora. O aplicativo não chama o socorro sozinho.
        </Text>
      </View>

      <Pressable onPress={() => ligar('192')} style={[s.ligar, s.samu]}>
        <Ionicons name="medkit" size={28} color={color.white} />
        <View style={s.ligarTexto}>
          <Text style={s.ligarNumero}>192</Text>
          <Text style={s.ligarNome}>SAMU — emergência médica</Text>
        </View>
        <Ionicons name="call" size={24} color={color.white} />
      </Pressable>

      <Pressable onPress={() => ligar('193')} style={[s.ligar, s.bombeiros]}>
        <Ionicons name="flame" size={28} color={color.white} />
        <View style={s.ligarTexto}>
          <Text style={s.ligarNumero}>193</Text>
          <Text style={s.ligarNome}>Bombeiros — acidente, resgate, incêndio</Text>
        </View>
        <Ionicons name="call" size={24} color={color.white} />
      </Pressable>

      <Card>
        <Text style={s.rotulo}>ONDE VOCÊ ESTÁ</Text>

        {local.fase === 'buscando' ? (
          <View style={s.linha}>
            <ActivityIndicator color={color.navy} />
            <Text style={s.texto}>Buscando sua localização…</Text>
          </View>
        ) : null}

        {local.fase === 'pronto' ? (
          <>
            <Text style={s.endereco}>{local.pos.endereco ?? 'Endereço não identificado'}</Text>
            <Text style={s.nota}>
              Leia este endereço para o atendente.
              {local.pos.precisao ? ` Precisão aproximada de ${Math.round(local.pos.precisao)} m.` : ''}
            </Text>
            <Pressable onPress={() => void compartilhar()} style={s.botaoSec}>
              <Ionicons name="share-social" size={16} color={color.navy} />
              <Text style={s.botaoSecTxt}>Enviar minha localização para alguém</Text>
            </Pressable>
          </>
        ) : null}

        {local.fase === 'sem_permissao' ? (
          <>
            <Text style={s.texto}>
              Sem permissão de localização. Você ainda pode ligar pelos botões acima e informar o
              endereço ao atendente.
            </Text>
            <Pressable onPress={() => void Linking.openSettings()} style={s.botaoSec}>
              <Text style={s.botaoSecTxt}>Permitir nos ajustes</Text>
            </Pressable>
          </>
        ) : null}

        {local.fase === 'indisponivel' ? (
          <>
            <Text style={s.texto}>{local.motivo}</Text>
            {temLocalizacao ? (
              <Pressable onPress={() => void localizar()} style={s.botaoSec}>
                <Text style={s.botaoSecTxt}>Tentar de novo</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={s.rotulo}>AO LIGAR</Text>
        <Text style={s.texto}>
          Mantenha a calma. Diga o endereço, o que aconteceu, quantas pessoas precisam de ajuda e
          se estão conscientes e respirando. Não desligue até o atendente orientar.
        </Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  conteudo: { padding: space.xl, gap: space.md, paddingBottom: space.xxl * 2 },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.navy,
    borderRadius: radius.md,
    padding: space.md,
  },
  alertaTxt: { flex: 1, fontFamily: font.bold, fontSize: size.sm, color: color.white },
  ligar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  samu: { backgroundColor: color.danger },
  bombeiros: { backgroundColor: color.warning },
  ligarTexto: { flex: 1 },
  ligarNumero: { fontFamily: font.black, fontSize: size.xxl, color: color.white },
  ligarNome: { fontFamily: font.bold, fontSize: size.sm, color: color.white },
  rotulo: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1, color: color.ink3 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  endereco: { fontFamily: font.black, fontSize: size.lg, color: color.navy, marginTop: space.sm },
  texto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: space.sm },
  nota: { fontFamily: font.regular, fontSize: size.xs, color: color.ink3, marginTop: space.sm },
  botaoSec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.navy,
  },
  botaoSecTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
});
// ── FIM BLOCO ──
