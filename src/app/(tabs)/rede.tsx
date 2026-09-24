// ═══ BLOCO: TELA — REDE ═══
// Módulo PAGO (exige_pagamento=true). Inadimplente vê o bloqueio, não a lista.
//
// 24/09/2026 — reescrita. Antes: cinco "parceiros" escritos à mão no código, sem parceria real
// (e isso foi para a revisão da Apple na 4.23.0). Agora a tela mostra SÓ o que é verdadeiro:
//   1. as unidades DIMEG, lidas do banco, com rota, ligação e atalho para agendar;
//   2. o localizador oficial de farmácias Vidalink, no convênio da DIMEG;
//   3. o clube de descontos.
// 🔴 Não voltar a listar empresa sem parceria cadastrada. Parceiro novo = fonte real no ERP.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts) para rota, ligação e localizador.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen } from '@/components/ui';
import { abrirFarmaciasVidalink, abrirRota, ligarPara } from '@/lib/clube';
import { mensagemBloqueio } from '@/lib/gate';
import type { UnidadeRede } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

function enderecoCompleto(u: UnidadeRede): string {
  return [u.endereco, u.bairro, `${u.cidade} - ${u.uf}`, u.cep].filter(Boolean).join(', ');
}

function Acao({
  icone,
  rotulo,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.acao} hitSlop={6}>
      <Ionicons name={icone} size={16} color={color.navy} />
      <Text style={s.acaoTxt}>{rotulo}</Text>
    </Pressable>
  );
}

function CartaoUnidade({ u }: { u: UnidadeRede }) {
  return (
    <Card style={s.unidade}>
      <View style={s.unidadeTopo}>
        <View style={s.icone}>
          <Ionicons name="business" size={20} color={color.navy} />
        </View>
        <View style={s.unidadeTexto}>
          <Text style={s.unidadeNome}>{u.nome}</Text>
          <Text style={s.unidadeEnd}>
            {u.endereco}
            {u.bairro ? ` · ${u.bairro}` : ''}
          </Text>
          <Text style={s.unidadeEnd}>
            {u.cidade} - {u.uf}
          </Text>
        </View>
      </View>
      <View style={s.acoes}>
        <Acao icone="navigate" rotulo="Como chegar" onPress={() => abrirRota(enderecoCompleto(u))} />
        {u.telefone ? (
          <Acao icone="call" rotulo="Ligar" onPress={() => ligarPara(u.telefone as string)} />
        ) : null}
        {u.agendaOnline ? (
          <Acao icone="calendar" rotulo="Agendar" onPress={() => router.push('/agendar' as never)} />
        ) : null}
      </View>
    </Card>
  );
}

export default function Rede() {
  const { carregando, rede, pode } = useSession();
  const veredito = pode('rede');

  if (carregando) {
    return (
      <Screen titulo="Rede" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (!veredito.pode) {
    return (
      <Screen titulo="Rede">
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
    <Screen titulo="Rede">
      <Text style={s.intro}>Onde usar o seu DIM+ e os benefícios do seu plano.</Text>

      <Text style={s.secao}>CLÍNICAS DIMEG</Text>
      {rede.length === 0 ? (
        <Text style={s.vazio}>Não foi possível carregar as unidades agora. Tente de novo em instantes.</Text>
      ) : (
        rede.map((u) => <CartaoUnidade key={u.id} u={u} />)
      )}

      <Text style={s.secao}>FARMÁCIAS</Text>
      <Pressable onPress={() => void abrirFarmaciasVidalink()}>
        <Card style={s.atalho}>
          <View style={[s.icone, s.iconeVerde]}>
            <Ionicons name="medkit" size={20} color={color.greenDeep} />
          </View>
          <View style={s.atalhoTexto}>
            <Text style={s.atalhoTitulo}>Farmácias Vidalink</Text>
            <Text style={s.atalhoSub}>Encontre as farmácias conveniadas perto de você.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.ink3} />
        </Card>
      </Pressable>

      <Text style={s.secao}>DESCONTOS</Text>
      <Pressable onPress={() => router.push('/clube' as never)}>
        <Card style={s.atalho}>
          <View style={[s.icone, s.iconeVerde]}>
            <Ionicons name="pricetags" size={20} color={color.greenDeep} />
          </View>
          <View style={s.atalhoTexto}>
            <Text style={s.atalhoTitulo}>Clube de descontos</Text>
            <Text style={s.atalhoSub}>Ofertas em produtos e serviços de parceiros.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.ink3} />
        </Card>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { fontFamily: font.regular, fontSize: size.base, color: color.ink2, marginBottom: space.md },
  secao: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: color.ink3,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  vazio: { fontFamily: font.regular, fontSize: size.sm, color: color.ink3 },
  unidade: { marginBottom: space.sm },
  unidadeTopo: { flexDirection: 'row', gap: space.md },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.offwhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeVerde: { backgroundColor: color.greenBg },
  unidadeTexto: { flex: 1 },
  unidadeNome: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  unidadeEnd: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  acaoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  atalhoTexto: { flex: 1 },
  atalhoTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  atalhoSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },

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
  bloqTxt: { fontFamily: font.regular, fontSize: size.base, color: color.ink2, textAlign: 'center' },
});
// ── FIM BLOCO ──
