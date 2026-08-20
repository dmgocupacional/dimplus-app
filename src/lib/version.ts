// ═══ BLOCO: VERSÃO ═══
// Regra herdada do ERP: bump em TODA entrega. Patch = fix, Minor = feature.
// Aqui a versão vive em DOIS lugares — manter os dois no MESMO commit:
//   1. este arquivo (APP_VERSION / APP_VERSION_DATA) — visível no Perfil
//   2. package.json + app.json (campo "version") — usado pelo EAS Build
export const APP_VERSION = '0.7.0';
export const APP_VERSION_DATA = '19/08/2026';
// ── FIM BLOCO ──
