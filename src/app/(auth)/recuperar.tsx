// ═══ BLOCO: TELA — RECUPERAR ACESSO (duas etapas) ═══
//
// 🔴 14/09/2026 — REESCRITA. A tela anterior pedia CPF e e-mail e trazia nascimento e telefone
// como "(opcional)". Para quem NÃO tinha e-mail cadastrado aqueles dois eram obrigatórios de
// fato — e a tela não podia dizer isso sem revelar a bifurcação do servidor. Resultado: a
// pessoa preenchia dois campos, lia "enviamos" e nada chegava. São 160 dos 902 clientes sem
// e-mail cadastrado, e o próprio Henrique caiu nisso testando.
//
// Agora a tela PERGUNTA ANTES (etapa 1, rota `/consultar`) e só então pede o que faz sentido
// para aquela pessoa. Reverte conscientemente a neutralidade decidida em 11/09 — o trade-off
// inteiro está no cabeçalho de `app-recuperar/consultar/route.ts`.
// → BLOCO: API PUBLIC — CONSULTA DE SITUAÇÃO DO CPF (erp-dimplus)

import { router } from 'expo-router';
import { useState } from 'react';
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
import { consultarSituacaoCpf, cpfValido, emailValido, recuperarAcesso } from '@/lib/auth';
import { dataParaISO, mascaraCPF, mascaraData, mascaraTelefone } from '@/lib/format';
import { color, font, radius, size, space } from '@/theme/tokens';

// Canal oficial, o mesmo já usado na tela de Ajuda. Não duplicar número aqui: se mudar, muda
// em um lugar só. → src/app/ajuda.tsx
const WHATS = '5511995192094';
const WHATS_LEGIVEL = '(11) 99519-2094';

type Etapa =
  | { nome: 'cpf' }
  | { nome: 'tem_email'; mascara: string }
  | { nome: 'sem_email' }
  | { nome: 'sem_conta'; ativo: boolean }
  | { nome: 'nao_cliente' }
  | { nome: 'enviado'; mensagem: string };

export default function Recuperar() {
  const insets = useSafeAreaInsets();

  const [etapa, setEtapa] = useState<Etapa>({ nome: 'cpf' });
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');

  // 🔴 15/09/2026 — BLOQUEIO É MODAL, E JÁ NA ETAPA DO CPF. Antes o cliente `cancelado`
  // entrava no fluxo, preenchia e-mail e prova de identidade, e só descobria no fim — ou nem
  // descobria. Não é erro que se corrige na tela: a saída é falar com a equipe, então a tela
  // entrega o canal junto em vez de só dizer não.
  // Dois bloqueios terminais, com textos e assuntos de WhatsApp diferentes: "plano não está
  // ativo" e "cadastro incompleto" pedem coisas distintas da equipe.
  const [bloqueado, setBloqueado] = useState<'plano' | 'cadastro' | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function voltarAoCpf() {
    setEtapa({ nome: 'cpf' });
    setErro(null);
  }

  async function consultar() {
    if (!cpfValido(cpf) || carregando) return;
    setCarregando(true);
    setErro(null);

    const r = await consultarSituacaoCpf(cpf);
    setCarregando(false);

    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    if (r.situacao === 'bloqueado') {
      setBloqueado('plano');
      return;
    }
    if (r.situacao === 'sem_plano') {
      setBloqueado('cadastro');
      return;
    }
    if (r.situacao === 'tem_email') setEtapa({ nome: 'tem_email', mascara: r.mascara });
    else if (r.situacao === 'sem_email') setEtapa({ nome: 'sem_email' });
    else if (r.situacao === 'sem_conta') setEtapa({ nome: 'sem_conta', ativo: r.ativo });
    else setEtapa({ nome: 'nao_cliente' });
  }

  async function enviar() {
    if (carregando) return;
    setCarregando(true);
    setErro(null);

    // Nascimento e telefone só viajam no caminho de quem NÃO tem e-mail cadastrado. Mandar
    // sempre faria o servidor cobrar prova de quem não precisa dela.
    const semEmail = etapa.nome === 'sem_email';
    const iso = dataParaISO(nascimento);
    const r = await recuperarAcesso({
      cpf,
      email: email.trim().toLowerCase(),
      ...(semEmail && iso ? { data_nascimento: iso } : {}),
      ...(semEmail && telefone.trim() ? { telefone } : {}),
    });

    setCarregando(false);
    if (r.ok) setEtapa({ nome: 'enviado', mensagem: r.mensagem ?? 'Pedido enviado.' });
    else setErro(r.erro);
  }

  const podeEnviar =
    emailValido(email) &&
    (etapa.nome !== 'sem_email' ||
      (dataParaISO(nascimento) !== null && telefone.replace(/\D/g, '').length >= 10)) &&
    !carregando;

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.conteudo, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {etapa.nome === 'enviado' ? (
          <>
            <Text style={s.titulo}>Confira o seu e-mail</Text>
            <View style={[s.aviso, { marginTop: space.xl }]}>
              <Text style={s.avisoTxt}>{etapa.mensagem}</Text>
            </View>
            <Pressable style={s.link} onPress={() => router.replace('/login' as never)}>
              <Text style={s.linkTxt}>
                Voltar para <Text style={s.linkForte}>entrar</Text>
              </Text>
            </Pressable>
          </>
        ) : etapa.nome === 'sem_conta' ? (
          <>
            {/* 14/09/2026 — a pessoa É cliente, só nunca criou o acesso. Recuperar senha aqui
                não faz sentido: não há senha a recuperar. Mandamos para a porta certa. */}
            <Text style={s.titulo}>Você ainda não criou o seu acesso</Text>
            <Text style={s.sub}>
              {etapa.ativo
                ? 'Esse CPF já é cliente DIM+, mas ainda não tem senha cadastrada. Crie o seu acesso em um minuto.'
                : 'Esse CPF já é cliente DIM+, mas o plano não está ativo no momento. Fale com a gente para regularizar antes de criar o acesso.'}
            </Text>

            <View style={s.form}>
              {etapa.ativo ? (
                <Pressable
                  style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
                  onPress={() => router.replace('/primeiro-acesso' as never)}
                >
                  <Text style={s.botaoTxt}>Criar o meu acesso</Text>
                </Pressable>
              ) : null}

              <Pressable style={s.link} onPress={voltarAoCpf}>
                <Text style={s.linkTxt}>
                  Digitar <Text style={s.linkForte}>outro CPF</Text>
                </Text>
              </Pressable>

              <Pressable style={s.link} onPress={() => router.replace('/login' as never)}>
                <Text style={s.linkTxt}>
                  Voltar para <Text style={s.linkForte}>entrar</Text>
                </Text>
              </Pressable>
            </View>
          </>
        ) : etapa.nome === 'nao_cliente' ? (
          <>
            <Text style={s.titulo}>Não encontramos esse CPF</Text>
            {/* Pedir para conferir o CPF ANTES de oferecer o cadastro: quem errou um dígito e
                aceitasse o convite se cadastraria de novo e cairia em `conta_existente`. */}
            <Text style={s.sub}>
              Confira se digitou corretamente. Se estiver certo, é porque esse CPF ainda não tem
              um plano DIM+ Saúde.
            </Text>

            <View style={s.form}>
              <Pressable
                style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
                onPress={() => router.push('/cadastro' as never)}
              >
                <Text style={s.botaoTxt}>Quero ser cliente DIM+</Text>
              </Pressable>

              <Pressable style={s.link} onPress={voltarAoCpf}>
                <Text style={s.linkTxt}>
                  Digitar <Text style={s.linkForte}>outro CPF</Text>
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={s.titulo}>Recuperar acesso</Text>
            <Text style={s.sub}>
              {etapa.nome === 'cpf'
                ? 'Informe o seu CPF para continuar.'
                : etapa.nome === 'tem_email'
                  ? 'Confirme o e-mail cadastrado para receber o link.'
                  : 'Você ainda não tem um e-mail cadastrado. Informe um e confirme a sua identidade.'}
            </Text>

            <View style={s.form}>
              <Campo
                rotulo="CPF"
                valor={cpf}
                onChange={(v) => setCpf(mascaraCPF(v))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
                editable={etapa.nome === 'cpf'}
              />

              {etapa.nome === 'cpf' ? (
                <>
                  {erro ? <Text style={s.erro}>{erro}</Text> : null}
                  <Pressable
                    style={({ pressed }) => [
                      s.botao,
                      (!cpfValido(cpf) || carregando) && s.botaoOff,
                      pressed && cpfValido(cpf) && !carregando && s.botaoPress,
                    ]}
                    onPress={consultar}
                    disabled={!cpfValido(cpf) || carregando}
                  >
                    {carregando ? (
                      <ActivityIndicator color={color.navy} />
                    ) : (
                      <Text style={s.botaoTxt}>Continuar</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  {/* ⚠️ A máscara é LEMBRETE, não chave. O servidor exige o endereço COMPLETO
                      e trava se não bater — decisão do Henrique em 14/09. */}
                  {etapa.nome === 'tem_email' ? (
                    <View style={s.dica}>
                      <Text style={s.dicaTxt}>E-mail cadastrado: {etapa.mascara}</Text>
                    </View>
                  ) : null}

                  <Campo
                    rotulo={etapa.nome === 'tem_email' ? 'Digite o e-mail completo' : 'E-mail'}
                    valor={email}
                    onChange={setEmail}
                    placeholder="voce@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    maxLength={160}
                  />

                  {etapa.nome === 'sem_email' ? (
                    <>
                      <Text style={s.ajuda}>
                        Para cadastrar um e-mail precisamos confirmar que é você. Os dois campos
                        abaixo são obrigatórios e precisam bater com o seu cadastro.
                      </Text>
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
                    </>
                  ) : null}

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
                    {carregando ? (
                      <ActivityIndicator color={color.navy} />
                    ) : (
                      <Text style={s.botaoTxt}>Enviar o link</Text>
                    )}
                  </Pressable>

                  <Pressable style={s.link} onPress={voltarAoCpf}>
                    <Text style={s.linkTxt}>
                      Digitar <Text style={s.linkForte}>outro CPF</Text>
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable style={s.link} onPress={() => router.replace('/login' as never)}>
                <Text style={s.linkTxt}>
                  Voltar para <Text style={s.linkForte}>entrar</Text>
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!bloqueado}
        transparent
        animationType="fade"
        onRequestClose={() => setBloqueado(null)}
      >
        <View style={s.fundoModal}>
          <View style={s.caixaModal}>
            <Text style={s.tituloModal}>
              {bloqueado === 'plano' ? 'Cadastro bloqueado' : 'Cadastro incompleto'}
            </Text>
            <Text style={s.textoModal}>
              {bloqueado === 'plano'
                ? 'O plano desse CPF não está ativo no momento, então não conseguimos liberar o acesso por aqui. Fale com a nossa equipe que a gente resolve.'
                : 'Esse CPF é cliente DIM+, mas ainda não tem um plano vinculado no nosso sistema. Fale com a nossa equipe que a gente completa e libera o seu acesso.'}
            </Text>
            <Text style={s.telefoneModal}>{WHATS_LEGIVEL}</Text>

            <Pressable
              style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
              onPress={() => {
                // Mensagem pronta: a pessoa não precisa explicar de novo o que já tentou, e a
                // equipe recebe o assunto identificado.
                const texto = encodeURIComponent(
                  bloqueado === 'plano'
                    ? 'Olá! Tentei acessar o app do DIM+ e apareceu que o meu cadastro está bloqueado.'
                    : 'Olá! Tentei acessar o app do DIM+ e apareceu que o meu cadastro está incompleto, sem plano vinculado.',
                );
                void Linking.openURL(`https://wa.me/${WHATS}?text=${texto}`);
              }}
            >
              <Text style={s.botaoTxt}>Falar no WhatsApp</Text>
            </Pressable>

            <Pressable
              style={s.link}
              onPress={() => {
                setBloqueado(null);
                voltarAoCpf();
              }}
            >
              <Text style={s.linkTxt}>
                Digitar <Text style={s.linkForte}>outro CPF</Text>
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
  dica: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  dicaTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink },
  ajuda: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    marginBottom: space.md,
    lineHeight: 19,
  },
  erro: { fontFamily: font.medium, fontSize: size.sm, color: color.danger, marginBottom: space.md },
  botao: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  botaoOff: { backgroundColor: color.border },
  botaoPress: { backgroundColor: color.greenDeep },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(16, 20, 32, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  caixaModal: { backgroundColor: color.offwhite, borderRadius: radius.lg, padding: space.xl },
  tituloModal: { fontFamily: font.black, fontSize: size.lg, color: color.ink },
  textoModal: {
    fontFamily: font.regular,
    fontSize: size.base,
    color: color.ink2,
    lineHeight: 22,
    marginTop: space.sm,
  },
  telefoneModal: {
    fontFamily: font.bold,
    fontSize: size.lg,
    color: color.navy,
    marginTop: space.md,
  },
  link: { marginTop: space.xl, alignItems: 'center' },
  linkTxt: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2 },
  linkForte: { fontFamily: font.bold, color: color.navy },
});
// ── FIM BLOCO ──
