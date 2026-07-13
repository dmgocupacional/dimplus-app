// ═══ BLOCO: ROOT LAYOUT ═══
import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/state/session';
import { color } from '@/theme/tokens';

export default function RootLayout() {
  const [fontesProntas] = useFonts({
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontesProntas) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color.navy,
        }}
      >
        <ActivityIndicator color={color.green} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="ajuda"
            options={{ headerShown: true, title: 'Ajuda', headerTintColor: color.navy }}
          />
          <Stack.Screen
            name="dev"
            options={{
              headerShown: true,
              title: 'Painel de desenvolvimento',
              presentation: 'modal',
              headerTintColor: color.navy,
            }}
          />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
// ── FIM BLOCO ──
