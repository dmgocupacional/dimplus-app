// ═══ BLOCO: TELA — PRIMEIRO ACESSO DE QUEM JÁ É CLIENTE ═══
//
// 11/09/2026. Nasce de uma medição: 334 clientes `ativo` sem conta no app. O webhook do Asaas
// (ERP v0.305.0) só alcança quem pagar de amanhã em diante — esta tela é a porta de quem JÁ
// paga. Em vez de disparar centenas de e-mails, quem quer usar o app se habilita.
//
// ⚠️ NÃO CONFUNDIR COM `cadastro.tsx`. Lá é quem NÃO é cliente: vira pré-cadastro, escolhe
// forma de pagamento, gera cobrança. Aqui é quem já paga e só precisa da conta. Mandar um
// cliente ativo para o cadastro o faria se cadastrar duas vezes e cair em `conta_existente` —
// era exatamente o defeito do botão "Primeiro acesso" do login até hoje.
//
// 🔒 A TELA NUNCA DIZ SE O CPF É CLIENTE, se está em dia ou se os dados bateram. A mensagem
// final é a mesma em todos os casos. Distinguir transformaria a tela em consulta de quem é
// cliente da DIM+ — que é dado de saúde.
// → BLOCO: API PUBLIC — PRIMEIRO ACESSO DE QUEM JÁ É CLIENTE (erp-dimplus)

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { buscarTermoVigente, cpfValido, emailValido, pedirPrimeiroAcesso } from '@/lib/auth';
import { dataParaISO, mascaraCPF, mascaraData, mascaraTelefone } from '@/lib/format';
import { color, font, radius, size, space } from '@/theme/tokens';

export default function PrimeiroAcesso() {
  const insets = useSafeAreaInsets();

  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [aceite, setAceite] = useState(false);

  const [termo, setTermo] = useState<{ id: string; versao: string; texto: string } | null>(null);
  const [termoAberto, setTermoAberto] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // O termo é buscado na abertura da tela, não no envio: descobrir que ele não carregou só
  // depois de preencher quatro campos seria a pior hora possível.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await buscarTermoVigente();
      if (!vivo) return;
      if (r.ok) setTermo({ id: r.id, versao: r.versao, texto: r.texto });
      else setErro(r.erro);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // 🔴 TODOS obrigatórios. Diferente da recuperação, aqui não existe canal cadastrado a provar:
  // nascimento e telefone são a única barreira entre um CPF conhecido — e CPF não é segredo no
  // Brasil — e uma conta criada no nome de outra pessoa.
  const podeEnviar =
    cpfValido(cpf) &&
    emailValido(email) &&
    dataParaISO(nascimento) !== null &&
    telefone.replace(/\D/g, '').length >= 10 &&
    aceite &&
    !!termo &&
    !enviando;

  async function enviar() {
    if (!podeEnviar || !termo) return;
    setEnviando(true);
    setErro(null);

    const r = await pedirPrimeiroAcesso({
      cpf,
      email: email.trim().toLowerCase(),
      data_nascimento: dataParaISO(nascimento)!,
      telefone,
      termo_versao_id: termo.id,
      aceite: true,
    });

    setEnviando(false);
    if (r.ok) setMensagem(r.mensagem ?? 'Pedido enviado.');
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
      >
        {mensagem ? (
          <>
            <Text style={s.titulo}>Confira o seu e-mail</Text>
            <View style={[s.aviso, { marginTop: space.xl }]}>
              <Text style={s.avisoTxt}>{mensagem}</Text>
            </View>
            <Pressable style={s.link} onPress={() => router.replace('/login' as never)}>
              <Text style={s.linkTxt}>
                Voltar para <Text style={s.linkForte}>entrar</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.titulo}>Já sou cliente</Text>
            <Text style={s.sub}>
              Se você já tem o DIM+ e nunca entrou no aplicativo, confirme os seus dados e
              enviaremos um link para criar a sua senha.
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
              <Campo
                rotulo="E-mail"
                valor={email}
                onChange={setEmail}
                placeholder="voce@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={160}
              />
              <Campo
                rotulo="Data de nascimento"
                valor={nascimento}
                onChange={(v) => setNascimento(mascaraData(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
              <Campo
                rotulo="Telefone com DDD"
                valor={telefone}
                onChange={(v) => setTelefone(mascaraTelefone(v))}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                maxLength={15}
              />

              {/* O texto do termo fica recolhido, mas SEMPRE alcançável antes do aceite. Aceite
                  sem o texto disponível na tela é aceite frágil. */}
              <Pressable
                style={s.termoBotao}
                onPress={() => setTermoAberto((v) => !v)}
                disabled={!termo}
              >
                <Text style={s.termoBotaoTxt}>
                  {termo
                    ? `${termoAberto ? 'Ocultar' : 'Ler'} o termo de adesão (${termo.versao})`
                    : 'Carregando o termo...'}
                </Text>
              </Pressable>

              {termoAberto && termo ? (
                <ScrollView style={s.termoCaixa} nestedScrollEnabled>
                  <Text style={s.termoTxt}>{termo.texto}</Text>
                </ScrollView>
              ) : null}

              <Pressable style={s.aceite} onPress={() => setAceite((v) => !v)}>
                <View style={[s.caixa, aceite && s.caixaOn]}>
                  {aceite ? <Text style={s.caixaMarca}>✓</Text> : null}
                </View>
                <Text style={s.aceiteTxt}>
                  Li e aceito o termo de adesão do DIM+ Saúde.
                </Text>
              </Pressable>

              {erro ? <Text style={s.erro}>{erro}</Text> : null}

              <Pressable
                style={({ pressed }) => [
                  s.botao,
                  !podeEnviar && s.botaoOff,
                  pressed && podeEnviar && s.botaoPress,
                ]}
                onPress={enviar}
                disabled={!podeEnviar}
              >
                {enviando ? (
                  <ActivityIndicator color={color.navy} />
                ) : (
                  <Text style={s.botaoTxt}>Receber o link de acesso</Text>
                )}
              </Pressable>

              <Pressable style={s.link} onPress={() => router.back()}>
                <Text style={s.linkTxt}>
                  Voltar para <Text style={s.linkForte}>entrar</Text>
                </Text>
              </Pressable>

              <Text style={s.rodape}>
                Ainda não é cliente do DIM+? Volte e escolha &quot;Criar meu acesso&quot;.
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
  sub: { fontFamily: font.regular, fontSize: size.base, color: color.ink2, marginTop: space.xs },
  form: { marginTop: space.xxl },
  aviso: {
    backgroundColor: color.offwhite,
    borderWidth: 1,
    borderColor: color.green,
    borderRadius: radius.md,
    padding: space.lg,
  },
  avisoTxt: { fontFamily: font.medium, fontSize: size.base, color: color.ink, lineHeight: 22 },
  termoBotao: { marginTop: space.sm, marginBottom: space.sm },
  termoBotaoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  termoCaixa: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  termoTxt: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, lineHeight: 18 },
  aceite: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, marginBottom: space.md },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  caixaOn: { borderColor: color.green, backgroundColor: color.green },
  caixaMarca: { fontFamily: font.black, fontSize: size.sm, color: color.navy },
  aceiteTxt: { flex: 1, fontFamily: font.regular, fontSize: size.sm, color: color.ink, lineHeight: 19 },
  erro: { fontFamily: font.medium, fontSize: size.sm, color: color.danger, marginBottom: space.md },
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
