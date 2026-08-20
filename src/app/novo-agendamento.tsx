// ═══ BLOCO: TELA — NOVO AGENDAMENTO (S2-L3 leitura + S2-L4b criar) ═══
//
// Caminho de "Novo agendamento" do menu `/agendar`. Escolhe especialidade → mostra profissionais com horário nos próximos
// `JANELA_DISPONIBILIDADE_DIAS` dias, agrupados por UNIDADE (nunca por sala — §5 do
// FEEGOW-LEITURA) → escolhe profissional (abre slots de data/horário, mesmo padrão da
// remarcação em `meus-agendamentos.tsx`) → confirma → cria.
//
// 🔴 `procedimento_id` NUNCA é escolha livre nesta versão: vem de
// `catalogo.consultaPorEspecialidade`, resolvido no erp a partir do vínculo OFICIAL da
// Feegow. Especialidade sem esse vínculo confiável (`podeAgendarCriacao` false) mostra
// aviso e não deixa prosseguir — não inventa procedimento.
//
// 🔴 Regras que este arquivo tem que respeitar (itens 1-7 do §8 do FEEGOW-LEITURA):
//   1. especialidade escolhida ANTES de consultar horário — nunca "lista tudo".
//   4. `[]` (sem horário) não é erro — já vira "sem vaga" antes de chegar aqui.
//   5. idade DESCONHECIDA (`atendeFaixa` devolve `null`) MOSTRA o profissional com a
//      faixa rotulada — nunca esconde. É o caminho de 100% dos dependentes hoje.
//      `false` (não atende) ESCONDE — só aí é filtro de verdade.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import {
  criarAgendamento,
  getDisponibilidade,
  getOpcoes,
  getProcedimentos,
  podeAgendarCriacao,
  type Opcoes,
} from '@/lib/agendamento';
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

/** Sub-fluxo de criação — mesmo padrão da remarcação em `meus-agendamentos.tsx`: vive
 * sobre a mesma tela, não é navegação. Os slots do profissional escolhido já vêm da
 * mesma busca de disponibilidade da tela (não refaz a chamada). */
type Criacao =
  | { fase: 'escolher_slot'; especialidade: Especialidade; grupo: GrupoProfissional; slots: SlotDisponibilidade[] }
  | {
      fase: 'carregando_catalogo';
      especialidade: Especialidade;
      grupo: GrupoProfissional;
      slot: SlotDisponibilidade;
    }
  | { fase: 'erro_catalogo'; especialidade: Especialidade; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'sem_vinculo'; especialidade: Especialidade }
  | {
      fase: 'confirmando';
      especialidade: Especialidade;
      grupo: GrupoProfissional;
      slot: SlotDisponibilidade;
      procedimentoId: number;
      slotsRestantes: SlotDisponibilidade[]; // pra "Voltar" não perder a lista
    }
  | {
      fase: 'criando';
      grupo: GrupoProfissional;
      slot: SlotDisponibilidade;
      procedimentoId: number;
    }
  | { fase: 'erro_criar'; mensagem: string };

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
  const [criacao, setCriacao] = useState<Criacao | null>(null);

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

  // ── Sub-fluxo de criação (S2-L4b) ────────────────────────────────────────

  function iniciarCriacao(especialidade: Especialidade, grupo: GrupoProfissional, todosSlots: SlotDisponibilidade[]) {
    const slotsDoProfissional = todosSlots
      .filter((sl) => sl.profissionalId === grupo.profissionalId)
      .slice()
      .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
    setCriacao({ fase: 'escolher_slot', especialidade, grupo, slots: slotsDoProfissional });
  }

  async function escolherSlot(
    especialidade: Especialidade,
    grupo: GrupoProfissional,
    slot: SlotDisponibilidade,
    slotsRestantes: SlotDisponibilidade[]
  ) {
    setCriacao({ fase: 'carregando_catalogo', especialidade, grupo, slot });
    const r = await getProcedimentos();
    if (!r.ok) {
      setCriacao({ fase: 'erro_catalogo', especialidade, tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    if (!podeAgendarCriacao(r.dados, especialidade.id)) {
      setCriacao({ fase: 'sem_vinculo', especialidade });
      return;
    }
    // seguro pelo `podeAgendarCriacao` acima: a chave existe no mapa.
    const procedimentoId = r.dados.consultaPorEspecialidade.get(especialidade.id)!;
    confirmarCriacao(especialidade, grupo, slot, procedimentoId, slotsRestantes);
  }

  function confirmarCriacao(
    especialidade: Especialidade,
    grupo: GrupoProfissional,
    slot: SlotDisponibilidade,
    procedimentoId: number,
    slotsRestantes: SlotDisponibilidade[]
  ) {
    setCriacao({ fase: 'confirmando', especialidade, grupo, slot, procedimentoId, slotsRestantes });
    const nomeProf = grupo.tratamento ? `${grupo.tratamento} ${grupo.nome}` : grupo.nome;
    Alert.alert(
      'Confirmar agendamento?',
      `${especialidade.nome} com ${nomeProf}\n${formatData(slot.data)} às ${slot.horario.slice(0, 5)}`,
      [
        {
          text: 'Voltar',
          style: 'cancel',
          onPress: () => setCriacao({ fase: 'escolher_slot', especialidade, grupo, slots: slotsRestantes }),
        },
        {
          text: 'Confirmar',
          onPress: () => executarCriacao(grupo, slot, procedimentoId, especialidade, slotsRestantes),
        },
      ]
    );
  }

  async function executarCriacao(
    grupo: GrupoProfissional,
    slot: SlotDisponibilidade,
    procedimentoId: number,
    especialidade: Especialidade,
    slotsRestantes: SlotDisponibilidade[]
  ) {
    setCriacao({ fase: 'criando', grupo, slot, procedimentoId });
    const r = await criarAgendamento({
      localId: slot.localId,
      profissionalId: grupo.profissionalId,
      especialidadeId: especialidade.id,
      procedimentoId,
      data: slot.data,
      horario: slot.horario,
    });
    if (!r.ok) {
      Alert.alert('Não foi possível agendar', mensagemErro(r.tipo, r.mensagem));
      // 🔴 Devolve a lista INTACTA. Zerar aqui fazia a tela dizer "nenhum horário
      //    disponível" quando o que falhou foi a CRIAÇÃO, não a busca — mensagem
      //    mentirosa que escondia o erro real (medido em 20/08/2026).
      //    Continua sem refazer a busca: os slots são os mesmos já carregados.
      setCriacao({ fase: 'escolher_slot', especialidade, grupo, slots: slotsRestantes });
      return;
    }
    setCriacao(null);
    router.push('/meus-agendamentos' as never);
  }

  // ── Sub-tela de criação, sobrepõe o fluxo normal enquanto ativa ──
  if (criacao) {
    return (
      <Screen titulo="Escolher horário" scroll={criacao.fase === 'escolher_slot'}>
        <Pressable onPress={() => setCriacao(null)} style={s.voltar}>
          <Ionicons name="chevron-back" size={18} color={color.navy} />
          <Text style={s.voltarTxt}>Voltar</Text>
        </Pressable>

        {criacao.fase === 'carregando_catalogo' || criacao.fase === 'confirmando' || criacao.fase === 'criando' ? (
          <ActivityIndicator color={color.navy} style={{ marginTop: space.xl }} />
        ) : criacao.fase === 'erro_catalogo' ? (
          <Aviso tom="info" icone="information-circle" texto={mensagemErro(criacao.tipo, criacao.mensagem)} />
        ) : criacao.fase === 'sem_vinculo' ? (
          <Aviso
            tom="info"
            icone="information-circle"
            texto={`Agendamento online de ${criacao.especialidade.nome} ainda não está disponível pelo app. Ligue pra clínica pra marcar.`}
          />
        ) : criacao.fase === 'erro_criar' ? (
          <Aviso tom="info" icone="information-circle" texto={criacao.mensagem} />
        ) : criacao.slots.length === 0 ? (
          <Card style={s.vazio}>
            <Text style={s.vazioTexto}>Nenhum outro horário livre com este profissional nos próximos dias.</Text>
          </Card>
        ) : (
          criacao.slots.map((slot, i) => (
            <Pressable
              key={`${slot.data}-${slot.horario}-${i}`}
              onPress={() => escolherSlot(criacao.especialidade, criacao.grupo, slot, criacao.slots)}
            >
              <Card style={s.linhaSlot}>
                <Text style={s.linhaTitulo}>{formatData(slot.data)}</Text>
                <Text style={s.linhaSub}>{slot.horario.slice(0, 5)}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
    );
  }

  if (etapa.fase === 'carregando_opcoes') {
    return (
      <Screen titulo="Novo agendamento" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (etapa.fase === 'erro_opcoes') {
    return (
      <Screen titulo="Novo agendamento" scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(etapa.tipo, etapa.mensagem)} />
      </Screen>
    );
  }

  if (etapa.fase === 'escolher_especialidade') {
    const { opcoes } = etapa;
    return (
      <Screen titulo="Novo agendamento">
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
  //
  // 🔴 MEDIDO AO VIVO EM 20/08/2026: `available-schedule` IGNORA o `especialidade_id`.
  //    Pedindo Ginecologia (271) volta o corpo clínico INTEIRO — neurocirurgião,
  //    pediatra, radiologista. Mesma patologia do `procedures/list`, que também ignora
  //    o filtro. Não dá para confiar no filtro do servidor: filtramos AQUI, cruzando
  //    com `especialidadeIds` que o `opcoes` já devolve por profissional.
  //    Sem isto a tela oferece médico que não atende a especialidade escolhida — e a
  //    Feegow recusa a criação só na confirmação, depois do cliente escolher horário.
  const gruposPorProfissional = new Map<number, GrupoProfissional>();
  for (const slot of slots) {
    const prof = profissionaisPorId.get(slot.profissionalId);
    if (!prof) continue; // profissional não veio no catálogo — não inventa nome

    // Não atende a especialidade escolhida → fora. Lista vazia também sai: sem o
    // vínculo declarado não há como afirmar que atende, e oferecer levaria a uma
    // criação recusada pela Feegow.
    if (!prof.especialidadeIds.includes(especialidade.id)) continue;

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
                <Pressable key={g.profissionalId} onPress={() => iniciarCriacao(especialidade, g, slots)}>
                  <Card style={s.linhaProf}>
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
                    <Ionicons name="chevron-forward" size={18} color={color.ink3} />
                  </Card>
                </Pressable>
              ))}
            </View>
          );
        })
      )}
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
  voltar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: space.md },
  voltarTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  linhaSlot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
});
// ── FIM BLOCO ──
