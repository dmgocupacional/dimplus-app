// ═══ BLOCO: ROOT LAYOUT ═══
//
// Aqui mora a ÚNICA decisão de para onde o app manda a pessoa. As telas não navegam por
// conta própria depois de logar/deslogar: se o login empurrasse a rota E este layout também,
// seriam duas fontes de verdade para a mesma decisão, e elas divergem no primeiro caso de
// borda (token expirado durante o uso, logout em outra aba do Expo Go, conta aprovada
// enquanto a tela de espera estava aberta).
//
// Mapa: carregando → splash · deslogado → (auth)/login · aguardando → (auth)/aguardando ·
// pronto → (tabs).

import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErroBoundary } from '@/components/ErroBoundary';
import { SessionProvider, useSession } from '@/state/session';
import { color } from '@/theme/tokens';

function Splash() {
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

function Roteador() {
  const { estado } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (estado === 'carregando') return;

    // `useSegments` é tipado a partir das rotas conhecidas e nem sempre admite índice 1;
    // aqui só interessa o par (grupo, tela), então lê-se como string[].
    const partes = segments as unknown as string[];
    const emAuth = partes[0] === '(auth)';
    const rota = partes[1];

    if (estado === 'deslogado') {
      // Cadastro é uma tela DE deslogado: quem está criando acesso não pode ser chutado de
      // volta para o login a cada render.
      if (!emAuth || (rota !== 'login' && rota !== 'cadastro')) {
        router.replace('/login' as never);
      }
      return;
    }

    if (estado === 'aguardando') {
      if (!emAuth || rota !== 'aguardando') router.replace('/aguardando' as never);
      return;
    }

    // pronto
    if (emAuth) router.replace('/' as never);
  }, [estado, segments, router]);

  if (estado === 'carregando') return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen
        name="ajuda"
        options={{ headerShown: true, title: 'Ajuda', headerTintColor: color.navy }}
      />
      {/* Rota EMPILHADA, não aba: o app tem 4 abas por decisão de produto, e qualquer
          arquivo dentro de (tabs)/ viraria uma quinta automaticamente. Entra pelo Perfil. */}
      <Stack.Screen
        name="dependentes"
        options={{ headerShown: true, title: 'Dependentes', headerTintColor: color.navy }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontesProntas] = useFonts({
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontesProntas) return <Splash />;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        {/* DENTRO dos providers de propósito: o boundary usa tokens de tema e a versão do
            app para montar a tela de erro. Fora daqui, um crash na própria tela de erro
            voltaria ao preto — que é justamente o que este bloco existe para eliminar. */}
        <ErroBoundary local="raiz">
          <Roteador />
        </ErroBoundary>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
// ── FIM BLOCO ──
