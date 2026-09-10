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
import { useCallback, useEffect, useState } from 'react';
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
import {
  SENHA_MAX, SENHA_MIN, buscarTermoCadastro, consultarCEP, cpfValido, paraE164,
  solicitarCadastro, type TermoCadastro,
  emailValido,
} from '@/lib/auth';
import { dataParaISO, mascaraCEP, mascaraCPF, mascaraData, mascaraTelefone } from '@/lib/format';
import { color, font, radius, size, space } from '@/theme/tokens';

const FORMAS = [
  { valor: 'BOLETO' as const, rotulo: 'Boleto' },
  { valor: 'PIX' as const, rotulo: 'Pix' },
  { valor: 'CREDIT_CARD' as const, rotulo: 'Cartão' },
];

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Cadastro() {
  const insets = useSafeAreaInsets();
  // ═══ PASSO 2 — TERMO ANTES DE ENVIAR (26/08/2026) ═══
  // Decisão do Henrique: o termo aparece ANTES da solicitação, não depois da aprovação. Só é
  // possível porque o auto-cadastro é SEMPRE Básico Plus e o plano é conhecido aqui.
  //
  // 🔴 O botão do passo 2 só libera depois de rolar o termo até o fim — o texto tem multa de
  // 30%, e o aceite precisa provar que a pessoa teve o texto diante dos olhos.
  // 3 passos: dados → endereço → termo. O endereço virou obrigatório porque o Asaas exige
  // CEP e número para cobrar no cartão, e o cadastro já deixa escolher cartão.
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [termo, setTermo] = useState<TermoCadastro | null>(null);
  const [leuAteOFim, setLeuAteOFim] = useState(false);
  const [dia, setDia] = useState<10 | 20 | 30>(10);
  const [forma, setForma] = useState<'BOLETO' | 'PIX' | 'CREDIT_CARD'>('BOLETO');
  const [nome, setNome] = useState('');
  // Prova de identidade do pré-cadastrado. Batendo com o cadastro, entra sem fila. Opcional:
  // quem não souber ou não quiser informar cai na aprovação manual, como antes.
  const [nascimento, setNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [complemento, setComplemento] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoAchado, setCepNaoAchado] = useState(false);
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  // 10/09/2026 — e-mail REAL. É o canal do link de "esqueci minha senha"; sem ele a pessoa
  // depende da equipe para recuperar acesso. → BLOCO: TELA — RECUPERAR ACESSO
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setTermo(await buscarTermoCadastro()))();
  }, []);

  // Busca ao completar os 8 dígitos. NÃO trava nada: se não achar, os campos ficam
  // editáveis e a pessoa preenche na mão — serviço externo fora do ar não pode impedir
  // uma adesão.
  useEffect(() => {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) { setCepNaoAchado(false); return; }
    let vivo = true;
    void (async () => {
      setBuscandoCep(true);
      const r = await consultarCEP(d);
      if (!vivo) return;
      setBuscandoCep(false);
      setCepNaoAchado(!r.encontrado);
      if (r.encontrado) {
        // Só preenche o que veio: CEP de logradouro único não traz rua, e sobrescrever com
        // vazio apagaria o que a pessoa já digitou.
        if (r.logradouro) setLogradouro(r.logradouro);
        if (r.bairro) setBairro(r.bairro);
        if (r.cidade) setCidade(r.cidade);
        if (r.uf) setUf(r.uf);
      }
    })();
    return () => { vivo = false; };
  }, [cep]);

  const enderecoOk =
    cep.replace(/\D/g, '').length === 8 &&
    numero.trim().length >= 1 &&
    logradouro.trim().length >= 2 &&
    bairro.trim().length >= 2 &&
    cidade.trim().length >= 2 &&
    uf.trim().length === 2;

  // Data real, não só formato. Ver dataParaISO: 31/02 e datas futuras são recusadas.
  const nascimentoISO = useCallback(() => dataParaISO(nascimento), [nascimento]);

  // 🔴 Data de nascimento OBRIGATÓRIA (decisão do Henrique, 26/08). Sem ela não há prova de
  // identidade, e o pré-cadastrado cairia sempre na fila — que foi exatamente o que aconteceu
  // no primeiro teste, em silêncio. Melhor recusar o envio do que aceitar cadastro capenga.
  const valido =
    nascimentoISO() !== null &&
    nome.trim().length >= 2 &&
    cpfValido(cpf) &&
    paraE164(telefone) !== null &&
    senha.length >= SENHA_MIN &&
    senha.length <= SENHA_MAX &&
    // Opcional: vazio passa. Preenchido, tem que ter forma de e-mail — a rota valida com Zod
    // e devolveria 400 genérico ("Confira os dados informados"), sem dizer qual campo.
    (email.trim() === '' || emailValido(email));

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
      // `undefined` quando vazio, nunca string vazia: '' falharia o z.string().email() da rota
      // e derrubaria o cadastro inteiro com 400, por um campo que é opcional.
      email: email.trim() === '' ? undefined : email.trim().toLowerCase(),
      data_nascimento: nascimentoISO()!,
      endereco_cep: cep.replace(/\D/g, ''),
      endereco_numero: numero.trim(),
      endereco_logradouro: logradouro.trim(),
      endereco_bairro: bairro.trim(),
      endereco_cidade: cidade.trim(),
      endereco_uf: uf.trim().toUpperCase(),
      ...(complemento.trim() ? { endereco_complemento: complemento.trim() } : {}),
      ...(termo?.disponivel && termo.termo
        ? {
            termo_versao_id: termo.termo.id,
            aceite: true,
            dia_vencimento: dia,
            forma_pagamento: forma,
          }
        : {}),
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

  // ═══ PASSO 2 — ENDEREÇO ═══
  // 🔴 Obrigatório porque o Asaas exige postalCode e addressNumber em creditCardHolderInfo,
  // e o passo seguinte deixa escolher CARTÃO. Sem isso a cobrança falha DEPOIS de já existir
  // cliente, contrato e aceite — 231 dos 571 ativos estão hoje nessa situação.
  if (passo === 2) {
    return (
      <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.conteudo, { paddingTop: insets.top + space.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setPasso(1)} hitSlop={12} style={s.voltar}>
            <Ionicons name="chevron-back" size={22} color={color.ink2} />
            <Text style={s.voltarTxt}>Voltar</Text>
          </Pressable>

          <Text style={s.titulo}>Seu endereço</Text>
          <Text style={s.sub}>Precisamos dele para emitir suas cobranças.</Text>

          <View style={s.form}>
            <Campo
              rotulo="CEP"
              valor={cep}
              onChange={(v) => setCep(mascaraCEP(v))}
              placeholder="00000-000"
              keyboardType="number-pad"
              ajuda={
                buscandoCep ? 'Buscando endereço…'
                  : cepNaoAchado ? 'Não encontramos esse CEP. Preencha os campos abaixo.'
                  : 'Preenchemos o resto para você.'
              }
              maxLength={9}
            />
            <Campo rotulo="Rua" valor={logradouro} onChange={setLogradouro}
              placeholder="nome da rua" autoCapitalize="words" maxLength={160} />
            <Campo rotulo="Número" valor={numero} onChange={setNumero}
              placeholder="123" keyboardType="number-pad" maxLength={20} />
            <Campo rotulo="Complemento (opcional)" valor={complemento} onChange={setComplemento}
              placeholder="apto, bloco…" maxLength={80} />
            <Campo rotulo="Bairro" valor={bairro} onChange={setBairro}
              placeholder="bairro" autoCapitalize="words" maxLength={100} />
            <Campo rotulo="Cidade" valor={cidade} onChange={setCidade}
              placeholder="cidade" autoCapitalize="words" maxLength={100} />
            <Campo rotulo="UF" valor={uf} onChange={(v) => setUf(v.toUpperCase().slice(0, 2))}
              placeholder="SP" autoCapitalize="characters" maxLength={2} />

            {erro ? <Text style={s.erro}>{erro}</Text> : null}

            <Pressable
              onPress={() => {
                // Sem termo publicado (ou sem rede para buscá-lo) envia direto e cai na fila.
                // Travar aqui deixaria a pessoa sem caminho por uma falha que não é dela.
                if (termo?.disponivel && termo.termo) setPasso(3);
                else void onEnviar();
              }}
              disabled={!enderecoOk || enviando}
              style={({ pressed }) => [
                s.botao,
                (!enderecoOk || enviando) && s.botaoOff,
                pressed && enderecoOk && !enviando && s.botaoPress,
              ]}
              accessibilityRole="button"
            >
              {enviando ? <ActivityIndicator color={color.navy} />
                : <Text style={s.botaoTxt}>{termo?.disponivel ? 'Continuar' : 'Enviar solicitação'}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ═══ PASSO 3 — TERMO, VENCIMENTO E FORMA ═══
  if (passo === 3 && termo?.termo) {
    const pl = termo.plano;
    return (
      <View style={[s.tela, { paddingTop: insets.top + space.xl, paddingHorizontal: space.xl }]}>
        <Pressable onPress={() => setPasso(2)} hitSlop={12} style={s.voltar}>
          <Ionicons name="chevron-back" size={22} color={color.ink2} />
          <Text style={s.voltarTxt}>Voltar</Text>
        </Pressable>

        <Text style={s.titulo}>Termo de adesão</Text>
        {pl ? (
          <Text style={s.sub}>
            {pl.nome} — {brl(pl.valor_mensal)}/mês
            {pl.valor_adesao > 0 ? ` · adesão ${brl(pl.valor_adesao)}` : ''}
          </Text>
        ) : null}

        <ScrollView
          style={s.caixaTermo}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            // Margem de 24px: em telas pequenas o offset raramente encosta no valor exato.
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
              setLeuAteOFim(true);
            }
          }}
          scrollEventThrottle={64}
        >
          <Text style={s.termoTxt}>{termo.termo.texto}</Text>
        </ScrollView>

        <Text style={s.rotulo}>Dia do vencimento</Text>
        <View style={s.linhaOpcoes}>
          {([10, 20, 30] as const).map((v) => (
            <Pressable key={v} onPress={() => setDia(v)} style={[s.opcao, dia === v && s.opcaoOn]}>
              <Text style={[s.opcaoTxt, dia === v && s.opcaoTxtOn]}>dia {v}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.rotulo}>Forma de pagamento</Text>
        <View style={s.linhaOpcoes}>
          {FORMAS.map((f) => (
            <Pressable
              key={f.valor}
              onPress={() => setForma(f.valor)}
              style={[s.opcao, forma === f.valor && s.opcaoOn]}
            >
              <Text style={[s.opcaoTxt, forma === f.valor && s.opcaoTxtOn]}>{f.rotulo}</Text>
            </Pressable>
          ))}
        </View>

        {erro ? <Text style={s.erro}>{erro}</Text> : null}
        {!leuAteOFim ? <Text style={s.dica}>Role o termo até o fim para continuar.</Text> : null}

        <Pressable
          onPress={onEnviar}
          disabled={!leuAteOFim || enviando}
          style={({ pressed }) => [
            s.botao,
            (!leuAteOFim || enviando) && s.botaoOff,
            pressed && leuAteOFim && !enviando && s.botaoPress,
          ]}
          accessibilityRole="button"
        >
          {enviando ? (
            <ActivityIndicator color={color.navy} />
          ) : (
            <Text style={s.botaoTxt}>Li e aceito — enviar</Text>
          )}
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
            onChange={(v) => setCpf(mascaraCPF(v))}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
          />
          <Campo
            rotulo="Telefone com DDD"
            valor={telefone}
            onChange={(v) => setTelefone(mascaraTelefone(v))}
            placeholder="(11) 90000-0000"
            keyboardType="phone-pad"
            ajuda="Usamos para falar com você sobre o seu plano."
            maxLength={16}
          />
          <Campo
            rotulo="E-mail"
            valor={email}
            onChange={setEmail}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            ajuda={
              email.trim() !== '' && !emailValido(email)
                ? 'E-mail inválido. Confira o endereço.'
                : 'É por aqui que você recupera a senha se esquecer.'
            }
            maxLength={160}
          />
          <Campo
            rotulo="Data de nascimento"
            valor={nascimento}
            onChange={(v) => setNascimento(mascaraData(v))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            ajuda={
              nascimento.replace(/\D/g, '').length === 8 && nascimentoISO() === null
                ? 'Data inválida. Confira o dia, o mês e o ano.'
                : 'Se você já é cliente, isso libera seu acesso na hora.'
            }
            maxLength={10}
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
            onPress={() => setPasso(2)}
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
              <Text style={s.botaoTxt}>Continuar</Text>
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
  caixaTermo: {
    flex: 1,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  termoTxt: { fontFamily: font.regular, fontSize: size.sm, color: color.ink, lineHeight: 20 },
  rotulo: { fontFamily: font.medium, fontSize: size.sm, color: color.ink, marginTop: space.lg, marginBottom: space.sm },
  linhaOpcoes: { flexDirection: 'row', gap: space.sm },
  opcao: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  opcaoOn: { backgroundColor: color.navy, borderColor: color.navy },
  opcaoTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
  opcaoTxtOn: { color: color.white, fontFamily: font.black },
  dica: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
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
