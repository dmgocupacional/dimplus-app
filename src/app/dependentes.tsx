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
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, LinhaLista, Pill, Screen, Titulo } from '@/components/ui';
import { getMeusDependentes, type MeusDependentes } from '@/lib/data';
import { idadeEm } from '@/lib/idade';
import { color, font, size, space } from '@/theme/tokens';

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
      <Screen titulo="Dependentes" scroll={false}>
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
    <Screen titulo="Dependentes">
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
          <Titulo>No seu plano</Titulo>
          {lista.map((d) => {
            const idade = rotuloIdade(d.data_nascimento);
            const partes = [d.parentesco, idade].filter(Boolean) as string[];
            return (
              <LinhaLista
                key={d.id}
                icone="person"
                titulo={d.nome}
                // sem parentesco e sem idade, some a linha em vez de mostrar "— · —"
                subtitulo={partes.length > 0 ? partes.join(' · ') : undefined}
                direita={
                  d.app_acesso === 'liberado' ? (
                    <Pill texto="com acesso" tom="ok" />
                  ) : (
                    <Pill texto="sem acesso ao app" tom="neutro" />
                  )
                }
              />
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
        icone="call"
        texto="Para incluir um dependente, fale com a central pelo telefone da sua unidade. Em breve você poderá solicitar por aqui."
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
