// ═══ BLOCO: TELA — AJUDA ═══
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { color, font, radius, size, space } from '@/theme/tokens';

const FAQ: { p: string; r: string }[] = [
  {
    p: 'Como uso o meu cartão?',
    r: 'Apresente o cartão digital da tela Início no parceiro. Não é preciso imprimir nada — a tela vale como identificação.',
  },
  {
    p: 'Por que alguns serviços estão bloqueados?',
    r: 'Serviços marcados com cadeado dependem de o pagamento estar em dia. Regularize pela aba Financeiro e o acesso volta automaticamente.',
  },
  {
    p: 'O que significa "em breve"?',
    r: 'São serviços já contratados que ainda estão sendo ativados: agendamento, exames, telemedicina e SOS. Você será avisado quando abrirem.',
  },
  {
    p: 'Como atualizo meu telefone?',
    r: 'Fale com a central. O telefone é o seu dado de acesso ao app, então a troca passa por conferência.',
  },
];

const WHATSAPP = '5511995192094';

export default function Ajuda() {
  const [aberta, setAberta] = useState<number | null>(0);

  function abrirWhatsApp() {
    Linking.openURL(`https://wa.me/${WHATSAPP}`).catch(() => {
      // sem WhatsApp instalado / sem navegador — falha silenciosa é aceitável aqui
    });
  }

  return (
    <Screen>
      <Titulo>Fale com a gente</Titulo>
      <Pressable onPress={abrirWhatsApp}>
        <Card style={s.contato}>
          <View style={s.contatoIcon}>
            <Ionicons name="logo-whatsapp" size={22} color={color.greenDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.contatoTitulo}>Central de atendimento</Text>
            <Text style={s.contatoSub}>Seg a sex, 8h às 18h</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.ink3} />
        </Card>
      </Pressable>

      <Aviso
        tom="aviso"
        icone="warning"
        texto="Em emergência, ligue 192 (SAMU) ou 193 (Bombeiros). O DIM+ Saúde não é serviço de emergência e não substitui o atendimento oficial."
      />

      <Titulo>Dúvidas frequentes</Titulo>
      {FAQ.map((item, i) => {
        const on = aberta === i;
        return (
          <Pressable key={item.p} onPress={() => setAberta(on ? null : i)}>
            <Card style={s.faq}>
              <View style={s.faqTopo}>
                <Text style={s.faqP}>{item.p}</Text>
                <Ionicons
                  name={on ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={color.ink3}
                />
              </View>
              {on ? <Text style={s.faqR}>{item.r}</Text> : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  contato: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  contatoIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contatoTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  contatoSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },

  faq: { marginBottom: space.sm },
  faqTopo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  faqP: { flex: 1, fontFamily: font.bold, fontSize: size.base, color: color.ink },
  faqR: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    lineHeight: 20,
    marginTop: space.md,
  },
});
// ── FIM BLOCO ──
