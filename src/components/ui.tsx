// ═══ BLOCO: PRIMITIVOS DE UI ═══
// Componentes burros. Zero lógica de negócio — só apresentação.

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, radius, size, space } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ─── Screen ─────────────────────────────────────────────────────────────────
export function Screen({
  children,
  titulo,
  scroll = true,
}: {
  children: ReactNode;
  titulo?: string;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const conteudo = (
    <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 }}>
      {titulo ? <Text style={s.tituloTela}>{titulo}</Text> : null}
      {children}
    </View>
  );
  if (!scroll) {
    return (
      <View style={[s.tela, { paddingTop: insets.top + space.md }]}>{conteudo}</View>
    );
  }
  return (
    <ScrollView
      style={s.tela}
      contentContainerStyle={{ paddingTop: insets.top + space.md }}
      showsVerticalScrollIndicator={false}
    >
      {conteudo}
    </ScrollView>
  );
}

// ─── Texto ──────────────────────────────────────────────────────────────────
export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={s.secao}>{children}</Text>;
}

// ─── Pill ───────────────────────────────────────────────────────────────────
export function Pill({
  texto,
  tom = 'ok',
}: {
  texto: string;
  tom?: 'ok' | 'aviso' | 'erro' | 'neutro';
}) {
  return (
    <View style={[s.pill, s[`pill_${tom}`]]}>
      <Text style={[s.pillTxt, s[`pillTxt_${tom}`]]}>{texto}</Text>
    </View>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// ─── Aviso ──────────────────────────────────────────────────────────────────
export function Aviso({
  texto,
  tom = 'erro',
  icone = 'alert-circle',
}: {
  texto: string;
  tom?: 'erro' | 'aviso' | 'info';
  icone?: IconName;
}) {
  const cor = tom === 'erro' ? color.danger : tom === 'aviso' ? color.warning : color.navy600;
  return (
    <View style={[s.aviso, { borderLeftColor: cor }]}>
      <Ionicons name={icone} size={18} color={cor} />
      <Text style={s.avisoTxt}>{texto}</Text>
    </View>
  );
}

// ─── Tile (acesso rápido) ───────────────────────────────────────────────────
export function Tile({
  icone,
  rotulo,
  bloqueado,
  emBreve,
  onPress,
}: {
  icone: IconName;
  rotulo: string;
  bloqueado?: boolean;
  emBreve?: boolean;
  onPress: () => void;
}) {
  const apagado = bloqueado || emBreve;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.tile, apagado && s.tileOff, pressed && s.tilePress]}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!apagado }}
    >
      <View style={[s.tileIcon, apagado && s.tileIconOff]}>
        <Ionicons
          name={icone}
          size={20}
          color={apagado ? color.ink3 : color.navy}
        />
      </View>
      <Text style={[s.tileTxt, apagado && s.tileTxtOff]} numberOfLines={2}>
        {rotulo}
      </Text>
      {bloqueado ? (
        <View style={s.cadeado}>
          <Ionicons name="lock-closed" size={11} color={color.white} />
        </View>
      ) : null}
      {emBreve && !bloqueado ? (
        <View style={s.emBreve}>
          <Text style={s.emBreveTxt}>em breve</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Linha de lista ─────────────────────────────────────────────────────────
export function LinhaLista({
  icone,
  titulo,
  subtitulo,
  direita,
  onPress,
}: {
  icone?: IconName;
  titulo: string;
  subtitulo?: string;
  direita?: ReactNode;
  onPress?: () => void;
}) {
  const miolo = (
    <>
      {icone ? (
        <View style={s.linhaIcon}>
          <Ionicons name={icone} size={18} color={color.navy} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.linhaTitulo}>{titulo}</Text>
        {subtitulo ? <Text style={s.linhaSub}>{subtitulo}</Text> : null}
      </View>
      {direita}
    </>
  );

  // View NÃO aceita `style` como função — só Pressable. Ramificar, não unificar.
  if (!onPress) return <View style={s.linha}>{miolo}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.linha, pressed && s.linhaPress]}
    >
      {miolo}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  tituloTela: {
    fontFamily: font.black,
    fontSize: size.xxl,
    color: color.ink,
    marginBottom: space.lg,
  },
  secao: {
    fontFamily: font.bold,
    fontSize: size.lg,
    color: color.ink,
    marginTop: space.xl,
    marginBottom: space.md,
  },

  card: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: color.border,
  },

  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pill_ok: { backgroundColor: color.greenBg },
  pill_aviso: { backgroundColor: '#FDF0DC' },
  pill_erro: { backgroundColor: '#FBE6E6' },
  pill_neutro: { backgroundColor: color.offwhite },
  pillTxt: { fontFamily: font.bold, fontSize: size.xs },
  pillTxt_ok: { color: color.greenDeep },
  pillTxt_aviso: { color: '#A96A0C' },
  pillTxt_erro: { color: color.danger },
  pillTxt_neutro: { color: color.ink2 },

  aviso: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    backgroundColor: color.white,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    padding: space.md,
    marginTop: space.md,
  },
  avisoTxt: { flex: 1, fontFamily: font.regular, fontSize: size.sm, color: color.ink2 },

  tile: {
    width: '22%', // 4 por linha: 4×22% + 3×8px de gap cabe em qualquer largura de celular
    aspectRatio: 0.86,
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  tileOff: { backgroundColor: '#FAFAFA' },
  tilePress: { opacity: 0.6 },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconOff: { backgroundColor: color.offwhite },
  tileTxt: {
    fontFamily: font.medium,
    fontSize: 10,
    color: color.ink,
    textAlign: 'center',
    lineHeight: 12,
  },
  tileTxtOff: { color: color.ink3 },
  cadeado: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emBreve: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: color.offwhite,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  emBreveTxt: { fontFamily: font.bold, fontSize: 7, color: color.ink3 },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.sm,
  },
  linhaPress: { opacity: 0.7 },
  linhaIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  linhaSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
});
// ── FIM BLOCO ──
