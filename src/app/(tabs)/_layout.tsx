// ═══ BLOCO: TAB BAR ═══
// 4 abas, exatamente como o mockup aprovado. Cartão digital mora na Início.
// Ajuda é tela interna (entra pelo Perfil e pelo card de suporte da Início).

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { color, font } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.navy,
        tabBarInactiveTintColor: color.ink3,
        tabBarStyle: {
          backgroundColor: color.white,
          borderTopColor: color.border,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="home" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="rede"
        options={{
          title: 'Rede',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="location" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: 'Financeiro',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="receipt" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="person" size={size} color={c} />,
        }}
      />
    </Tabs>
  );
}
// ── FIM BLOCO ──
