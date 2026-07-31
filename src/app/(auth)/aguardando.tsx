// ═══ BLOCO: TELA — AGUARDANDO APROVAÇÃO ═══
//
// Estado 'aguardando': a pessoa TEM sessão válida e mesmo assim o banco não devolve cliente
// algum. Isso não é erro de rede nem senha errada — é a conta inerte funcionando como
// projetada (`clientes.user_id` NULL + `app_acesso` 'bloqueado' → o RLS da FASE 0 não devolve
// linha). Sem esta tela, o app mostraria spinner eterno ou "erro ao carregar", e a pessoa
// tentaria de novo achando que errou a senha.
//
// O botão de recarregar existe porque a liberação acontece do OUTRO lado (staff no ERP), sem
// nenhum evento que chegue até aqui. Não há push nem realtime nesta fase: quem tenta de novo
// é a pessoa.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Aguardando() {
  const insets = useSafeAreaInsets();
  const { recarregar, sair } = useSession();
  const [checando, setChecando] = useState(false);

  async function onChecar() {
    setChecando(true);
    await recarregar();
    setChecando(false);
  }

  return (
    <View style={[s.tela, { paddingTop: insets.top }]}>
      <View style={s.selo}>
        <Ionicons name="time-outline" size={40} color={color.navy} />
      </View>

      <Text style={s.titulo}>Quase lá</Text>
      <Text style={s.txt}>
        Recebemos o seu cadastro. Assim que a nossa equipe liberar o seu acesso, os seus
        benefícios aparecem aqui.
      </Text>
      <Text style={s.txtFraco}>
        Isso costuma acontecer em horário comercial. Você não precisa se cadastrar de novo.
      </Text>

      <Pressable
        onPress={onChecar}
        disabled={checando}
        style={({ pressed }) => [s.botao, pressed && s.botaoPress, checando && s.botaoOff]}
        accessibilityRole="button"
        accessibilityLabel="Verificar de novo"
      >
        {checando ? (
          <ActivityIndicator color={color.navy} />
        ) : (
          <Text style={s.botaoTxt}>Verificar de novo</Text>
        )}
      </Pressable>

      <Pressable onPress={sair} style={s.sair} accessibilityRole="button">
        <Text style={s.sairTxt}>Sair</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: color.offwhite,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  selo: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: color.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  titulo: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  txt: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    textAlign: 'center',
    marginTop: space.md,
    lineHeight: 22,
  },
  txtFraco: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.md,
    lineHeight: 19,
  },
  botao: {
    height: 54,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
  },
  botaoOff: { backgroundColor: color.border },
  botaoPress: { backgroundColor: color.greenDeep },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  sair: { marginTop: space.xl, padding: space.sm },
  sairTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
});
// ── FIM BLOCO ──
