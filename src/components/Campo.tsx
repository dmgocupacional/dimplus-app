// ═══ BLOCO: CAMPO DE FORMULÁRIO ═══
// Componente burro. Zero lógica de negócio — só apresentação e acessibilidade.

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { color, font, radius, size, space } from '@/theme/tokens';

type Props = {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  segredo?: boolean;
  ajuda?: string;
  erro?: string;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
  maxLength?: number;
};

export function Campo({
  rotulo,
  valor,
  onChange,
  placeholder,
  segredo,
  ajuda,
  erro,
  keyboardType,
  autoCapitalize = 'none',
  maxLength,
}: Props) {
  const [revelado, setRevelado] = useState(false);
  const escondido = !!segredo && !revelado;

  return (
    <View style={s.wrap}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <View style={[s.caixa, !!erro && s.caixaErro]}>
        <TextInput
          style={s.input}
          value={valor}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.ink3}
          secureTextEntry={escondido}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          accessibilityLabel={rotulo}
        />
        {segredo ? (
          <Pressable
            onPress={() => setRevelado((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revelado ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Ionicons name={revelado ? 'eye-off' : 'eye'} size={20} color={color.ink3} />
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <Text style={s.erro}>{erro}</Text>
      ) : ajuda ? (
        <Text style={s.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  rotulo: {
    fontFamily: font.bold,
    fontSize: size.sm,
    color: color.ink,
    marginBottom: space.xs + 2,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 52,
  },
  caixaErro: { borderColor: color.danger },
  input: { flex: 1, fontFamily: font.regular, fontSize: size.base, color: color.ink },
  ajuda: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, marginTop: space.xs },
  erro: { fontFamily: font.medium, fontSize: size.xs, color: color.danger, marginTop: space.xs },
});
// ── FIM BLOCO ──
