// ═══ BLOCO: TELA — INÍCIO ═══
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CartaoClube } from '@/components/CartaoClube';
import { CartaoDigital } from '@/components/CartaoDigital';
import { Aviso, Card, Screen, Tile, Titulo } from '@/components/ui';
import { abrirTelemedicina } from '@/lib/clube';
import { mensagemBloqueio } from '@/lib/gate';
import type { ModuloKey } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

type Atalho = {
  key: ModuloKey;
  rotulo: string;
  icone: ComponentProps<typeof Ionicons>['name'];
  rota: string | null;
};

const ATALHOS: Atalho[] = [
  // 21/09/2026: "Rede parceira" saiu do acesso rápido (a aba Rede continua na barra) e deu
  // lugar ao clube. `/clube` decide a etapa pelo estado: adesão, cartão Vidalink ou pronto.
  { key: 'clube', rotulo: 'Clube de descontos', icone: 'pricetags', rota: '/clube' },
  { key: 'financeiro', rotulo: 'Financeiro', icone: 'receipt', rota: '/financeiro' },
  // ✅ 19/08/2026 (S2-L3): tela `/agendar` existe. Mesmo raciocínio do `exames` (18/08):
  // a flag `agendamento` já está `ativo=true` em produção — `rota: null` deixaria este
  // tile cair no mesmo "toque morto" do `sos`.
  { key: 'agendamento', rotulo: 'Agendar', icone: 'calendar', rota: '/agendar' },
  // ✅ 19/08/2026 (S2-L2): tela `/exames` existe. Até aqui `rota` era `null` de propósito
  // porque a tela não existia; o comentário antigo dizia que a flag `exames` estava
  // `ativo=false` — isso ficou DESATUALIZADO em 18/08 (a flag foi ligada em produção,
  // ver `erp-dimplus/docs/ROADMAP-APP.md` FASE 2). Com `rota: null` e flag ligada, o tile
  // já estava caindo no mesmo bug de "toque morto" do `sos` logo abaixo — corrigido aqui.
  { key: 'exames', rotulo: 'Exames', icone: 'document-text', rota: '/exames' },
  // 23/09/2026 — Telemedicina ligada: provedor é o Dr. Achei (/telemedicina/solicitar). Não
  // tem rota própria — o toque abre o atendimento direto (→ BLOCO: CLUBE DE DESCONTOS).
  { key: 'telemedicina', rotulo: 'Telemedicina', icone: 'videocam', rota: null },
  // 🔴 TOQUE MORTO CONHECIDO (apurado 17/08/2026, correção adiada pelo Henrique).
  // `app_features.sos` está ativo=true / exige_pagamento=false, logo `pode('sos')` devolve
  // sempre true e `emBreve` é false. Com `rota: null`, `abrir()` não navega, não bloqueia e
  // não mostra toast: o tile parece aberto e o toque não faz NADA. `telemedicina` segue
  // com `rota: null` de propósito — `ativo=false` de fato (provedor não escolhido).
  // `agendamento` e `exames` já têm tela e rota desde 18-19/08.
  // Três saídas possíveis pro `sos`, decisão pendente: (a) toast "em breve", (b) forçar
  // emBreve na tela — mentira leve, a flag está ligada, (c) desligar a flag no banco.
  { key: 'sos', rotulo: 'SOS', icone: 'medkit', rota: null },
  { key: 'ajuda', rotulo: 'Ajuda', icone: 'help-circle', rota: '/ajuda' },
];

/** Quanto do 2º cartão fica à mostra, para indicar que o carrossel desliza. */
const ESPIADA = 28;

export default function Inicio() {
  const { carregando, cliente, acesso, adimplente, elegivel, clube, pode, modulo } = useSession();
  const { width } = useWindowDimensions();
  const [toast, setToast] = useState<string | null>(null);
  const [abrindoTele, setAbrindoTele] = useState(false);
  // ═══ BLOCO: CARROSSEL DE CARTÕES ═══
  // 21/09/2026: o carrossel não se mostrava — o 1º cartão ocupava a tela toda, sem marcador,
  // e o pagingEnabled (pula a largura da TELA) parava o 2º cartão torto. Agora: o cartão fica
  // ESPIADA px mais estreito para a borda do seguinte aparecer, o snap é pela largura exata
  // do cartão e há pontos + nome do cartão visível. Com um cartão só, nada disso aparece.
  const carrosselRef = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  const temClube = !!clube;
  const larguraCartao = width - space.lg * 2 - (temClube ? ESPIADA : 0);
  const passo = larguraCartao + space.md;
  // ── FIM BLOCO ──

  if (carregando || !cliente) {
    return (
      <Screen scroll={false}>
        <View style={s.load}>
          <ActivityIndicator color={color.navy} />
        </View>
      </Screen>
    );
  }

  const primeiroNome = cliente.nome.split(' ')[0];
  const inelegivel = acesso !== 'bloqueado' && !elegivel;
  // Fatura em aberto é a causa que a pessoa resolve sozinha; o resto (cancelado, encerrado)
  // passa pela central.
  const bloqueadoPorAtraso = inelegivel && !adimplente;
  const planoInativo = inelegivel && adimplente;

  function abrir(a: Atalho) {
    const veredito = pode(a.key);
    if (!veredito.pode) {
      setToast(mensagemBloqueio(veredito.motivo));
      setTimeout(() => setToast(null), 2600);
      return;
    }
    if (a.key === 'telemedicina') {
      void iniciarTelemedicina();
      return;
    }
    if (a.rota) router.push(a.rota as never);
  }

  // 🔴 Cada toque CRIA um atendimento no parceiro. Por isso a confirmação antes, e a trava
  // de `abrindoTele` contra toque duplo — dois toques seriam duas consultas abertas.
  function iniciarTelemedicina() {
    if (abrindoTele) return;
    Alert.alert(
      'Iniciar atendimento',
      'Vamos abrir uma consulta de telemedicina agora. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            setAbrindoTele(true);
            const r = await abrirTelemedicina();
            setAbrindoTele(false);
            if (!r.ok) {
              setToast(r.mensagem);
              setTimeout(() => setToast(null), 3200);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={s.saudacao}>
          <Text style={s.ola}>Olá, {primeiroNome}</Text>
          <Text style={s.sub}>Que bom ter você por aqui.</Text>
        </View>

        {/* Carrossel: cartão DIM+ e, ao lado, o cartão Vidalink de farmácia (21/09/2026).
            Com assinatura sem Vidalink, o segundo cartão aparece PENDENTE e leva à geração.
            Com um cartão só, o ScrollView não rola e o visual fica igual ao de antes. */}
        <ScrollView
          ref={carrosselRef}
          horizontal
          scrollEnabled={temClube}
          snapToInterval={passo}
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          style={s.carrossel}
          // paddingRight com a espiada: sem ela o 2º cartão nunca chegaria ao ponto de snap.
          contentContainerStyle={{ paddingLeft: space.lg, paddingRight: space.lg + (temClube ? ESPIADA : 0) }}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const p = Math.min(1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / passo)));
            if (p !== pagina) setPagina(p);
          }}
        >
          <View style={{ width: larguraCartao }}>
            <CartaoDigital
              cliente={cliente}
              acesso={acesso}
              elegivel={elegivel}
              adimplente={adimplente}
            />
          </View>
          {clube ? (
            <View style={{ width: larguraCartao, marginLeft: space.md }}>
              <Pressable onPress={() => router.push('/clube' as never)}>
                <CartaoClube
                  nome={cliente.nome ?? ''}
                  numero={clube.cartao_vidalink}
                  ativo={clube.ativa && elegivel}
                />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        {temClube ? (
          <View style={s.paginacao}>
            <Text style={s.paginaNome}>{pagina === 0 ? 'Cartão DIM+' : 'Cartão de farmácia'}</Text>
            <View style={s.pontos}>
              {[0, 1].map((i) => (
                <Pressable
                  key={i}
                  hitSlop={10}
                  accessibilityLabel={i === 0 ? 'Ver cartão DIM+' : 'Ver cartão de farmácia'}
                  onPress={() => carrosselRef.current?.scrollTo({ x: i * passo, animated: true })}
                >
                  <View style={[s.ponto, pagina === i && s.pontoAtivo]} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {bloqueadoPorAtraso ? (
          <Aviso texto="Há uma fatura em aberto. Seus benefícios estão bloqueados até a regularização." />
        ) : null}
        {planoInativo ? (
          <Aviso texto="Seu plano não está ativo no momento. Fale com a central para saber como reativar." />
        ) : null}
        {acesso === 'bloqueado' ? (
          <Aviso texto="Seu acesso ao app ainda não foi liberado. Fale com a central de atendimento." />
        ) : null}

        <Titulo>Acesso rápido</Titulo>
        <View style={s.grade}>
          {ATALHOS.map((a) => {
            const m = modulo(a.key);
            const veredito = pode(a.key);
            const emBreve = !!m && !m.ativo;
            return (
              <Tile
                key={a.key}
                icone={a.icone}
                rotulo={a.rotulo}
                emBreve={emBreve}
                bloqueado={!veredito.pode && !emBreve}
                onPress={() => abrir(a)}
              />
            );
          })}
        </View>

        <Titulo>Precisa de ajuda?</Titulo>
        <Pressable onPress={() => router.push('/ajuda' as never)}>
          <Card style={s.suporte}>
            <View style={s.suporteIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color={color.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.suporteTitulo}>Central de atendimento</Text>
              <Text style={s.suporteSub}>Tire dúvidas sobre o seu plano e a rede.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={color.ink3} />
          </Card>
        </Pressable>
      </Screen>

      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  carrossel: { marginHorizontal: -space.lg },
  paginacao: { alignItems: 'center', marginTop: space.sm, marginBottom: space.xs },
  paginaNome: { fontFamily: font.bold, fontSize: size.xs, color: color.ink3, letterSpacing: 0.5 },
  pontos: { flexDirection: 'row', gap: 6, marginTop: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border },
  pontoAtivo: { width: 18, backgroundColor: color.navy },
  load: { paddingTop: 80, alignItems: 'center' },
  saudacao: { marginBottom: space.lg },
  ola: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  sub: { fontFamily: font.regular, fontSize: size.base, color: color.ink2, marginTop: 2 },
  // RN só aceita `gap` NUMÉRICO. Percentual é ignorado em silêncio — não voltar a usar.
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: space.md },
  suporte: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  suporteIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suporteTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  suporteSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  toast: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: space.xl,
    backgroundColor: color.navy,
    borderRadius: radius.md,
    padding: space.md,
  },
  toastTxt: {
    fontFamily: font.medium,
    fontSize: size.sm,
    color: color.white,
    textAlign: 'center',
  },
});
// ── FIM BLOCO ──
