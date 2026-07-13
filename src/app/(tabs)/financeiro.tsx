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

function rotuloStatus(st: PagamentoStatus): { texto: string; tom: 'ok' | 'aviso' | 'erro' } {
  switch (st) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return { texto: 'pago', tom: 'ok' };
    case 'PENDING':
      return { texto: 'a vencer', tom: 'aviso' };
    case 'OVERDUE':
    case 'DUNNING_REQUESTED':
      return { texto: 'em atraso', tom: 'erro' };
  }
}

export default function Financeiro() {
  const { carregando, faturas, adimplente } = useSession();

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
});
// ── FIM BLOCO ──
