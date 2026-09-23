// ═══ BLOCO: TELA — ADESÃO AO CLUBE DE DESCONTOS ═══
// 16/09/2026. Trava que vem DEPOIS do aceite do termo: quem ainda não tem cartão de
// descontos em farmácias passa por aqui, no primeiro acesso e também quem já usava o app.
//
// 🔴 PEDE SÓ O QUE FALTA. Em 16/09 o Gestor só recusava `sexo` nulo; em 23/09 passou a exigir
// e-mail, naturalidade e endereço completo. A tela manda o sexo, e se o erp responder 422 com
// `faltando`, abre só aqueles campos — quem já tem tudo no cadastro não vê formulário nenhum.
//
// 21/09/2026 — a tela conduz as DUAS etapas, pelo estado da sessão:
//   1. sem assinatura      → adesão (pede o sexo, o ERP cria a assinatura no Gestor);
//   2. sem cartão Vidalink → abre o portal (navegador embutido) e pede o número gerado lá;
//   3. com cartão Vidalink → mostra o número e abre o clube.
// É também o destino do atalho "Clube de descontos" da home (substituiu "Rede parceira").
//
// 🔴 "AGORA NÃO" EXISTE DE PROPÓSITO (decisão do Henrique, 16/09): a trava é obrigatória,
// mas se a API deles cair, bloquear o app inteiro puniria o cliente por falha de terceiro.
// A pendência volta no próximo abrir.
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts)
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { consultarCEP } from '@/lib/auth';
import {
  abrirClube,
  aderirClube,
  dispensarClubePorAgora,
  informarVidalink,
  temWebView,
  type DadosAdesao,
  type Sexo,
} from '@/lib/clube';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

const OPCOES: { valor: Sexo; rotulo: string }[] = [
  { valor: 'F', rotulo: 'Feminino' },
  { valor: 'M', rotulo: 'Masculino' },
];

export default function AdesaoClube() {
  const { clube } = useSession();
  if (clube && clube.cartao_vidalink) return <ClubePronto numero={clube.cartao_vidalink} />;
  if (clube) return <PassoVidalink />;
  return <PassoAdesao />;
}

// Rótulo e teclado de cada campo que o erp pode apontar como faltante (chaves do 422).
// A ordem aqui é a ordem na tela — endereço agrupado, CEP primeiro porque preenche o resto.
const CAMPOS: {
  chave: string;
  dado: keyof DadosAdesao;
  rotulo: string;
  teclado?: 'email-address' | 'number-pad' | 'default';
  max?: number;
}[] = [
  { chave: 'email', dado: 'email', rotulo: 'E-MAIL', teclado: 'email-address', max: 120 },
  { chave: 'naturalidade', dado: 'naturalidade', rotulo: 'NATURALIDADE (CIDADE ONDE NASCEU)', max: 60 },
  { chave: 'cep', dado: 'endereco_cep', rotulo: 'CEP', teclado: 'number-pad', max: 9 },
  { chave: 'endereco', dado: 'endereco_logradouro', rotulo: 'RUA', max: 120 },
  { chave: 'numero', dado: 'endereco_numero', rotulo: 'NÚMERO', max: 15 },
  { chave: 'bairro', dado: 'endereco_bairro', rotulo: 'BAIRRO', max: 80 },
  { chave: 'cidade', dado: 'endereco_cidade', rotulo: 'CIDADE', max: 80 },
  { chave: 'uf', dado: 'endereco_uf', rotulo: 'UF', max: 2 },
];

function PassoAdesao() {
  const { cliente, recarregar } = useSession();
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [dados, setDados] = useState<DadosAdesao>({});
  // null = ainda não perguntamos ao erp o que falta; [] = nada falta.
  const [faltando, setFaltando] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const camposVisiveis = CAMPOS.filter((c) => faltando?.includes(c.chave));
  const incompleto = camposVisiveis.some((c) => !String(dados[c.dado] ?? '').trim());

  function mudar(dado: keyof DadosAdesao, valor: string) {
    setDados((d) => ({ ...d, [dado]: valor }));
    if (dado === 'endereco_cep' && valor.replace(/\D/g, '').length === 8) void preencherPorCep(valor);
  }

  // CEP completa rua, bairro, cidade e UF. Se não achar, a pessoa digita — CEP nunca trava.
  async function preencherPorCep(cep: string) {
    const r = await consultarCEP(cep);
    if (!r.encontrado) return;
    setDados((d) => ({
      ...d,
      endereco_logradouro: d.endereco_logradouro || r.logradouro,
      endereco_bairro: d.endereco_bairro || r.bairro,
      endereco_cidade: d.endereco_cidade || r.cidade,
      endereco_uf: d.endereco_uf || r.uf,
    }));
  }

  async function confirmar() {
    if (enviando || !sexo || incompleto) return;
    setEnviando(true);
    setErro(null);
    const limpos: DadosAdesao = { sexo };
    for (const c of camposVisiveis) {
      const v = String(dados[c.dado] ?? '').trim();
      if (v) (limpos as Record<string, string>)[c.dado] = c.chave === 'uf' ? v.toUpperCase() : v;
    }
    const r = await aderirClube(limpos);
    setEnviando(false);
    if (!r.ok) {
      // 422 com a lista: mostra só os campos que faltam, sem tratar como erro da pessoa.
      if (r.faltando && r.faltando.length > 0) {
        const doFormulario = r.faltando.filter((f) => CAMPOS.some((c) => c.chave === f));
        if (doFormulario.length > 0) {
          setFaltando(doFormulario);
          return;
        }
        // Falta algo que a pessoa não resolve por aqui (nome, CPF, nascimento): é do balcão.
        setErro('Falta um dado no seu cadastro que só a central consegue completar. Fale com a gente pela Ajuda.');
        return;
      }
      setErro(r.mensagem);
      return;
    }
    recarregar();
    router.replace('/' as never);
  }

  function agoraNao() {
    dispensarClubePorAgora();
    router.replace('/' as never);
  }

  return (
    <Screen titulo="Clube de descontos">
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <Card>
          <Titulo>Seu cartão de descontos em farmácias</Titulo>
          <Text style={s.texto}>
            {faltando && faltando.length > 0
              ? 'Quase lá. Para emitir o cartão, o parceiro precisa destes dados:'
              : 'O seu plano dá direito a descontos em remédios nas farmácias conveniadas. Para gerar o cartão, confirme os dados abaixo. Leva menos de um minuto.'}
          </Text>

          <Text style={s.rotulo}>SEXO</Text>
          <View style={s.opcoes}>
            {OPCOES.map((o) => {
              const ativo = sexo === o.valor;
              return (
                <Pressable
                  key={o.valor}
                  onPress={() => setSexo(o.valor)}
                  style={[s.opcao, ativo && s.opcaoAtiva]}
                >
                  <Text style={[s.opcaoTxt, ativo && s.opcaoTxtAtivo]}>{o.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>

          {camposVisiveis.map((c) => (
            <View key={c.chave}>
              <Text style={s.rotulo}>{c.rotulo}</Text>
              <TextInput
                value={String(dados[c.dado] ?? '')}
                onChangeText={(v) => mudar(c.dado, v)}
                keyboardType={c.teclado ?? 'default'}
                autoCapitalize={c.chave === 'email' ? 'none' : c.chave === 'uf' ? 'characters' : 'words'}
                autoCorrect={false}
                maxLength={c.max}
                style={s.campo}
              />
            </View>
          ))}

          {cliente?.nome ? (
            <Text style={s.nota}>O cartão será emitido no nome de {cliente.nome}.</Text>
          ) : null}

          {erro ? <Aviso texto={erro} /> : null}

          <Pressable
            onPress={confirmar}
            disabled={!sexo || incompleto || enviando}
            style={[s.botao, (!sexo || incompleto || enviando) && s.botaoOff]}
          >
            {enviando ? (
              <ActivityIndicator color={color.navy} />
            ) : (
              <Text style={s.botaoTxt}>Gerar meu cartão</Text>
            )}
          </Pressable>

          <Pressable onPress={agoraNao} disabled={enviando} style={s.depois}>
            <Text style={s.depoisTxt}>Agora não</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** Botão que abre o clube já autenticado e mostra o motivo se o parceiro recusar. */
function BotaoClube({ rotulo, secundario }: { rotulo: string; secundario?: boolean }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    if (abrindo) return;
    // Com WebView no binário, o clube é uma tela do app; a própria tela pede o link.
    if (temWebView) {
      router.push('/clube-web' as never);
      return;
    }
    setAbrindo(true);
    setErro(null);
    const r = await abrirClube();
    setAbrindo(false);
    if (!r.ok) setErro(r.mensagem);
  }

  return (
    <View>
      <Pressable onPress={abrir} disabled={abrindo} style={secundario ? s.botaoSec : s.botao}>
        {abrindo ? (
          <ActivityIndicator color={secundario ? color.navy : color.navy} />
        ) : (
          <Text style={secundario ? s.botaoSecTxt : s.botaoTxt}>{rotulo}</Text>
        )}
      </Pressable>
      {erro ? <Aviso texto={erro} /> : null}
    </View>
  );
}

function PassoVidalink() {
  const { recarregar } = useSession();
  const [numero, setNumero] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const digitos = numero.replace(/\D/g, '');

  async function salvar() {
    if (enviando || digitos.length < 8) return;
    setEnviando(true);
    setErro(null);
    const r = await informarVidalink(digitos);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    recarregar();
    router.replace('/' as never);
  }

  function agoraNao() {
    dispensarClubePorAgora();
    router.replace('/' as never);
  }

  return (
    <Screen titulo="Clube de descontos">
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <Card>
          <Titulo>Gere seu cartão de farmácia</Titulo>
          <Text style={s.texto}>
            O desconto nas farmácias vale com o cartão Vidalink. Ele é gerado dentro do clube,
            em dois passos:
          </Text>

          <Text style={s.passo}>1. Abra o clube (você já entra conectado) e gere o cartão.</Text>
          <BotaoClube rotulo="Abrir o clube" secundario />

          <Text style={s.passo}>2. Volte aqui e digite o número do cartão gerado.</Text>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Número do cartão"
            placeholderTextColor={color.ink3}
            keyboardType="number-pad"
            maxLength={24}
            style={s.campo}
          />

          {erro ? <Aviso texto={erro} /> : null}

          <Pressable
            onPress={salvar}
            disabled={digitos.length < 8 || enviando}
            style={[s.botao, (digitos.length < 8 || enviando) && s.botaoOff]}
          >
            {enviando ? (
              <ActivityIndicator color={color.navy} />
            ) : (
              <Text style={s.botaoTxt}>Salvar meu cartão</Text>
            )}
          </Pressable>

          <Pressable onPress={agoraNao} disabled={enviando} style={s.depois}>
            <Text style={s.depoisTxt}>Agora não</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function ClubePronto({ numero }: { numero: string }) {
  return (
    <Screen titulo="Clube de descontos">
      <ScrollView contentContainerStyle={s.conteudo}>
        <Card>
          <Titulo>Seu cartão de farmácia</Titulo>
          <Text style={s.texto}>
            Apresente o cartão Vidalink na farmácia conveniada. Ele também está na tela inicial,
            ao lado do seu cartão DIM+.
          </Text>
          <Text style={s.rotulo}>Nº DO CARTÃO</Text>
          <Text style={s.numero}>{numero.replace(/(.{4})/g, '$1 ').trim()}</Text>
          <BotaoClube rotulo="Abrir o clube" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  conteudo: { paddingBottom: space.xl },
  texto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: space.sm },
  rotulo: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: color.ink3,
    marginTop: space.xl,
  },
  opcoes: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  opcao: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  opcaoAtiva: { borderColor: color.navy, backgroundColor: color.offwhite },
  opcaoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.ink2 },
  opcaoTxtAtivo: { color: color.navy },
  nota: { fontFamily: font.regular, fontSize: size.xs, color: color.ink3, marginTop: space.md },
  botao: {
    marginTop: space.xl,
    backgroundColor: color.green,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  botaoOff: { opacity: 0.45 },
  botaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  depois: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  depoisTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.ink3 },
  passo: { fontFamily: font.bold, fontSize: size.sm, color: color.navy, marginTop: space.xl },
  botaoSec: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: color.navy,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  botaoSecTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  campo: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: font.bold,
    fontSize: size.base,
    color: color.navy,
    letterSpacing: 1,
  },
  numero: { fontFamily: font.black, fontSize: size.lg, color: color.navy, marginTop: space.xs, letterSpacing: 1 },
});
// ── FIM BLOCO ──
