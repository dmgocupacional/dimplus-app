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
  Linking,
  Modal,
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

// Canal oficial, o mesmo da tela de Ajuda e da recuperação. → src/app/ajuda.tsx
const WHATS = '5511995193094';
const WHATS_LEGIVEL = '(11) 99519-3094';

function abrirWhats(assunto: string) {
  void Linking.openURL(`https://wa.me/${WHATS}?text=${encodeURIComponent(assunto)}`);
}

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
  // 14/09/2026 — quais campos o servidor apontou como divergentes. A borda vermelha sai daqui.
  // Limpa assim que a pessoa edita QUALQUER um deles: manter o vermelho depois da correção faz
  // a tela continuar acusando um erro que já não existe.
  const [camposErro, setCamposErro] = useState<string[]>([]);
  const errado = (campo: string) => camposErro.includes(campo);

  // 🔴 ERRO TERMINAL vira MODAL. O critério é se a pessoa resolve AQUI ou precisa SAIR: dado
  // que não confere ela corrige na hora (borda vermelha basta); "você já tem conta" e "plano
  // não está ativo" exigem outra tela ou a nossa equipe, e uma linha de texto embaixo do botão
  // faz ela tentar de novo à toa.
  const [bloqueio, setBloqueio] = useState<{ motivo: string; texto: string } | null>(null);
  const TERMINAIS = ['ja_tem_conta', 'nao_ativo', 'sem_dados_cadastrados'];
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
    setCamposErro([]);

    const r = await pedirPrimeiroAcesso({
      cpf,
      email: email.trim().toLowerCase(),
      data_nascimento: dataParaISO(nascimento)!,
      telefone,
      termo_versao_id: termo.id,
      aceite: true,
    });

    setEnviando(false);
    // 14/09/2026 — o servidor deixou de responder neutro: cada porta agora diz o que houve.
    // A tela só precisa mostrar o texto que veio, porque ele é específico da situação.
    if (r.ok) {
      setMensagem(r.mensagem ?? 'Pedido enviado.');
    } else if (r.motivo && TERMINAIS.includes(r.motivo)) {
      setBloqueio({ motivo: r.motivo, texto: r.erro });
    } else {
      setErro(r.erro);
      setCamposErro(r.campos ?? []);
    }
  }

  // Cada bloqueio tem uma saída própria. Modal sem ação seria só um "não" mais bonito.
  // 15/09/2026 — os dois bloqueios que dependem da equipe passam a entregar o CANAL, não só a
  // recusa. Modal que diz "fale com a gente" sem dizer com quem é um não mais bonito.
  const acaoDoBloqueio =
    bloqueio?.motivo === 'ja_tem_conta'
      ? {
          rotulo: 'Ir para Esqueci minha senha',
          ir: () => router.replace('/recuperar' as never),
        }
      : bloqueio?.motivo === 'nao_ativo'
        ? {
            rotulo: 'Falar no WhatsApp',
            ir: () =>
              abrirWhats(
                'Olá! Tentei criar o meu acesso no app do DIM+ e apareceu que o meu plano não está ativo.',
              ),
          }
        : bloqueio?.motivo === 'sem_dados_cadastrados'
          ? {
              rotulo: 'Falar no WhatsApp',
              ir: () =>
                abrirWhats(
                  'Olá! Tentei criar o meu acesso no app do DIM+ e faltam dados no meu cadastro.',
                ),
            }
          : null;

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
            <Text style={s.titulo}>Acesso criado!</Text>
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
                onChange={(v) => {
                  setCpf(mascaraCPF(v));
                  setCamposErro((c) => c.filter((x) => x !== 'cpf'));
                }}
                invalido={errado('cpf')}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Campo
                rotulo="E-mail"
                valor={email}
                onChange={(v) => {
                  setEmail(v);
                  setCamposErro((c) => c.filter((x) => x !== 'email'));
                }}
                invalido={errado('email')}
                placeholder="voce@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={160}
              />
              <Campo
                rotulo="Data de nascimento"
                valor={nascimento}
                onChange={(v) => {
                  setNascimento(mascaraData(v));
                  setCamposErro((c) => c.filter((x) => x !== 'data_nascimento'));
                }}
                invalido={errado('data_nascimento')}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
              <Campo
                rotulo="Telefone com DDD"
                valor={telefone}
                onChange={(v) => {
                  setTelefone(mascaraTelefone(v));
                  setCamposErro((c) => c.filter((x) => x !== 'telefone'));
                }}
                invalido={errado('telefone')}
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

      <Modal
        visible={!!bloqueio}
        transparent
        animationType="fade"
        onRequestClose={() => setBloqueio(null)}
      >
        <View style={s.fundoModal}>
          <View style={s.caixaModal}>
            <Text style={s.tituloModal}>
              {bloqueio?.motivo === 'ja_tem_conta'
                ? 'Você já tem acesso'
                : bloqueio?.motivo === 'nao_ativo'
                  ? 'Plano não está ativo'
                  : 'Falta completar o seu cadastro'}
            </Text>
            <Text style={s.textoModal}>{bloqueio?.texto}</Text>
            {bloqueio && bloqueio.motivo !== 'ja_tem_conta' ? (
              <Text style={s.telefoneModal}>{WHATS_LEGIVEL}</Text>
            ) : null}

            {acaoDoBloqueio ? (
              <Pressable
                style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
                onPress={() => {
                  setBloqueio(null);
                  acaoDoBloqueio.ir();
                }}
              >
                <Text style={s.botaoTxt}>{acaoDoBloqueio.rotulo}</Text>
              </Pressable>
            ) : null}

            <Pressable style={s.link} onPress={() => setBloqueio(null)}>
              <Text style={s.linkTxt}>
                {acaoDoBloqueio ? 'Fechar' : <Text style={s.linkForte}>Entendi</Text>}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(16, 20, 32, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  caixaModal: {
    backgroundColor: color.offwhite,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  tituloModal: { fontFamily: font.black, fontSize: size.lg, color: color.ink },
  telefoneModal: {
    fontFamily: font.bold,
    fontSize: size.lg,
    color: color.navy,
    marginTop: space.md,
  },
  textoModal: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    lineHeight: 22,
    marginTop: space.sm,
  },
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
