// ═══ BLOCO: TELA — LOGIN ═══
//
// CPF + senha. O CPF é apelido: quem traduz para telefone é o ERP
// (`POST /api/public/app-login`), porque ler `clientes` exige sessão.
//
// 🔒 A MENSAGEM DE ERRO É ÚNICA E VAGA DE PROPÓSITO. "CPF ou senha inválidos" cobre CPF
// inexistente, CPF sem conta e senha errada. NÃO detalhar — distinguir os casos aqui
// transformaria a tela em oráculo de quem é cliente da DIM+, que é exatamente o que a rota
// pública foi desenhada para não ser.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Campo } from '@/components/Campo';
import { cpfValido, entrar } from '@/lib/auth';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Login() {
  const insets = useSafeAreaInsets();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = cpfValido(cpf) && senha.length > 0 && !enviando;

  async function onEntrar() {
    setErro(null);
    setEnviando(true);
    const r = await entrar(cpf, senha);
    setEnviando(false);
    // Sucesso NÃO navega: quem troca de tela é o roteamento por estado de sessão no
    // _layout raiz. Navegar aqui também criaria duas fontes de verdade para a mesma decisão.
    if (!r.ok) setErro(r.erro);
  }

  return (
    <KeyboardAvoidingView
      style={s.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.conteudo, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../../assets/brand/logo-full.png')}
          style={s.logo}
          contentFit="contain"
        />
        <Text style={s.titulo}>Entrar</Text>
        <Text style={s.sub}>Use o seu CPF e a senha que você criou.</Text>

        <View style={s.form}>
          <Campo
            rotulo="CPF"
            valor={cpf}
            onChange={(v) => setCpf(v.replace(/\D/g, '').length <= 11 ? v : cpf)}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
          />
          <Campo
            rotulo="Senha"
            valor={senha}
            onChange={setSenha}
            placeholder="sua senha"
            segredo
            maxLength={72}
          />

          {erro ? <Text style={s.erro}>{erro}</Text> : null}

          <Pressable
            onPress={onEntrar}
            disabled={!podeEnviar}
            style={({ pressed }) => [
              s.botao,
              !podeEnviar && s.botaoOff,
              pressed && podeEnviar && s.botaoPress,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
          >
            {enviando ? (
              <ActivityIndicator color={color.navy} />
            ) : (
              <Text style={s.botaoTxt}>Entrar</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/cadastro' as never)}
            style={s.link}
            accessibilityRole="button"
          >
            <Text style={s.linkTxt}>
              Primeiro acesso? <Text style={s.linkForte}>Criar meu acesso</Text>
            </Text>
          </Pressable>

          {/* Reset de senha não tem caminho automático enquanto não houver canal de mensagem
              (WhatsApp/SMS). Prometer "esqueci minha senha" e cair num formulário que só
              gera fila seria pior que dizer a verdade. Dívida datada no ROADMAP-APP. */}
          <Text style={s.rodape}>
            Esqueceu a senha? Fale com a central pelo telefone da sua unidade — por enquanto a
            troca é feita pela nossa equipe.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  conteudo: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  logo: { width: 150, height: 46, marginBottom: space.xxl },
  titulo: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  sub: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    marginTop: space.xs,
  },
  form: { marginTop: space.xxl },
  erro: {
    fontFamily: font.medium,
    fontSize: size.sm,
    color: color.danger,
    marginBottom: space.md,
  },
  botao: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoOff: { backgroundColor: color.border },
  botaoPress: { backgroundColor: color.greenDeep },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  link: { marginTop: space.xl, alignItems: 'center' },
  linkTxt: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2 },
  linkForte: { fontFamily: font.bold, color: color.navy },
  rodape: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.xxl,
    lineHeight: 16,
  },
});
// ── FIM BLOCO ──
