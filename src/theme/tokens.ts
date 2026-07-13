// ═══ BLOCO: TOKENS DE MARCA ═══
// Fonte: brand book DIM+ SAÚDE (Luís Fonseca, 22/05/2026) + mockup aprovado 13/07/2026.
// ATENÇÃO: o PDF do brand book rotula TODOS os swatches como #9ACED3 — é erro de
// placeholder do arquivo. Os valores abaixo vieram dos pixels reais. Não "corrigir"
// para #9ACED3.

export const color = {
  navy: '#202745', // primária
  navy900: '#161B30',
  navy600: '#34406B',

  green: '#3EEE92', // ação / destaque
  greenDeep: '#17B968',
  greenBg: '#E4FBEF',

  sky: '#ACD1FF', // secundária
  gray: '#A5A6A5', // neutro
  offwhite: '#F1F2F1',
  white: '#FFFFFF',

  danger: '#E24B4A',
  warning: '#EF9F27',

  ink: '#202745', // texto forte
  ink2: '#5E6577', // texto médio
  ink3: '#9AA0AE', // texto fraco

  border: '#E7E9E9',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

// Nunito — fallback livre da Congenial (comercial, exige licença para embutir no app).
// Decisão registrada no ROADMAP-APP, item 3 de "Decisões em aberto".
export const font = {
  light: 'Nunito_300Light',
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  black: 'Nunito_800ExtraBold',
} as const;

export const size = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
} as const;
// ── FIM BLOCO ──
