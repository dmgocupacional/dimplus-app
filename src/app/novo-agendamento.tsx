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
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CalendarioMes } from '@/components/CalendarioMes';
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
import type { CatalogoProcedimentos, Especialidade, SlotDisponibilidade } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

type Etapa =
  | { fase: 'carregando_opcoes' }
  | { fase: 'erro_opcoes'; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'escolher_especialidade'; opcoes: Opcoes; catalogo: CatalogoProcedimentos | null }
  | { fase: 'carregando_horarios'; opcoes: Opcoes; catalogo: CatalogoProcedimentos | null; especialidade: Especialidade }
  | { fase: 'erro_horarios'; opcoes: Opcoes; catalogo: CatalogoProcedimentos | null; especialidade: Especialidade; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'horarios'; opcoes: Opcoes; catalogo: CatalogoProcedimentos | null; especialidade: Especialidade; slots: SlotDisponibilidade[] };

/** Sub-fluxo de criação — mesmo padrão da remarcação em `meus-agendamentos.tsx`: vive
 * sobre a mesma tela, não é navegação. Os slots do profissional escolhido já vêm da
 * mesma busca de disponibilidade da tela (não refaz a chamada). */
type Criacao =
  | { fase: 'carregando_agenda'; especialidade: Especialidade; grupo: GrupoProfissional }
  | {
      fase: 'escolher_dia';
      especialidade: Especialidade;
      grupo: GrupoProfissional;
      slots: SlotDisponibilidade[];
    }
  | {
      fase: 'escolher_hora';
      especialidade: Especialidade;
      grupo: GrupoProfissional;
      slots: SlotDisponibilidade[];
      dia: string; // AAAA-MM-DD
    }
  | {
      fase: 'carregando_catalogo';
      especialidade: Especialidade;
      grupo: GrupoProfissional;
      slot: SlotDisponibilidade;
    }
  | { fase: 'erro_catalogo'; especialidade: Especialidade; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'sem_vinculo'; especialidade: Especialidade }
  | {
      fase: 'criando';
      grupo: GrupoProfissional;
      slot: SlotDisponibilidade;
      procedimentoId: number;
    };

function mensagemErro(tipo: FeegowErroTipo, mensagemServidor: string): string {
  switch (tipo) {
    case 'nao_encontrado':
      return 'Não encontramos seu cadastro na clínica ainda. Fale com a central de atendimento para regularizar.';
    case 'modulo_desativado':
      return 'Este serviço estará disponível em breve.';
    case 'nao_autenticado':
    case 'sem_sessao':
      return 'Sua sessão expirou. Saia e entre novamente para continuar.';
    case 'conflito':
      // Corrida por horário concorrido — acontece de verdade e não é falha do cliente.
      return 'Esse horário acabou de ser ocupado. Escolha outro na lista, que já atualizamos.';
    case 'rede':
      return 'Sem conexão. Verifique a internet e tente de novo.';
    default:
      // 🔴 NUNCA cair no texto cru do servidor: em campo (21/08/2026) isso exibiu o JSON
      //    da Feegow escapado na tela do cliente. Mensagem do servidor só quando for
      //    curta e legível — qualquer coisa com chave/aspas/backslash é payload, não frase.
      return mensagemServidor && mensagemServidor.length < 120 && !/[{}"\\]/.test(mensagemServidor)
        ? mensagemServidor
        : 'Não foi possível concluir agora. Tente de novo em instantes.';
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

/** Ícone por área, casando por palavra-chave no nome. Sem mapa fixo por id: a lista de
 *  especialidades muda na Feegow e um id novo cairia sem ícone nenhum. `medkit` é o
 *  fallback — nunca fica sem ícone. */
function iconeEspecialidade(nome: string): keyof typeof Ionicons.glyphMap {
  const n = nome.toLowerCase();
  if (n.includes('gineco') || n.includes('obst')) return 'female';
  if (n.includes('pediatr')) return 'happy';
  if (n.includes('cardio') || n.includes('ecocardio')) return 'heart';
  if (n.includes('dermato')) return 'hand-left';
  if (n.includes('oftalmo')) return 'eye';
  if (n.includes('otorrino')) return 'ear';
  if (n.includes('psic') || n.includes('neuro')) return 'happy-outline';
  if (n.includes('ortoped') || n.includes('traumato')) return 'body';
  if (n.includes('nutri')) return 'nutrition';
  if (n.includes('pneumo')) return 'fitness';
  if (n.includes('cirurgia')) return 'cut';
  if (n.includes('clinico') || n.includes('clínico') || n.includes('geriatr')) return 'medical';
  if (n.includes('alergo') || n.includes('imuno')) return 'flower';
  if (n.includes('radio') || n.includes('ultrasso') || n.includes('imagem')) return 'scan';
  return 'medkit';
}

export default function Agendar() {
  const { cliente } = useSession();
  const [etapa, setEtapa] = useState<Etapa>({ fase: 'carregando_opcoes' });
  const [criacao, setCriacao] = useState<Criacao | null>(null);
  const [busca, setBusca] = useState('');

  const carregarOpcoes = useCallback(async () => {
    setEtapa({ fase: 'carregando_opcoes' });
    // Catálogo junto das opções, em paralelo: é ele que diz QUAIS especialidades dá pra
    // agendar pelo app. Sem isso a tela listava as 39 e o cliente só descobria que a
    // dele não dava depois de escolher médico, dia e horário — levava o "não" no fim.
    const [op, cat] = await Promise.all([getOpcoes(), getProcedimentos()]);
    if (!op.ok) {
      setEtapa({ fase: 'erro_opcoes', tipo: op.tipo, mensagem: op.mensagem });
      return;
    }
    // Catálogo é COMPLEMENTO, não requisito: se ele falhar, a tela ainda abre (com todas
    // as especialidades) em vez de morrer. Degrada, não quebra.
    setEtapa({ fase: 'escolher_especialidade', opcoes: op.dados, catalogo: cat.ok ? cat.dados : null });
  }, []);

  useEffect(() => {
    void carregarOpcoes();
  }, [carregarOpcoes]);

  async function escolherEspecialidade(
    opcoes: Opcoes,
    catalogo: CatalogoProcedimentos | null,
    especialidade: Especialidade
  ) {
    setEtapa({ fase: 'carregando_horarios', opcoes, catalogo, especialidade });
    const locaisPorId = new Map(opcoes.locais.map((l) => [l.id, l]));
    const r = await getDisponibilidade({ especialidadeId: especialidade.id }, locaisPorId);
    if (!r.ok) {
      setEtapa({ fase: 'erro_horarios', opcoes, catalogo, especialidade, tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    setEtapa({ fase: 'horarios', opcoes, catalogo, especialidade, slots: r.dados });
  }

  // ── Sub-fluxo de criação (S2-L4b) ────────────────────────────────────────

  /** Busca a agenda DO PROFISSIONAL escolhido, sempre fresca.
   *  Não reaproveita a lista da especialidade por dois motivos: (1) ela já está velha
   *  quando o cliente chega aqui, e (2) só com `profissional_id` o servidor consegue
   *  podar os horários que a Feegow oferece mas recusa na criação (erp v0.260.0). */
  async function carregarAgendaDoProfissional(
    especialidade: Especialidade,
    grupo: GrupoProfissional
  ): Promise<SlotDisponibilidade[] | null> {
    if (etapa.fase !== 'horarios') return null;
    const locaisPorId = new Map(etapa.opcoes.locais.map((l) => [l.id, l]));
    const r = await getDisponibilidade({ profissionalId: grupo.profissionalId }, locaisPorId);
    if (!r.ok) return null;
    return r.dados
      .filter((sl) => sl.profissionalId === grupo.profissionalId)
      .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  }

  async function iniciarCriacao(especialidade: Especialidade, grupo: GrupoProfissional) {
    setCriacao({ fase: 'carregando_agenda', especialidade, grupo });
    const slots = await carregarAgendaDoProfissional(especialidade, grupo);
    setCriacao({ fase: 'escolher_dia', especialidade, grupo, slots: slots ?? [] });
  }

  async function escolherSlot(
    especialidade: Especialidade,
    grupo: GrupoProfissional,
    slot: SlotDisponibilidade,
    slots: SlotDisponibilidade[]
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
    const nomeProf = grupo.tratamento ? `${grupo.tratamento} ${grupo.nome}` : grupo.nome;
    setCriacao({ fase: 'escolher_hora', especialidade, grupo, slots, dia: slot.data });
    Alert.alert(
      'Confirmar agendamento?',
      `${especialidade.nome} com ${nomeProf}\n${formatData(slot.data)} às ${slot.horario.slice(0, 5)}`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => executarCriacao(grupo, slot, procedimentoId, especialidade, slots),
        },
      ]
    );
  }

  async function executarCriacao(
    grupo: GrupoProfissional,
    slot: SlotDisponibilidade,
    procedimentoId: number,
    especialidade: Especialidade,
    slots: SlotDisponibilidade[]
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
      // Conflito: a agenda em mãos está PROVADAMENTE velha — recarrega. Nos demais
      // erros ela continua válida e não pagamos a rede de novo.
      if (r.tipo === 'conflito') {
        setCriacao({ fase: 'carregando_agenda', especialidade, grupo });
        const novos = await carregarAgendaDoProfissional(especialidade, grupo);
        setCriacao({ fase: 'escolher_dia', especialidade, grupo, slots: novos ?? [] });
        return;
      }
      setCriacao({ fase: 'escolher_hora', especialidade, grupo, slots, dia: slot.data });
      return;
    }
    setCriacao(null);
    // `replace`, não `push`: com push o fluxo de marcação ficava na pilha e o "voltar"
    // da lista devolvia o cliente para a tela de escolher horário do agendamento que
    // ele acabou de criar.
    router.replace('/meus-agendamentos' as never);
  }

  // ── Sub-tela de criação, sobrepõe o fluxo normal enquanto ativa ──
  if (criacao) {
    const emEspera =
      criacao.fase === 'carregando_agenda' ||
      criacao.fase === 'carregando_catalogo' ||
      criacao.fase === 'criando';

    // Voltar é contextual: da hora volta pro calendário, do calendário sai do fluxo.
    const voltar = () => {
      if (criacao.fase === 'escolher_hora') {
        setCriacao({
          fase: 'escolher_dia',
          especialidade: criacao.especialidade,
          grupo: criacao.grupo,
          slots: criacao.slots,
        });
        return;
      }
      setCriacao(null);
    };

    const horasDoDia =
      criacao.fase === 'escolher_hora'
        ? criacao.slots.filter((sl) => sl.data === criacao.dia)
        : [];

    return (
      <Screen titulo={criacao.fase === 'escolher_hora' ? 'Escolher horário' : 'Escolher data'}>
        <Pressable onPress={voltar} style={s.voltar}>
          <Ionicons name="chevron-back" size={18} color={color.navy} />
          <Text style={s.voltarTxt}>Voltar</Text>
        </Pressable>

        {emEspera ? (
          <ActivityIndicator color={color.navy} style={{ marginTop: space.xl }} />
        ) : criacao.fase === 'erro_catalogo' ? (
          <Aviso tom="info" icone="information-circle" texto={mensagemErro(criacao.tipo, criacao.mensagem)} />
        ) : criacao.fase === 'sem_vinculo' ? (
          <Aviso
            tom="info"
            icone="information-circle"
            texto={`Agendamento online de ${criacao.especialidade.nome} ainda não está disponível pelo app. Ligue pra clínica pra marcar.`}
          />
        ) : criacao.fase === 'escolher_dia' ? (
          criacao.slots.length === 0 ? (
            <Card style={s.vazio}>
              <Text style={s.vazioTexto}>
                Nenhum horário livre com este profissional nos próximos dias.
              </Text>
            </Card>
          ) : (
            <Card>
              <Text style={s.profTitulo}>
                {criacao.grupo.tratamento
                  ? `${criacao.grupo.tratamento} ${criacao.grupo.nome}`
                  : criacao.grupo.nome}
              </Text>
              <Text style={s.profSub}>Toque em um dia com vaga.</Text>
              <CalendarioMes
                diasComVaga={[...new Set(criacao.slots.map((sl) => sl.data))]}
                onEscolherDia={(dia) =>
                  setCriacao({
                    fase: 'escolher_hora',
                    especialidade: criacao.especialidade,
                    grupo: criacao.grupo,
                    slots: criacao.slots,
                    dia,
                  })
                }
              />
            </Card>
          )
        ) : criacao.fase === 'escolher_hora' ? (
          <>
            <Text style={s.diaEscolhido}>{formatData(criacao.dia)}</Text>
            <View style={s.gradeHoras}>
              {horasDoDia.map((slot, i) => (
                <Pressable
                  key={`${slot.horario}-${i}`}
                  style={s.chipHora}
                  onPress={() => escolherSlot(criacao.especialidade, criacao.grupo, slot, criacao.slots)}
                >
                  <Text style={s.chipHoraTexto}>{slot.horario.slice(0, 5)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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
    const { opcoes, catalogo } = etapa;

    // 🔴 Só entram as que dá PRA AGENDAR de fato — decisão do Henrique em 21/08/2026.
    //    Das 39 especialidades da clínica, 6 têm vínculo de procedimento confiável; as
    //    outras usam o `consulta_id` default (8), que aponta errado e faria a Feegow
    //    recusar. Antes elas apareciam e o cliente só levava o "não" no fim do fluxo.
    //    Sem catálogo (ele falhou), mostramos TODAS: melhor oferecer demais do que
    //    apresentar uma tela vazia por causa de uma chamada que caiu.
    const agendaveis = catalogo
      ? opcoes.especialidades.filter((e) => podeAgendarCriacao(catalogo, e.id))
      : opcoes.especialidades;

    const termo = busca.trim().toLowerCase();
    const visiveis = termo
      ? agendaveis.filter((e) => e.nome.toLowerCase().includes(termo))
      : agendaveis;

    return (
      <Screen titulo="Novo agendamento">
        <Titulo>Escolha a especialidade</Titulo>

        {/* Busca só aparece quando há lista suficiente para valer a pena procurar. */}
        {agendaveis.length > 6 ? (
          <View style={s.buscaCaixa}>
            <Ionicons name="search" size={16} color={color.ink3} />
            <TextInput
              style={s.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar especialidade"
              placeholderTextColor={color.ink3}
              autoCorrect={false}
              returnKeyType="search"
            />
            {busca.length > 0 ? (
              <Pressable onPress={() => setBusca('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={color.ink3} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {visiveis.length === 0 ? (
          <Card style={s.vazio}>
            <Text style={s.vazioTexto}>
              {termo
                ? `Nada encontrado para "${busca}".`
                : 'Nenhuma especialidade disponível pra agendamento online no momento.'}
            </Text>
          </Card>
        ) : agendaveis.length > 6 ? (
          // Lista compacta: mesmo limiar que liga a busca. Acima de 6 especialidades a
          // grade de blocos grandes virava rolagem longa (31 itens = ~16 linhas) sem
          // ganho de escaneabilidade — a busca já resolve achar rápido, então a lista
          // compacta prioriza densidade. Toque ainda >= 44px (padding + altura da linha).
          <View style={s.listaEsp}>
            {visiveis.map((e) => (
              <Pressable
                key={e.id}
                style={s.linhaEsp}
                onPress={() => escolherEspecialidade(opcoes, catalogo, e)}
              >
                <View style={s.linhaEspIcone}>
                  <Ionicons name={iconeEspecialidade(e.nome)} size={18} color={color.navy} />
                </View>
                <Text style={s.linhaEspTxt} numberOfLines={2}>
                  {e.nome}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={color.ink3} />
              </Pressable>
            ))}
          </View>
        ) : (
          // Grade de dois por linha: com poucas especialidades a lista deixava a tela
          // vazia, e o bloco maior dá um alvo de toque melhor no celular.
          <View style={s.gradeEsp}>
            {visiveis.map((e) => (
              <Pressable
                key={e.id}
                style={s.blocoEsp}
                onPress={() => escolherEspecialidade(opcoes, catalogo, e)}
              >
                <View style={s.blocoEspIcone}>
                  <Ionicons name={iconeEspecialidade(e.nome)} size={24} color={color.navy} />
                </View>
                {/* 2 linhas: "Ginecologia e Obstetrícia" não cabe em uma, e cortar o
                    nome da especialidade é pior do que o bloco crescer um pouco. */}
                <Text style={s.blocoEspTxt} numberOfLines={2}>
                  {e.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* As não-agendáveis ficam FORA da lista, mas a clínica atende muito mais que
            isto — sem esta linha a tela sugere que só existem estas especialidades. */}
        {catalogo && !termo ? (
          <Text style={s.rodapeTelefone}>
            Outras especialidades são agendadas pela central de atendimento.
          </Text>
        ) : null}
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
                <Pressable key={g.profissionalId} onPress={() => iniciarCriacao(especialidade, g)}>
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
  buscaCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.md,
  },
  buscaInput: { flex: 1, fontFamily: font.regular, fontSize: size.base, color: color.ink, padding: 0 },
  rodapeTelefone: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  gradeEsp: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  listaEsp: { gap: space.sm },
  linhaEsp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    minHeight: 56,
  },
  linhaEspIcone: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaEspTxt: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: size.sm,
    color: color.ink,
  },
  blocoEsp: {
    // 48% (e não 50%) para o `gap` caber sem estourar a linha e virar 1 coluna.
    width: '48%',
    minHeight: 116,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  blocoEspIcone: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocoEspTxt: {
    fontFamily: font.bold,
    fontSize: size.sm,
    color: color.ink,
    textAlign: 'center',
  },
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
  profTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  profSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2, marginBottom: space.lg },
  diaEscolhido: {
    fontFamily: font.bold,
    fontSize: size.base,
    color: color.ink,
    marginBottom: space.md,
    textTransform: 'capitalize',
  },
  gradeHoras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipHora: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    borderWidth: 1,
    borderColor: color.greenDeep,
  },
  chipHoraTexto: { fontFamily: font.bold, fontSize: size.base, color: color.navy },
});
// ── FIM BLOCO ──
