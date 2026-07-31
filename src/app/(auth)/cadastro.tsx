// ═══ BLOCO: TELA — CADASTRO (SOLICITAÇÃO DE ACESSO) ═══
//
// CPF + telefone + nome + senha → `POST /api/public/app-cadastro`. A conta de acesso nasce
// aqui, mas nasce INERTE: ela loga e não enxerga nada até o staff aprovar no ERP.
//
// 🔒 A RESPOSTA DE SUCESSO É SEMPRE A MESMA, VENHA O QUE VIER. A rota devolve o mesmo texto
// para CPF de cliente, CPF inexistente, CPF duplicado e telefone divergente — e esta tela
// mostra esse texto sem interpretar. NÃO acrescentar "verificamos que seu CPF...", NÃO
// mostrar estado diferente por caso: qualquer diferença observável aqui reconstrói o oráculo
// de enumeração de CPF que a rota existe para não ser.
//
// A validação local (CPF de 11 dígitos, telefone BR, senha 8–72) serve só para evitar um 400
// que o usuário não entenderia. Ela NUNCA consulta nada e não diz se o CPF "existe".

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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Campo } from '@/components/Campo';
import { SENHA_MAX, SENHA_MIN, cpfValido, paraE164, solicitarCadastro } from '@/lib/auth';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function Cadastro() {
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  const valido =
    nome.trim().length >= 2 &&
    cpfValido(cpf) &&
    paraE164(telefone) !== null &&
    senha.length >= SENHA_MIN &&
    senha.length <= SENHA_MAX;

  async function onEnviar() {
    setErro(null);
    setEnviando(true);
    const r = await solicitarCadastro({
      nome: nome.trim(),
      cpf,
      // Manda em E.164 já normalizado. O servidor normaliza de novo (é ele quem manda), mas
      // enviar cru fazia o mesmo número virar duas contas quando as duas normalizações
      // divergiam — foi o bug de v0.206.1, do outro lado da mesma fronteira.
      telefone: paraE164(telefone) ?? telefone,
      senha,
    });
    setEnviando(false);
    if (r.ok) setEnviado(r.mensagem ?? 'Recebemos sua solicitação.');
    else setErro(r.erro);
  }

  if (enviado) {
    return (
      <View style={[s.tela, s.centro, { paddingTop: insets.top }]}>
        <View style={s.selo}>
          <Ionicons name="checkmark-circle" size={44} color={color.greenDeep} />
        </View>
        <Text style={s.okTitulo}>Solicitação enviada</Text>
        {/* Texto vindo da rota, exibido como veio. Não reescrever por caso. */}
        <Text style={s.okTxt}>{enviado}</Text>
        <Pressable
          onPress={() => router.replace('/login' as never)}
          style={({ pressed }) => [s.botao, s.botaoLargo, pressed && s.botaoPress]}
          accessibilityRole="button"
        >
          <Text style={s.botaoTxt}>Ir para o login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.conteudo, { paddingTop: insets.top + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.voltar}>
          <Ionicons name="chevron-back" size={22} color={color.ink2} />
          <Text style={s.voltarTxt}>Voltar</Text>
        </Pressable>

        <Text style={s.titulo}>Criar meu acesso</Text>
        <Text style={s.sub}>
          Preencha seus dados e crie uma senha. Nossa equipe libera o acesso e você entra com o
          seu CPF.
        </Text>

        <View style={s.form}>
          <Campo
            rotulo="Nome completo"
            valor={nome}
            onChange={setNome}
            placeholder="como está no seu documento"
            autoCapitalize="words"
            maxLength={120}
          />
          <Campo
            rotulo="CPF"
            valor={cpf}
            onChange={(v) => setCpf(v.replace(/\D/g, '').length <= 11 ? v : cpf)}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
          />
          <Campo
            rotulo="Telefone com DDD"
            valor={telefone}
            onChange={setTelefone}
            placeholder="(11) 90000-0000"
            keyboardType="phone-pad"
            ajuda="Usamos para falar com você sobre o seu plano."
            maxLength={16}
          />
          <Campo
            rotulo="Criar senha"
            valor={senha}
            onChange={setSenha}
            placeholder={`mínimo ${SENHA_MIN} caracteres`}
            segredo
            ajuda={`De ${SENHA_MIN} a ${SENHA_MAX} caracteres.`}
            maxLength={SENHA_MAX}
          />

          {erro ? <Text style={s.erro}>{erro}</Text> : null}

          <Pressable
            onPress={onEnviar}
            disabled={!valido || enviando}
            style={({ pressed }) => [
              s.botao,
              (!valido || enviando) && s.botaoOff,
              pressed && valido && !enviando && s.botaoPress,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar solicitação"
          >
            {enviando ? (
              <ActivityIndicator color={color.navy} />
            ) : (
              <Text style={s.botaoTxt}>Enviar solicitação</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  centro: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  conteudo: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  voltar: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl },
  voltarTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
  titulo: { fontFamily: font.black, fontSize: size.xxl, color: color.ink },
  sub: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    marginTop: space.xs,
    lineHeight: 21,
  },
  form: { marginTop: space.xl },
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
  botaoLargo: { alignSelf: 'stretch', marginTop: space.xxl },
  botaoOff: { backgroundColor: color.border },
  botaoPress: { backgroundColor: color.greenDeep },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },

  selo: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  okTitulo: { fontFamily: font.black, fontSize: size.xl, color: color.ink, textAlign: 'center' },
  okTxt: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    textAlign: 'center',
    marginTop: space.md,
    lineHeight: 22,
  },
});
// ── FIM BLOCO ──
