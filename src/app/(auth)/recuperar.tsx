// ═══ BLOCO: TELA — RECUPERAR ACESSO ═══
//
// 10/09/2026. Substitui a dívida datada que estava impressa no rodapé do login: "fale com a
// central". Era o maior risco de rejeição na App Store — o revisor que errasse o login uma vez
// não tinha como recuperar o acesso sozinho.
//
// COMO FUNCIONA: a pessoa informa o CPF, o ERP emite um token e envia por e-mail um link que
// abre uma página web onde ela define a senha nova. O e-mail vai para `clientes.email` — o
// e-mail REAL, não o sintético {cpf}@app.dimeg.com.br, que não recebe nada.
//
// 🔒 A TELA NUNCA DIZ SE O CPF EXISTE. A mensagem de sucesso é a mesma havendo conta ou não,
// tendo e-mail cadastrado ou não. Distinguir transformaria esta tela em consulta de quem é
// cliente da DIM+ — o mesmo oráculo que o login e o cadastro existem para não ser.
//
// ⚠️ NÃO acrescentar "enviamos para j***@gmail.com". É padrão comum em outros apps e é
// justamente o vazamento que o desenho evita: confirma que o CPF existe e entrega o formato do
// endereço de outra pessoa.
// → BLOCO: API PUBLIC — RECUPERAR ACESSO DO APP (erp-dimplus)

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
import { cpfValido, recuperarAcesso } from '@/lib/auth';
import { mascaraCPF } from '@/lib/format';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Recuperar() {
  const insets = useSafeAreaInsets();
  const [cpf, setCpf] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  const podeEnviar = cpfValido(cpf) && !enviando;

  async function onEnviar() {
    setErro(null);
    setEnviando(true);
    const r = await recuperarAcesso(cpf);
    setEnviando(false);
    if (r.ok) setEnviado(r.mensagem ?? 'Se houver uma conta com este CPF, enviamos o link.');
    else setErro(r.erro);
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
        <Text style={s.titulo}>Esqueci minha senha</Text>

        {enviado ? (
          <View style={s.form}>
            <View style={s.aviso}>
              <Text style={s.avisoTxt}>{enviado}</Text>
            </View>
            <Text style={s.rodape}>
              O link vale por 1 hora e só pode ser usado uma vez. Se não chegar, confira a caixa
              de spam ou fale com a nossa equipe.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
              accessibilityRole="button"
              accessibilityLabel="Voltar para a tela de entrar"
            >
              <Text style={s.botaoTxt}>Voltar para o início</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={s.sub}>
              Informe o seu CPF. Enviaremos um link para o e-mail cadastrado, onde você cria uma
              nova senha.
            </Text>

            <View style={s.form}>
              <Campo
                rotulo="CPF"
                valor={cpf}
                onChange={(v) => setCpf(mascaraCPF(v))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />

              {erro ? <Text style={s.erro}>{erro}</Text> : null}

              <Pressable
                onPress={onEnviar}
                disabled={!podeEnviar}
                style={({ pressed }) => [
                  s.botao,
                  !podeEnviar && s.botaoOff,
                  pressed && podeEnviar && s.botaoPress,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Enviar link de recuperação"
              >
                {enviando ? (
                  <ActivityIndicator color={color.navy} />
                ) : (
                  <Text style={s.botaoTxt}>Enviar link</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()} style={s.link} accessibilityRole="button">
                <Text style={s.linkTxt}>
                  Lembrou a senha? <Text style={s.linkForte}>Voltar para entrar</Text>
                </Text>
              </Pressable>

              <Text style={s.rodape}>
                Se você não tem e-mail cadastrado, fale com a central pelo telefone da sua
                unidade — a equipe consegue liberar o seu acesso.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  conteudo: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  titulo: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  sub: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    marginTop: space.xs,
  },
  form: { marginTop: space.xxl },
  aviso: {
    backgroundColor: color.offwhite,
    borderWidth: 1,
    borderColor: color.green,
    borderRadius: radius.md,
    padding: space.lg,
  },
  avisoTxt: {
    fontFamily: font.medium,
    fontSize: size.base,
    color: color.ink,
    lineHeight: 22,
  },
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
    marginTop: space.xl,
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
