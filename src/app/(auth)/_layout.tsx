// ═══ BLOCO: LAYOUT — AUTENTICAÇÃO ═══
// Stack sem header. Cada tela desenha o próprio topo com a marca.
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
// ── FIM BLOCO ──
