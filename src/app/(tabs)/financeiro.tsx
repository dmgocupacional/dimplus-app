// ═══ BLOCO: TELA — FINANCEIRO ═══
//
// Este módulo tem exige_pagamento = FALSE, de propósito. O cliente inadimplente PRECISA
// ver a fatura para poder pagá-la — bloquear aqui seria um beco sem saída. Foi exatamente
// o bug corrigido no roadmap (o estado `suspenso` usa a mesma porta do inadimplente).
// Se alguém, um dia, "consertar" isso ligando exige_pagamento, terá quebrado a cobrança.

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Pill, Screen, Titulo } from '@/components/ui';
import { compareISO, formatBRL, formatData } from '@/lib/format';
import type { Fatura, PagamentoStatus } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

// ⚠️ ESTA FUNÇÃO PRECISA TOLERAR STATUS DESCONHECIDO — o comentário do data.ts já avisava
// disso, e mesmo assim ela quebrou. Até 17/08/2026 era um switch sem `default` cobrindo 5
// status, enquanto a produção tinha 9: RECEIVED_IN_CASH (487 registros), DELETED (291),
// REFUNDED (28) e DUNNING_RECEIVED (1) caíam fora, a função devolvia undefined, e o
// `st.texto` da linha de render derrubava a tela inteira em preto.
//
// `pagamentos.status` é `text` SEM CHECK e vem cru do Asaas. Um status novo entra sem aviso.
// O `default` abaixo não é zelo excessivo: é a única coisa entre um lançamento do Asaas e a
// aba Financeiro fora do ar. NÃO REMOVER, mesmo que o switch pareça exaustivo.
function rotuloStatus(st: PagamentoStatus): { texto: string; tom: 'ok' | 'aviso' | 'erro' | 'neutro' } {
  switch (st) {
    case 'RECEIVED':
    case 'CONFIRMED':
    // Pago presencialmente na clínica — dinheiro na mão, quitado. É o 4º status mais comum
    // da base; tratá-lo como desconhecido faria a fatura paga parecer pendente.
    case 'RECEIVED_IN_CASH':
    // Cobrança em negativação que acabou paga. Para o cliente, é pago.
    case 'DUNNING_RECEIVED':
      return { texto: 'pago', tom: 'ok' };
    case 'PENDING':
      return { texto: 'a vencer', tom: 'aviso' };
    case 'OVERDUE':
    case 'DUNNING_REQUESTED':
      return { texto: 'em atraso', tom: 'erro' };
    case 'REFUNDED':
      return { texto: 'estornada', tom: 'neutro' };
    // Cobrança cancelada. Permanece VISÍVEL por decisão do Henrique (17/08/2026): a lista
    // não esconde dado do cliente; o tom neutro já sinaliza que não há nada a pagar.
    case 'DELETED':
      return { texto: 'cancelada', tom: 'neutro' };
    default:
      return { texto: 'em processamento', tom: 'neutro' };
  }
}

export default function Financeiro() {
  const { carregando, faturas, adimplente, cliente } = useSession();

  const ordenadas = useMemo<Fatura[]>(
    () => [...faturas].sort((a, b) => compareISO(b.vencimento, a.vencimento)),
    [faturas]
  );

  const emAberto = ordenadas.filter(
    (f) => f.status === 'OVERDUE' || f.status === 'DUNNING_REQUESTED'
  );
  const totalDevido = emAberto.reduce((acc, f) => acc + f.valor, 0);

  if (carregando) {
    return (
      <Screen titulo="Financeiro" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  // Dependente NÃO tem financeiro próprio: `asaas_id` é NULL e a cobrança fica no titular.
  // A lista vazia aqui é o resultado CORRETO da policy, não falha de carregamento — sem esta
  // tela dedicada o dependente veria "Tudo em dia / nenhuma fatura" e acharia que não deve
  // nada, quando na verdade a fatura dele existe no nome de outra pessoa.
  if (cliente?.dependente) {
    return (
      <Screen titulo="Financeiro">
        <Card style={s.emDia}>
          <View style={s.emDiaIcon}>
            <Ionicons name="people" size={22} color={color.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.emDiaTitulo}>Cobrança no titular</Text>
            <Text style={s.emDiaSub}>
              Você é dependente do plano. As faturas ficam no nome do titular.
            </Text>
          </View>
        </Card>
        <Aviso
          tom="info"
          icone="information-circle"
          texto="Precisa de 2ª via ou quer conferir o pagamento? Fale com a central pelo menu Ajuda."
        />
      </Screen>
    );
  }

  return (
    <Screen titulo="Financeiro">
      {!adimplente ? (
        <Card style={s.devendo}>
          <Text style={s.devendoRotulo}>Total em aberto</Text>
          <Text style={s.devendoValor}>{formatBRL(totalDevido)}</Text>
          <Text style={s.devendoTxt}>
            Regularize para reativar os seus benefícios. O pagamento cai em até 1 dia útil.
          </Text>
        </Card>
      ) : (
        <Card style={s.emDia}>
          <View style={s.emDiaIcon}>
            <Ionicons name="checkmark-circle" size={22} color={color.greenDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.emDiaTitulo}>Tudo em dia</Text>
            <Text style={s.emDiaSub}>Nenhuma fatura em atraso.</Text>
          </View>
        </Card>
      )}

      <Titulo>Suas faturas</Titulo>
      {ordenadas.length === 0 ? (
        <Card>
          <Text style={s.vazio}>
            Nenhuma fatura registrada ainda. Se você acabou de aderir, ela aparece assim que a
            cobrança for gerada.
          </Text>
        </Card>
      ) : null}
      {ordenadas.map((f) => {
        const st = rotuloStatus(f.status);
        return (
          <Card key={f.id} style={s.fatura}>
            <View style={{ flex: 1 }}>
              <Text style={s.faturaDesc}>{f.descricao}</Text>
              <Text style={s.faturaVenc}>Vencimento {formatData(f.vencimento)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <Text style={s.faturaValor}>{formatBRL(f.valor)}</Text>
              <Pill texto={st.texto} tom={st.tom} />
            </View>
          </Card>
        );
      })}

      <Aviso
        tom="info"
        icone="information-circle"
        texto="O pagamento online chega na próxima versão. Por enquanto, fale com a central pelo menu Ajuda."
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  devendo: { backgroundColor: color.navy, borderColor: color.navy, gap: 4 },
  devendoRotulo: {
    fontFamily: font.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: color.sky,
  },
  devendoValor: { fontFamily: font.black, fontSize: 30, color: color.white },
  devendoTxt: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.sky,
    marginTop: space.xs,
  },

  emDia: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emDiaIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emDiaTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  emDiaSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },

  fatura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.sm,
  },
  faturaDesc: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  faturaVenc: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  faturaValor: { fontFamily: font.black, fontSize: size.lg, color: color.ink },
  vazio: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, lineHeight: 20 },
});
// ── FIM BLOCO ──
