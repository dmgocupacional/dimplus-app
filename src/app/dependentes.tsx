// ═══ BLOCO: TELA — DEPENDENTES (S-C) ═══
//
// LEITURA APENAS. A inclusão é a S-D e nasce como SOLICITAÇÃO com aprovação de staff —
// nunca INSERT direto em `clientes` pelo app. O botão daqui abre pedido, não cria gente.
//
// 🔴 O ESTADO VAZIO É O CAMINHO PRINCIPAL, não a exceção. Em 17/08/2026 nenhum dos 18
// titulares com dependentes tinha login (`user_id`), então em produção esta tela abre vazia
// em 100% dos casos reais. Tratar o vazio como erro (spinner infinito, "algo deu errado",
// retry) seria repetir o bug de tela preta da v0.3.3: A TELA ASSUMINDO UMA FORMA QUE O DADO
// NÃO GARANTE.
//
// ⚠️ Só dado CADASTRAL aqui. Nunca exame, agenda ou financeiro: por decisão de 17/08/2026 o
// dependente MAIOR tem login próprio e o titular PERDE acesso aos resultados dele.
// 28/09/2026 · Sprint B — FAMÍLIA: cada dependente vira uma carteirinha (número, parentesco,
// idade, acesso) e, no plano empresarial, mostra o último dia de acesso quando há desligamento.
// Inclusão no plano faturado é pelo RH da empresa (a lista vem da empresa), não pela central.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Pill, Screen, Titulo } from '@/components/ui';
import { useSession } from '@/state/session';
import { getMeusDependentes, type MeusDependentes } from '@/lib/data';
import { idadeEm } from '@/lib/idade';
import { color, font, radius, size, space } from '@/theme/tokens';

function dataBR(d: string): string {
  return d.split('-').reverse().join('/');
}

/** `numeric` do Postgres chega como string; o Number() já foi feito na camada de dados. */
function moeda(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

/**
 * Rótulo de idade. Devolve null quando não há data — e isso é o caso NORMAL: os 44
 * dependentes da base estão todos sem nascimento. Não inventar "idade não informada" como se
 * fosse anomalia; simplesmente não mostrar a linha. → BLOCO: IDADE E RESTRIÇÃO DE FAIXA
 */
function rotuloIdade(nascimento: string | null): string | null {
  const anos = idadeEm(nascimento, new Date());
  if (anos === null) return null;
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

export default function Dependentes() {
  const [dados, setDados] = useState<MeusDependentes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const { beneficios } = useSession();
  const empresarial = beneficios?.plano?.forma_cobranca === 'faturado_empresa';

  const carregar = useCallback(async () => {
    setCarregando(true);
    // getMeusDependentes já devolve `{lista: [], situacao: null}` em vez de lançar: sessão
    // sem cliente e titular sem dependente são estados legítimos, não falhas.
    const d = await getMeusDependentes();
    setDados(d);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <Screen titulo="Família" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  const lista = dados?.lista ?? [];
  const sit = dados?.situacao ?? null;
  const restantes = sit ? Math.max(0, sit.limite - sit.usados) : 0;
  // `pode_adicionar` vem `true` no limite quando a política é `cobrar` — nesse caso o
  // próximo custa. A tela precisa dizer o valor ANTES de deixar solicitar.
  const custaraExtra = sit !== null && sit.politica === 'cobrar' && restantes === 0;

  return (
    <Screen titulo="Família">
      {sit ? (
        <Card>
          <Text style={s.contador}>
            {sit.usados} de {sit.limite}
          </Text>
          <Text style={s.contadorSub}>
            {restantes > 0
              ? `Você ainda pode incluir ${restantes === 1 ? '1 dependente' : `${restantes} dependentes`} no seu plano.`
              : sit.politica === 'cobrar'
                ? `Você atingiu o limite do plano. Incluir mais um custa ${moeda(sit.valor_unitario)} por mês.`
                : 'Você atingiu o limite de dependentes do seu plano.'}
          </Text>
        </Card>
      ) : null}

      {custaraExtra ? (
        <Aviso
          tom="aviso"
          icone="information-circle"
          texto={`Cada dependente acima do limite soma ${moeda(sit.valor_unitario)} por mês à sua mensalidade.`}
        />
      ) : null}

      {lista.length === 0 ? (
        // Vazio é ESTADO CORRETO — sem "erro", sem retry, sem spinner eterno.
        <Card style={s.vazio}>
          <Ionicons name="people-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTitulo}>Nenhum dependente</Text>
          <Text style={s.vazioTexto}>
            Quando você incluir dependentes no seu plano, eles aparecem aqui.
          </Text>
        </Card>
      ) : (
        <>
          <Titulo>Carteirinhas da família</Titulo>
          {lista.map((d) => {
            const idade = rotuloIdade(d.data_nascimento);
            // sem parentesco e sem idade, some a linha em vez de mostrar "— · —"
            const partes = [d.parentesco, idade].filter(Boolean) as string[];
            return (
              <View key={d.id} style={s.carteira}>
                <View style={s.carteiraTopo}>
                  <View style={s.carteiraIcone}>
                    <Ionicons name="person" size={18} color={color.navy} />
                  </View>
                  <View style={s.carteiraTexto}>
                    <Text style={s.carteiraNome} numberOfLines={1}>{d.nome}</Text>
                    {partes.length > 0 ? <Text style={s.carteiraSub}>{partes.join(' · ')}</Text> : null}
                  </View>
                  {d.app_acesso === 'liberado' ? <Pill texto="com acesso" tom="ok" /> : <Pill texto="sem app" tom="neutro" />}
                </View>
                <View style={s.carteiraRodape}>
                  <Text style={s.carteiraRotulo}>CARTEIRINHA DIM+</Text>
                  <Text style={s.carteiraNumero}>{d.numero_carteirinha ?? '—'}</Text>
                </View>
                {d.vinculo_fim ? (
                  <Text style={s.carteiraFim}>Acesso até {dataBR(d.vinculo_fim)} (desligamento comunicado pela empresa)</Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      {/* A inclusão é a S-D: solicitação + aprovação de staff. Enquanto ela não existe, NÃO
          pintar botão de "adicionar" — tile que parece aberto e não faz nada é exatamente a
          dívida do SOS registrada em (tabs)/index.tsx. Melhor dizer o caminho real. */}
      <Titulo>Incluir dependente</Titulo>
      <Aviso
        tom="info"
        icone={empresarial ? 'business' : 'call'}
        texto={empresarial
          ? 'O seu plano é da empresa. Para incluir filhos, netos, pais ou avós (até 3), fale com o RH — a inclusão chega por lá.'
          : 'Para incluir um dependente, fale com a central pelo telefone da sua unidade. Em breve você poderá solicitar por aqui.'}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  contador: { fontFamily: font.black, fontSize: size.xl, color: color.navy },
  contadorSub: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    marginTop: space.xs,
  },
  carteira: { backgroundColor: color.navy, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, gap: space.md },
  carteiraTopo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  carteiraIcone: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: color.green,
    alignItems: 'center', justifyContent: 'center',
  },
  carteiraTexto: { flex: 1 },
  carteiraNome: { fontFamily: font.bold, fontSize: size.base, color: color.white },
  carteiraSub: { fontFamily: font.regular, fontSize: size.xs, color: color.sky, marginTop: 2 },
  carteiraRodape: { borderTopWidth: 1, borderTopColor: color.navy600, paddingTop: space.sm },
  carteiraRotulo: { fontFamily: font.bold, fontSize: size.xs, color: color.green, letterSpacing: 0.6 },
  carteiraNumero: { fontFamily: font.black, fontSize: size.lg, color: color.white, marginTop: 2 },
  carteiraFim: { fontFamily: font.bold, fontSize: size.xs, color: color.warning },
  vazio: { alignItems: 'center', paddingVertical: space.xxl, gap: space.sm },
  vazioTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  vazioTexto: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    textAlign: 'center',
  },
});
// ── FIM BLOCO ──
