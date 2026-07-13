// ═══ BLOCO: TELA — REDE PARCEIRA ═══
// Módulo PAGO (exige_pagamento=true). Inadimplente vê o bloqueio, não a lista.

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, LinhaLista, Pill, Screen } from '@/components/ui';
import { mensagemBloqueio } from '@/lib/gate';
import type { Parceiro } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

const CATEGORIAS = ['Todas', 'Farmácia', 'Clínica', 'Laboratório', 'Odontologia'] as const;

export default function Rede() {
  const { carregando, rede, pode } = useSession();
  const [filtro, setFiltro] = useState<(typeof CATEGORIAS)[number]>('Todas');

  const veredito = pode('rede');

  const lista = useMemo<Parceiro[]>(
    () => (filtro === 'Todas' ? rede : rede.filter((p) => p.categoria === filtro)),
    [rede, filtro]
  );

  if (carregando) {
    return (
      <Screen titulo="Rede parceira" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (!veredito.pode) {
    return (
      <Screen titulo="Rede parceira">
        <Card style={s.bloqueio}>
          <View style={s.cadeadoGrande}>
            <Ionicons name="lock-closed" size={26} color={color.danger} />
          </View>
          <Text style={s.bloqTitulo}>Rede indisponível</Text>
          <Text style={s.bloqTxt}>{mensagemBloqueio(veredito.motivo)}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen titulo="Rede parceira">
      <Text style={s.intro}>
        Descontos e condições especiais nos parceiros DIM+ perto de você.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {CATEGORIAS.map((c) => (
          <Pressable key={c} onPress={() => setFiltro(c)}>
            <View style={[s.chip, filtro === c && s.chipOn]}>
              <Text style={[s.chipTxt, filtro === c && s.chipTxtOn]}>{c}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {lista.length === 0 ? (
        <Text style={s.vazio}>Nenhum parceiro nesta categoria por enquanto.</Text>
      ) : (
        lista.map((p) => (
          <LinhaLista
            key={p.id}
            icone={p.categoria === 'Farmácia' ? 'medkit' : 'business'}
            titulo={p.nome}
            subtitulo={`${p.endereco} · ${p.cidade}`}
            direita={<Pill texto={p.beneficio} tom="ok" />}
          />
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    marginBottom: space.lg,
  },
  chips: { gap: space.sm, paddingBottom: space.lg },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.navy, borderColor: color.navy },
  chipTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
  chipTxtOn: { color: color.white },
  vazio: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.xxl,
  },

  bloqueio: { alignItems: 'center', paddingVertical: space.xxl, gap: space.md },
  cadeadoGrande: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FBE6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqTitulo: { fontFamily: font.bold, fontSize: size.lg, color: color.ink },
  bloqTxt: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    textAlign: 'center',
  },
});
// ── FIM BLOCO ──
