// ═══ BLOCO: TELA — PERFIL ═══
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, LinhaLista, Pill, Screen, Titulo } from '@/components/ui';
import { formatCPF } from '@/lib/format';
import { APP_VERSION, APP_VERSION_DATA } from '@/lib/version';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Perfil() {
  const { carregando, cliente, acesso, adimplente } = useSession();

  if (carregando || !cliente) {
    return (
      <Screen titulo="Perfil" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  const iniciais = cliente.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const estado =
    acesso === 'bloqueado'
      ? { texto: 'sem acesso', tom: 'erro' as const }
      : acesso === 'suspenso'
        ? { texto: 'suspenso', tom: 'aviso' as const }
        : !adimplente
          ? { texto: 'em atraso', tom: 'erro' as const }
          : { texto: 'ativo', tom: 'ok' as const };

  return (
    <Screen titulo="Perfil">
      <Card style={s.topo}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{iniciais}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.nome}>{cliente.nome}</Text>
          <Text style={s.cpf}>{formatCPF(cliente.cpf)}</Text>
          <View style={{ marginTop: space.sm }}>
            <Pill texto={estado.texto} tom={estado.tom} />
          </View>
        </View>
      </Card>

      <Titulo>Conta</Titulo>
      <LinhaLista
        icone="call"
        titulo="Telefone"
        subtitulo={cliente.telefone ?? 'não cadastrado'}
      />
      <LinhaLista icone="card" titulo="Plano" subtitulo={cliente.plano} />

      <Titulo>Suporte</Titulo>
      <LinhaLista
        icone="help-circle"
        titulo="Ajuda"
        subtitulo="Dúvidas frequentes e contato"
        onPress={() => router.push('/ajuda' as never)}
      />

      {__DEV__ ? (
        <>
          <Titulo>Desenvolvimento</Titulo>
          <LinhaLista
            icone="construct"
            titulo="Painel de dev"
            subtitulo="Simular o gate de acesso"
            onPress={() => router.push('/dev' as never)}
          />
        </>
      ) : null}

      <Text style={s.versao}>
        DIM+ Saúde · v{APP_VERSION} · {APP_VERSION_DATA}
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: color.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: font.black, fontSize: size.lg, color: color.white },
  nome: { fontFamily: font.bold, fontSize: size.lg, color: color.ink },
  cpf: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  versao: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.xxl,
  },
});
// ── FIM BLOCO ──
