// ═══ BLOCO: TELA — PERFIL ═══
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { Card, LinhaLista, Pill, Screen, Titulo } from '@/components/ui';
import { excluirMinhaConta } from '@/lib/conta';
import { formatCPF } from '@/lib/format';
import { API_BASE } from '@/lib/supabase';
import { APP_VERSION, APP_VERSION_DATA } from '@/lib/version';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Perfil() {
  const { carregando, cliente, acesso, adimplente, sair } = useSession();
  const [excluindo, setExcluindo] = useState(false);

  // ═══ EXCLUSÃO DE CONTA — EXIGÊNCIA DE LOJA ═══
  // Apple 5.1.1(v) e Google Play exigem este caminho DENTRO do app. Duas confirmações de
  // propósito: é ato irreversível pelo próprio usuário (só a clínica reverte) e o dedo
  // escorrega numa lista. O segundo Alert é o que a review procura.
  //
  // 🔴 O texto diz que o PLANO NÃO É CANCELADO. Sair do app e rescindir contrato são coisas
  // diferentes, e quem confundir vai continuar sendo cobrado achando que cancelou. Esta
  // frase tem que sobreviver a qualquer reescrita desta tela.
  async function confirmarExclusao() {
    if (excluindo) return;
    setExcluindo(true);
    const r = await excluirMinhaConta();
    setExcluindo(false);
    if (!r.ok) {
      Alert.alert('Não foi possível excluir', r.mensagem);
      return;
    }
    Alert.alert(
      'Conta excluída',
      'Seu acesso ao aplicativo foi encerrado. O histórico de atendimentos e os registros do contrato são mantidos por obrigação legal.',
      [{ text: 'Entendi', onPress: () => { void sair(); } }],
    );
  }

  function pedirExclusao() {
    Alert.alert(
      'Excluir minha conta',
      'Você perde o acesso ao aplicativo e precisará falar com a clínica para voltar a usá-lo.\n\nIsto NÃO cancela o seu plano: as mensalidades continuam sendo cobradas até que você cancele o contrato com a clínica.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Tem certeza?',
              'Esta ação encerra o seu acesso agora e não pode ser desfeita pelo aplicativo.',
              [
                { text: 'Voltar', style: 'cancel' },
                { text: 'Excluir conta', style: 'destructive', onPress: () => { void confirmarExclusao(); } },
              ],
            ),
        },
      ],
    );
  }

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
      <LinhaLista icone="card" titulo="Plano" subtitulo={cliente.plano ?? 'DIM+ Saúde'} />
      {/* Só leitura (S-C). A inclusão é a S-D e nasce como solicitação com aprovação. */}
      <LinhaLista
        icone="people"
        titulo="Dependentes"
        subtitulo="Quem está no seu plano"
        onPress={() => router.push('/dependentes' as never)}
      />

      <Titulo>Suporte</Titulo>
      <LinhaLista
        icone="help-circle"
        titulo="Ajuda"
        subtitulo="Dúvidas frequentes e contato"
        onPress={() => router.push('/ajuda' as never)}
      />

      {/* O painel de dev morreu junto com o mock: ele simulava o gate quando não havia sessão.
          Com auth real, forçar estado na tela mentiria sobre o que o RLS devolve. */}
      <Titulo>Privacidade</Titulo>
      {/* URL exigida pelas duas lojas e apontada na ficha do app. Abre no navegador: manter
          como página web (e não copiar o texto para cá) é o que garante que app e loja
          leiam SEMPRE a mesma versão da política. */}
      <LinhaLista
        icone="document-text"
        titulo="Política de Privacidade"
        subtitulo="Como tratamos seus dados"
        onPress={() => { void Linking.openURL(`${API_BASE}/privacidade`); }}
      />

      <Titulo>Sessão</Titulo>
      <LinhaLista icone="log-out" titulo="Sair" subtitulo="Encerrar a sessão neste aparelho" onPress={sair} />
      <LinhaLista
        icone="trash"
        titulo={excluindo ? 'Excluindo…' : 'Excluir minha conta'}
        subtitulo="Encerra o acesso ao aplicativo"
        onPress={pedirExclusao}
      />

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
