// ═══ BLOCO: TELA — ADESÃO AO CLUBE DE DESCONTOS ═══
// 16/09/2026. Trava que vem DEPOIS do aceite do termo: quem ainda não tem cartão de
// descontos em farmácias passa por aqui, no primeiro acesso e também quem já usava o app.
//
// 🔴 PEDE SÓ O QUE FALTA. O Gestor recusa apenas `sexo` nulo (provado na API em 16/09), e a
// data de nascimento já está no cadastro da maioria. Pedir endereço aqui seria repetir o que
// a pessoa já preencheu na adesão — e o erp manda o que tiver.
//
// 🔴 "AGORA NÃO" EXISTE DE PROPÓSITO (decisão do Henrique, 16/09): a trava é obrigatória,
// mas se a API deles cair, bloquear o app inteiro puniria o cliente por falha de terceiro.
// A pendência volta no próximo abrir.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts)
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { aderirClube, dispensarClubePorAgora, type Sexo } from '@/lib/clube';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

const OPCOES: { valor: Sexo; rotulo: string }[] = [
  { valor: 'F', rotulo: 'Feminino' },
  { valor: 'M', rotulo: 'Masculino' },
];

export default function AdesaoClube() {
  const { cliente, recarregar } = useSession();
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (enviando || !sexo) return;
    setEnviando(true);
    setErro(null);
    const r = await aderirClube({ sexo });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    recarregar();
    router.replace('/' as never);
  }

  function agoraNao() {
    dispensarClubePorAgora();
    router.replace('/' as never);
  }

  return (
    <Screen titulo="Clube de descontos">
      <ScrollView contentContainerStyle={s.conteudo}>
        <Card>
          <Titulo>Seu cartão de descontos em farmácias</Titulo>
          <Text style={s.texto}>
            O seu plano dá direito a descontos em remédios nas farmácias conveniadas. Para
            gerar o cartão, confirme os dados abaixo. Leva menos de um minuto.
          </Text>

          <Text style={s.rotulo}>SEXO</Text>
          <View style={s.opcoes}>
            {OPCOES.map((o) => {
              const ativo = sexo === o.valor;
              return (
                <Pressable
                  key={o.valor}
                  onPress={() => setSexo(o.valor)}
                  style={[s.opcao, ativo && s.opcaoAtiva]}
                >
                  <Text style={[s.opcaoTxt, ativo && s.opcaoTxtAtivo]}>{o.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>

          {cliente?.nome ? (
            <Text style={s.nota}>O cartão será emitido no nome de {cliente.nome}.</Text>
          ) : null}

          {erro ? <Aviso texto={erro} /> : null}

          <Pressable
            onPress={confirmar}
            disabled={!sexo || enviando}
            style={[s.botao, (!sexo || enviando) && s.botaoOff]}
          >
            {enviando ? (
              <ActivityIndicator color={color.navy} />
            ) : (
              <Text style={s.botaoTxt}>Gerar meu cartão</Text>
            )}
          </Pressable>

          <Pressable onPress={agoraNao} disabled={enviando} style={s.depois}>
            <Text style={s.depoisTxt}>Agora não</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  conteudo: { paddingBottom: space.xl },
  texto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: space.sm },
  rotulo: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: color.ink3,
    marginTop: space.xl,
  },
  opcoes: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  opcao: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  opcaoAtiva: { borderColor: color.navy, backgroundColor: color.offwhite },
  opcaoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.ink2 },
  opcaoTxtAtivo: { color: color.navy },
  nota: { fontFamily: font.regular, fontSize: size.xs, color: color.ink3, marginTop: space.md },
  botao: {
    marginTop: space.xl,
    backgroundColor: color.green,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  botaoOff: { opacity: 0.45 },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  depois: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  depoisTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.ink3 },
});
// ── FIM BLOCO ──
