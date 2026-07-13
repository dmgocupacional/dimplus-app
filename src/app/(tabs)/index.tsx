// ═══ BLOCO: TELA — INÍCIO ═══
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CartaoDigital } from '@/components/CartaoDigital';
import { Aviso, Card, Screen, Tile, Titulo } from '@/components/ui';
import { mensagemBloqueio } from '@/lib/gate';
import type { ModuloKey } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

type Atalho = {
  key: ModuloKey;
  rotulo: string;
  icone: ComponentProps<typeof Ionicons>['name'];
  rota: string | null;
};

const ATALHOS: Atalho[] = [
  { key: 'rede', rotulo: 'Rede parceira', icone: 'location', rota: '/rede' },
  { key: 'financeiro', rotulo: 'Financeiro', icone: 'receipt', rota: '/financeiro' },
  { key: 'agendamento', rotulo: 'Agendar', icone: 'calendar', rota: null },
  { key: 'exames', rotulo: 'Exames', icone: 'document-text', rota: null },
  { key: 'telemedicina', rotulo: 'Telemedicina', icone: 'videocam', rota: null },
  { key: 'sos', rotulo: 'SOS', icone: 'medkit', rota: null },
  { key: 'ajuda', rotulo: 'Ajuda', icone: 'help-circle', rota: '/ajuda' },
];

export default function Inicio() {
  const { carregando, cliente, acesso, adimplente, pode, modulo } = useSession();
  const [toast, setToast] = useState<string | null>(null);

  if (carregando || !cliente) {
    return (
      <Screen scroll={false}>
        <View style={s.load}>
          <ActivityIndicator color={color.navy} />
        </View>
      </Screen>
    );
  }

  const primeiroNome = cliente.nome.split(' ')[0];
  const bloqueadoPorAtraso = acesso !== 'bloqueado' && !adimplente;

  function abrir(a: Atalho) {
    const veredito = pode(a.key);
    if (!veredito.pode) {
      setToast(mensagemBloqueio(veredito.motivo));
      setTimeout(() => setToast(null), 2600);
      return;
    }
    if (a.rota) router.push(a.rota as never);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={s.saudacao}>
          <Text style={s.ola}>Olá, {primeiroNome}</Text>
          <Text style={s.sub}>Que bom ter você por aqui.</Text>
        </View>

        <CartaoDigital cliente={cliente} acesso={acesso} adimplente={adimplente} />

        {bloqueadoPorAtraso ? (
          <Aviso texto="Há uma fatura em aberto. Seus benefícios estão bloqueados até a regularização." />
        ) : null}
        {acesso === 'bloqueado' ? (
          <Aviso texto="Seu acesso ao app ainda não foi liberado. Fale com a central de atendimento." />
        ) : null}

        <Titulo>Acesso rápido</Titulo>
        <View style={s.grade}>
          {ATALHOS.map((a) => {
            const m = modulo(a.key);
            const veredito = pode(a.key);
            const emBreve = !!m && !m.ativo;
            return (
              <Tile
                key={a.key}
                icone={a.icone}
                rotulo={a.rotulo}
                emBreve={emBreve}
                bloqueado={!veredito.pode && !emBreve}
                onPress={() => abrir(a)}
              />
            );
          })}
        </View>

        <Titulo>Precisa de ajuda?</Titulo>
        <Pressable onPress={() => router.push('/ajuda' as never)}>
          <Card style={s.suporte}>
            <View style={s.suporteIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color={color.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.suporteTitulo}>Central de atendimento</Text>
              <Text style={s.suporteSub}>Tire dúvidas sobre o seu plano e a rede.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={color.ink3} />
          </Card>
        </Pressable>
      </Screen>

      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  load: { paddingTop: 80, alignItems: 'center' },
  saudacao: { marginBottom: space.lg },
  ola: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  sub: { fontFamily: font.regular, fontSize: size.base, color: color.ink2, marginTop: 2 },
  // RN só aceita `gap` NUMÉRICO. Percentual é ignorado em silêncio — não voltar a usar.
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: space.md },
  suporte: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  suporteIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suporteTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  suporteSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  toast: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: space.xl,
    backgroundColor: color.navy,
    borderRadius: radius.md,
    padding: space.md,
  },
  toastTxt: {
    fontFamily: font.medium,
    fontSize: size.sm,
    color: color.white,
    textAlign: 'center',
  },
});
// ── FIM BLOCO ──
