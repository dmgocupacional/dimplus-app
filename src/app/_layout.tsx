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
import { clubeDispensado } from '@/lib/clube';
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
  const { estado, aceitePendente, clube } = useSession();
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
      // volta para o login a cada render. O mesmo vale para `recuperar` (10/09/2026): quem
      // perdeu a senha está, por definição, deslogado — deixá-la fora desta lista fazia a tela
      // abrir e voltar sozinha para o login, sem erro nenhum na tela.
      //
      // ⚠️ ESTA LISTA É FECHADA. Toda tela nova dentro de `(auth)` que deva ser alcançável sem
      // sessão precisa ser adicionada AQUI — senão ela existe, compila, e é inalcançável.
      if (!emAuth || (rota !== 'login' && rota !== 'cadastro' && rota !== 'recuperar' && rota !== 'primeiro-acesso')) {
        router.replace('/login' as never);
      }
      return;
    }

    if (estado === 'aguardando') {
      if (!emAuth || rota !== 'aguardando') router.replace('/aguardando' as never);
      return;
    }

    // 🔴 SOS NUNCA É BLOQUEADO (23/09/2026). As travas abaixo (termo, clube) redirecionam a
    // pessoa para outra tela; numa emergência isso é inaceitável. Quem está no /sos fica no
    // /sos — os botões de ligar não dependem de termo, plano ou adesão a nada.
    if (partes[0] === 'sos') return;

    // ═══ ACEITE PENDENTE — bloqueia o app ═══
    // 26/08/2026. Esta é a peça que faltava: a tela `aceite-termo` existia desde o lote das
    // 14h e NÃO era alcançável por rota nenhuma, então nunca aparecia para ninguém.
    //
    // 🔴 Vem ANTES do redirecionamento de "pronto". Quem tem termo pendente não usa o app:
    // agendar consulta com desconto sem ter aceitado as condições do plano é usar benefício
    // sob regra que a pessoa não concordou.
    //
    // ⚠️ Só bloqueia com `true` explícito. `null` é "ainda não sei" (inclusive falha de rede)
    // e deixa passar — travar o beneficiário fora do próprio exame por causa de um 500 seria
    // pior do que o atraso no aceite.
    if (aceitePendente === true) {
      if (partes[0] !== 'aceite-termo') router.replace('/aceite-termo' as never);
      return;
    }

    // 16/09/2026 — CLUBE DE DESCONTOS, a trava seguinte ao termo.
    // Mesma lógica do aceite e pelo mesmo motivo: só bloqueia com certeza. `clube === null`
    // pode ser "não aderiu" OU falha de leitura, e a tela tem "Agora não" para o segundo
    // caso — por isso ela não repete o `return` do aceite: quem dispensou segue usando o app
    // nesta sessão e volta a ver a trava no próximo carregamento.
    // 21/09/2026: o cartão Vidalink faz parte da mesma trava — sem ele não há desconto em
    // farmácia. Só com a assinatura ATIVA (inativa é caso financeiro, não de cadastro).
    const faltaVidalink = !!clube && clube.ativa && !clube.cartao_vidalink;
    // 25/09/2026: a tela do site do clube (`clube-web`) também é liberada. É nela que a pessoa
    // gera o cartão Vidalink; a trava via "falta o cartão" e a jogava de volta para /clube a
    // cada mudança de tela, no meio da ativação.
    const noClube = partes[0] === 'clube' || partes[0] === 'clube-web';
    if ((clube === null || faltaVidalink) && !noClube && !clubeDispensado()) {
      router.replace('/clube' as never);
      return;
    }

    // pronto
    if (emAuth) router.replace('/' as never);
  }, [estado, aceitePendente, clube, segments, router]);

  if (estado === 'carregando') return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="sos"
        options={{ headerShown: true, title: 'SOS', headerTintColor: color.navy, headerBackTitle: 'Voltar' }}
      />
      {/* 23/09/2026 — clube em WebView com o cabeçalho do DIM+: é o que faz parecer nativo. */}
      <Stack.Screen
        name="clube-web"
        options={{ headerShown: true, title: 'Clube de descontos', headerTintColor: color.navy, headerBackTitle: 'Voltar' }}
      />
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
