// ═══ BLOCO: TELA — AGENDAR (S2-L3) ═══
//
// Leitura: escolhe especialidade → mostra horários dos próximos
// `JANELA_DISPONIBILIDADE_DIAS` dias, agrupados por UNIDADE (nunca por sala — §5 do
// FEEGOW-LEITURA) e por profissional. Sem escrita — criar/cancelar/remarcar é o S2-L4.
//
// 🔴 Regras que este arquivo tem que respeitar (itens 1-7 do §8):
//   1. especialidade escolhida ANTES de consultar horário — nunca "lista tudo".
//   4. `[]` (sem horário) não é erro — já vira "sem vaga" antes de chegar aqui.
//   5. idade DESCONHECIDA (`atendeFaixa` devolve `null`) MOSTRA o profissional com a
//      faixa rotulada — nunca esconde. É o caminho de 100% dos dependentes hoje.
//      `false` (não atende) ESCONDE — só aí é filtro de verdade.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { getDisponibilidade, getOpcoes, type Opcoes } from '@/lib/agendamento';
import type { FeegowErroTipo } from '@/lib/feegowApi';
import { formatData } from '@/lib/format';
import { atendeFaixa, idadeEm, rotuloFaixa } from '@/lib/idade';
import type { Especialidade, SlotDisponibilidade } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

type Etapa =
  | { fase: 'carregando_opcoes' }
  | { fase: 'erro_opcoes'; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'escolher_especialidade'; opcoes: Opcoes }
  | { fase: 'carregando_horarios'; opcoes: Opcoes; especialidade: Especialidade }
  | { fase: 'erro_horarios'; opcoes: Opcoes; especialidade: Especialidade; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'horarios'; opcoes: Opcoes; especialidade: Especialidade; slots: SlotDisponibilidade[] };

function mensagemErro(tipo: FeegowErroTipo, mensagemServidor: string): string {
  switch (tipo) {
    case 'nao_encontrado':
      return 'Não encontramos seu cadastro na clínica ainda. Fale com a central de atendimento para regularizar.';
    case 'modulo_desativado':
      return 'Este serviço estará disponível em breve.';
    case 'nao_autenticado':
    case 'sem_sessao':
      return 'Sua sessão expirou. Saia e entre novamente para continuar.';
    case 'rede':
      return 'Sem conexão. Verifique a internet e tente de novo.';
    default:
      return mensagemServidor || 'Não foi possível carregar agora.';
  }
}

/** `AAAA-MM-DD` → `Date` em UTC, sem `new Date(iso)` (aplica fuso local e pode voltar um
 * dia — mesmo cuidado de `format.ts`). Usado só pra calcular idade na data do slot. */
function dataUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

type GrupoProfissional = {
  profissionalId: number;
  nome: string;
  tratamento: string | null;
  unidadeId: number;
  faixaLabel: string | null;
  datas: string[]; // ordenadas, únicas
};

export default function Agendar() {
  const { cliente } = useSession();
  const [etapa, setEtapa] = useState<Etapa>({ fase: 'carregando_opcoes' });

  const carregarOpcoes = useCallback(async () => {
    setEtapa({ fase: 'carregando_opcoes' });
    const r = await getOpcoes();
    if (!r.ok) {
      setEtapa({ fase: 'erro_opcoes', tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    setEtapa({ fase: 'escolher_especialidade', opcoes: r.dados });
  }, []);

  useEffect(() => {
    void carregarOpcoes();
  }, [carregarOpcoes]);

  async function escolherEspecialidade(opcoes: Opcoes, especialidade: Especialidade) {
    setEtapa({ fase: 'carregando_horarios', opcoes, especialidade });
    const locaisPorId = new Map(opcoes.locais.map((l) => [l.id, l]));
    const r = await getDisponibilidade({ especialidadeId: especialidade.id }, locaisPorId);
    if (!r.ok) {
      setEtapa({ fase: 'erro_horarios', opcoes, especialidade, tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    setEtapa({ fase: 'horarios', opcoes, especialidade, slots: r.dados });
  }

  if (etapa.fase === 'carregando_opcoes') {
    return (
      <Screen titulo="Agendar" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (etapa.fase === 'erro_opcoes') {
    return (
      <Screen titulo="Agendar" scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(etapa.tipo, etapa.mensagem)} />
      </Screen>
    );
  }

  if (etapa.fase === 'escolher_especialidade') {
    const { opcoes } = etapa;
    return (
      <Screen titulo="Agendar">
        <Titulo>Escolha a especialidade</Titulo>
        {opcoes.especialidades.length === 0 ? (
          <Card style={s.vazio}>
            <Text style={s.vazioTexto}>Nenhuma especialidade disponível pra agendamento online no momento.</Text>
          </Card>
        ) : (
          opcoes.especialidades.map((e) => (
            <Pressable key={e.id} onPress={() => escolherEspecialidade(opcoes, e)}>
              <Card style={s.linhaEsp}>
                <Text style={s.linhaEspTxt}>{e.nome}</Text>
                <Ionicons name="chevron-forward" size={18} color={color.ink3} />
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
    );
  }

  if (etapa.fase === 'carregando_horarios') {
    return (
      <Screen titulo={etapa.especialidade.nome} scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (etapa.fase === 'erro_horarios') {
    return (
      <Screen titulo={etapa.especialidade.nome} scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(etapa.tipo, etapa.mensagem)} />
      </Screen>
    );
  }

  // fase === 'horarios'
  const { opcoes, especialidade, slots } = etapa;
  const unidadesPorId = new Map(opcoes.unidades.map((u) => [u.id, u]));
  const profissionaisPorId = new Map(opcoes.profissionais.map((p) => [p.id, p]));
  const nascimento = cliente?.data_nascimento ?? null;

  // Agrupa por profissional, filtra quem NÃO atende a idade (atendeFaixa === false).
  // Idade DESCONHECIDA (null) ou dentro da faixa (true) → mostra, com rótulo se aplicável.
  const gruposPorProfissional = new Map<number, GrupoProfissional>();
  for (const slot of slots) {
    const prof = profissionaisPorId.get(slot.profissionalId);
    if (!prof) continue; // profissional não veio no catálogo — não inventa nome

    const idadeNaData = idadeEm(nascimento, dataUtc(slot.data));
    const veredito = atendeFaixa(idadeNaData, prof.faixa);
    if (veredito === false) continue; // não atende essa idade — esconde de verdade

    const existente = gruposPorProfissional.get(prof.id);
    if (existente) {
      if (!existente.datas.includes(slot.data)) existente.datas.push(slot.data);
    } else {
      gruposPorProfissional.set(prof.id, {
        profissionalId: prof.id,
        nome: prof.nome,
        tratamento: prof.tratamento,
        unidadeId: slot.unidadeId,
        faixaLabel: rotuloFaixa(prof.faixa),
        datas: [slot.data],
      });
    }
  }
  for (const g of gruposPorProfissional.values()) g.datas.sort();

  // Agrupa os profissionais por unidade — o cliente vê "Osasco", nunca "Consultório 7".
  const porUnidade = new Map<number, GrupoProfissional[]>();
  for (const g of gruposPorProfissional.values()) {
    const lista = porUnidade.get(g.unidadeId) ?? [];
    lista.push(g);
    porUnidade.set(g.unidadeId, lista);
  }

  return (
    <Screen titulo={especialidade.nome}>
      {porUnidade.size === 0 ? (
        <Card style={s.vazio}>
          <Ionicons name="calendar-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTexto}>
            Nenhum horário disponível nos próximos dias para {especialidade.nome}. Tente outra especialidade ou
            volte em breve.
          </Text>
        </Card>
      ) : (
        Array.from(porUnidade.entries()).map(([unidadeId, grupos]) => {
          const unidade = unidadesPorId.get(unidadeId);
          return (
            <View key={unidadeId}>
              <Titulo>{unidade?.nomeFantasia ?? 'Unidade'}</Titulo>
              {grupos.map((g) => (
                <Card key={g.profissionalId} style={s.linhaProf}>
                  <View style={s.linhaIcon}>
                    <Ionicons name="person" size={18} color={color.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.linhaTitulo}>
                      {g.tratamento ? `${g.tratamento} ${g.nome}` : g.nome}
                    </Text>
                    <Text style={s.linhaSub}>
                      Próxima data: {formatData(g.datas[0])}
                      {g.datas.length > 1 ? ` · +${g.datas.length - 1} data(s)` : ''}
                    </Text>
                    {g.faixaLabel ? <Text style={s.faixa}>{g.faixaLabel}</Text> : null}
                  </View>
                </Card>
              ))}
            </View>
          );
        })
      )}

      <Titulo>Já agendou?</Titulo>
      <Pressable onPress={() => router.push('/meus-agendamentos' as never)}>
        <Card style={s.linhaMeus}>
          <View style={s.linhaIcon}>
            <Ionicons name="list" size={18} color={color.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.linhaTitulo}>Meus agendamentos</Text>
            <Text style={s.linhaSub}>Veja o que já está marcado.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.ink3} />
        </Card>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  vazio: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  vazioTexto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, textAlign: 'center' },
  linhaEsp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  linhaEspTxt: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  linhaProf: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm },
  linhaMeus: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linhaIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  linhaSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
  faixa: { fontFamily: font.medium, fontSize: size.xs, color: color.navy600, marginTop: 4 },
});
// ── FIM BLOCO ──
