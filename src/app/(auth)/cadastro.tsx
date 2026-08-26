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
  SENHA_MAX, SENHA_MIN, buscarTermoCadastro, cpfValido, paraE164, solicitarCadastro,
  type TermoCadastro,
} from '@/lib/auth';
import { dataParaISO, mascaraCPF, mascaraData, mascaraTelefone } from '@/lib/format';
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
  const [passo, setPasso] = useState<1 | 2>(1);
  const [termo, setTermo] = useState<TermoCadastro | null>(null);
  const [leuAteOFim, setLeuAteOFim] = useState(false);
  const [dia, setDia] = useState<10 | 20 | 30>(10);
  const [forma, setForma] = useState<'BOLETO' | 'PIX' | 'CREDIT_CARD'>('BOLETO');
  const [nome, setNome] = useState('');
  // Prova de identidade do pré-cadastrado. Batendo com o cadastro, entra sem fila. Opcional:
  // quem não souber ou não quiser informar cai na aprovação manual, como antes.
  const [nascimento, setNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setTermo(await buscarTermoCadastro()))();
  }, []);

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
      data_nascimento: nascimentoISO()!,
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

  // ═══ PASSO 2 — TERMO, VENCIMENTO E FORMA ═══
  if (passo === 2 && termo?.termo) {
    const pl = termo.plano;
    return (
      <View style={[s.tela, { paddingTop: insets.top + space.xl, paddingHorizontal: space.xl }]}>
        <Pressable onPress={() => setPasso(1)} hitSlop={12} style={s.voltar}>
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
            onPress={() => {
              // Sem termo publicado (ou sem rede para buscá-lo) o cadastro segue como antes,
              // direto para a fila. Travar aqui deixaria a pessoa sem caminho nenhum por uma
              // falha que não é dela.
              if (termo?.disponivel && termo.termo) setPasso(2);
              else void onEnviar();
            }}
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
              <Text style={s.botaoTxt}>
                {termo?.disponivel ? 'Continuar' : 'Enviar solicitação'}
              </Text>
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
