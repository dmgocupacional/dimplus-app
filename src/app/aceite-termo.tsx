// ═══ BLOCO: TELA — ACEITE DO TERMO DE ADESÃO ═══
// 26/08/2026. Contrato com o SUEESSOR: o associado se cadastra, é aprovado e aceita aqui.
// É este aceite que dispara a cobrança no erp — ver /api/app/contrato/aceite.
//
// 🔴 O BOTÃO SÓ LIBERA DEPOIS DE ROLAR O TEXTO ATÉ O FIM. Não é enfeite de UX: o aceite é a
// prova de que a pessoa teve o termo diante dos olhos, e o termo contém multa rescisória de
// 30% das parcelas vincendas. Botão habilitado de saída torna a prova frágil.
//
// 🔴 A ESCOLHA DE VENCIMENTO E FORMA É DO BENEFICIÁRIO (decisão do Henrique, 26/08) — as
// mesmas três datas do termo em papel (10/20/30), para não criar um quarto dia de
// vencimento na base.
//
// ⚠️ Falha ao carregar NÃO vira "não há termo". A lib devolve null para desconhecido; a tela
// mostra erro e um botão de tentar de novo. Tratar erro como ausência esconderia a pendência
// e deixaria o beneficiário usando o app sem nunca ter aceitado nada.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { useSession } from '@/state/session';
import {
  aceitarTermo,
  buscarTermoPendente,
  type DiaVencimento,
  type FormaPagamento,
  type TermoPendente,
} from '@/lib/contrato';
import { color, font, radius, size, space } from '@/theme/tokens';

const DIAS: DiaVencimento[] = [10, 20, 30];
const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'BOLETO', rotulo: 'Boleto' },
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'CREDIT_CARD', rotulo: 'Cartão' },
];

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AceiteTermo() {
  const { recarregarAceite } = useSession();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<TermoPendente | null>(null);
  const [leuAteOFim, setLeuAteOFim] = useState(false);
  const [dia, setDia] = useState<DiaVencimento>(10);
  const [forma, setForma] = useState<FormaPagamento>('BOLETO');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const r = await buscarTermoPendente();
    setCarregando(false);
    if (!r) {
      setErro('Não foi possível carregar o termo. Verifique a conexão e tente de novo.');
      return;
    }
    setDados(r);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    const r = await aceitarTermo(dia, forma);
    setEnviando(false);
    if (!r.ok) {
      Alert.alert('Não foi possível concluir', r.mensagem);
      return;
    }
    const msg =
      r.cobranca === 'entidade'
        ? 'Adesão confirmada. A mensalidade será descontada conforme o acordo com a sua entidade.'
        : r.cobranca === 'assinatura'
          ? `Adesão confirmada. A primeira cobrança vence no dia ${dia}.`
          : (r.aviso ?? 'Adesão confirmada. A cobrança será gerada pela nossa equipe.');
    // Libera o gate ANTES de navegar: sem isto o Roteador devolveria a pessoa para cá.
    recarregarAceite();
    Alert.alert('Tudo certo', msg, [{ text: 'Continuar', onPress: () => router.replace('/') }]);
  }

  if (carregando) {
    return (
      <Screen titulo="Termo de adesão" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (erro) {
    return (
      <Screen titulo="Termo de adesão">
        <Aviso texto={erro} />
        <Pressable style={s.botao} onPress={() => { void carregar(); }}>
          <Text style={s.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </Screen>
    );
  }

  if (!dados?.pendente || !dados.termo) {
    return (
      <Screen titulo="Termo de adesão">
        <Aviso texto="Você não tem nenhum termo pendente de aceite." />
      </Screen>
    );
  }

  const plano = dados.plano;

  return (
    <Screen titulo="Termo de adesão" scroll={false}>
      {plano ? (
        <Card>
          <Text style={s.plano}>{plano.nome}</Text>
          <Text style={s.valor}>
            {brl(plano.valor_mensal)}/mês
            {plano.valor_adesao > 0 ? ` · adesão ${brl(plano.valor_adesao)}` : ''}
          </Text>
        </Card>
      ) : null}

      <ScrollView
        style={s.caixaTexto}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          // Margem de 24px: em telas pequenas o offset raramente encosta no valor exato.
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
            setLeuAteOFim(true);
          }
        }}
        scrollEventThrottle={64}
      >
        <Text style={s.texto}>{dados.termo.texto}</Text>
      </ScrollView>

      <Titulo>Dia do vencimento</Titulo>
      <View style={s.linha}>
        {DIAS.map((d) => (
          <Pressable key={d} style={[s.opcao, dia === d && s.opcaoAtiva]} onPress={() => setDia(d)}>
            <Text style={[s.opcaoTxt, dia === d && s.opcaoTxtAtiva]}>dia {d}</Text>
          </Pressable>
        ))}
      </View>

      <Titulo>Forma de pagamento</Titulo>
      <View style={s.linha}>
        {FORMAS.map((f) => (
          <Pressable
            key={f.valor}
            style={[s.opcao, forma === f.valor && s.opcaoAtiva]}
            onPress={() => setForma(f.valor)}
          >
            <Text style={[s.opcaoTxt, forma === f.valor && s.opcaoTxtAtiva]}>{f.rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {!leuAteOFim ? (
        <Text style={s.dica}>Role o termo até o fim para poder aceitar.</Text>
      ) : null}

      <Pressable
        style={[s.botao, (!leuAteOFim || enviando) && s.botaoDesativado]}
        disabled={!leuAteOFim || enviando}
        onPress={() => { void confirmar(); }}
      >
        <Text style={s.botaoTxt}>{enviando ? 'Confirmando…' : 'Li e aceito o termo'}</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  plano: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  valor: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  caixaTexto: {
    maxHeight: 320,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  texto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink, lineHeight: 20 },
  linha: { flexDirection: 'row', gap: space.sm },
  opcao: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  opcaoAtiva: { backgroundColor: color.navy, borderColor: color.navy },
  opcaoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.ink2 },
  opcaoTxtAtiva: { color: color.white },
  dica: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.lg,
  },
  botao: {
    marginTop: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.navy,
    alignItems: 'center',
  },
  botaoDesativado: { opacity: 0.4 },
  botaoTxt: { fontFamily: font.bold, fontSize: size.base, color: color.white },
});
// ── FIM BLOCO ──
