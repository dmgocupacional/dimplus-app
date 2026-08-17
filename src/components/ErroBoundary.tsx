// ═══ BLOCO: ERROR BOUNDARY ═══
//
// Sem isto, QUALQUER crash de render vira tela preta silenciosa — o React desmonta a árvore
// e não sobra nada. Foi exatamente o que aconteceu na aba Financeiro em 17/08/2026: o app
// rodava direto no Expo Go do celular, sem terminal aberto, e não havia onde ler o erro.
//
// Isto NÃO é ferramenta de debug temporária. É requisito de produto:
//   1. Cliente final reporta "ficou preto" e isso não é diagnosticável. Com o boundary,
//      ele lê a mensagem e manda print.
//   2. O revisor da Apple roda o app em condições que não controlamos. Crash silencioso
//      na review = rejeição sem explicação.
//
// ⚠️ Boundary de classe é OBRIGATÓRIO: `componentDidCatch`/`getDerivedStateFromError` não
// têm equivalente em Hook. Não "modernizar" isto para função — perde a captura.
//
// ⚠️ LIMITE REAL: boundary captura erro de RENDER. NÃO captura erro dentro de callback
// assíncrono (onPress com await que rejeita, promise solta). Se um bug futuro não aparecer
// aqui, é provavelmente assíncrono — procurar em outro lugar, não assumir que o boundary
// falhou.

import { Ionicons } from '@expo/vector-icons';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_VERSION } from '@/lib/version';
import { color, font, radius, size, space } from '@/theme/tokens';

type Props = { children: ReactNode; local?: string };
type State = { erro: Error | null; pilha: string | null };

export class ErroBoundary extends Component<Props, State> {
  state: State = { erro: null, pilha: null };

  static getDerivedStateFromError(erro: Error): Partial<State> {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Continua indo para o console: quem ESTIVER com terminal aberto não perde o stack.
    console.error('[ErroBoundary]', erro, info.componentStack);
    this.setState({ pilha: info.componentStack ?? null });
  }

  tentarDeNovo = () => {
    this.setState({ erro: null, pilha: null });
  };

  render() {
    const { erro, pilha } = this.state;
    if (!erro) return this.props.children;

    return (
      <View style={s.tela}>
        <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
          <View style={s.selo}>
            <Ionicons name="warning" size={32} color={color.danger} />
          </View>

          <Text style={s.titulo}>Algo quebrou nesta tela</Text>
          <Text style={s.sub}>
            Manda um print desta tela para o suporte. A informação abaixo diz exatamente o que
            aconteceu.
          </Text>

          <View style={s.caixa}>
            <Text style={s.rotulo}>ERRO</Text>
            {/* selectable: permite copiar o texto no device, sem precisar de print. */}
            <Text style={s.mensagem} selectable>
              {erro.name}: {erro.message}
            </Text>
          </View>

          {pilha ? (
            <View style={s.caixa}>
              <Text style={s.rotulo}>ONDE</Text>
              <Text style={s.pilha} selectable>
                {pilha.trim().split('\n').slice(0, 8).join('\n')}
              </Text>
            </View>
          ) : null}

          <Text style={s.meta}>
            versão {APP_VERSION}
            {this.props.local ? ` · ${this.props.local}` : ''}
          </Text>

          <Pressable
            onPress={this.tentarDeNovo}
            style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
            accessibilityRole="button"
          >
            <Text style={s.botaoTxt}>Tentar de novo</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}
// ── FIM BLOCO ──

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl * 2,
  },
  selo: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: '#FBE7E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  titulo: { fontFamily: font.black, fontSize: size.xl, color: color.ink },
  sub: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    marginTop: space.xs,
    lineHeight: 20,
    marginBottom: space.xl,
  },
  caixa: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  rotulo: {
    fontFamily: font.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: color.ink3,
    marginBottom: space.xs,
  },
  mensagem: { fontFamily: font.medium, fontSize: size.sm, color: color.danger, lineHeight: 19 },
  pilha: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, lineHeight: 16 },
  meta: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    marginBottom: space.xl,
  },
  botao: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPress: { backgroundColor: color.greenDeep },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
});
