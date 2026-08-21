// ═══ BLOCO: TELA — MEUS AGENDAMENTOS (S2-L3 leitura + S2-L4 cancelar/remarcar) ═══
//
// Leitura pura + as duas escritas SEM bloqueio real: cancelar e remarcar. Criar
// agendamento NÃO está aqui — bloqueado do lado do erp (ver `agendamento.ts`).
//
// 🔴 O shape do item NÃO foi confirmado ao vivo (conta de teste dá 404, mesmo caso de
// `exames`) — `normalizarMeuAgendamento` em `agendamento.ts` já trata campo por campo
// como incerto. Esta tela tolera `null` em qualquer campo exceto `id`.
//
// 🔴 A posse (o agendamento é DESTE paciente) é verificada no SERVIDOR
// (`pacientePossuiAgendamento`, fail-closed) — o app não reimplementa essa checagem,
// só repassa o `agendamento_id` que já veio da lista que o erp devolveu pra este cliente.
//
// "Remarcar" só aparece quando `profissionalId` foi extraído com sucesso do item — sem
// ele não dá pra buscar novos horários daquele profissional sem re-listar a agenda
// inteira (payload gigante, §2 do FEEGOW-LEITURA). Sem `profissionalId`, o caminho é
// cancelar e marcar de novo por `/agendar`.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CalendarioMes } from '@/components/CalendarioMes';
import { Aviso, Card, Pill, Screen } from '@/components/ui';
import {
  cancelarAgendamento,
  getDisponibilidade,
  getMeusAgendamentos,
  getOpcoes,
  hojeIsoLocal,
  reagendarAgendamento,
  separarPorData,
  type Opcoes,
} from '@/lib/agendamento';
import type { FeegowErroTipo } from '@/lib/feegowApi';
import { formatData } from '@/lib/format';
import type { MeuAgendamento, SlotDisponibilidade } from '@/lib/types';
import { color, font, radius, size, space } from '@/theme/tokens';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; tipo: FeegowErroTipo; mensagem: string }
  | { estado: 'pronto'; lista: MeuAgendamento[]; opcoes: Opcoes | null };

/** Sub-fluxo de remarcação — vive dentro da mesma tela, não é navegação. */
type Remarcacao =
  | { fase: 'carregando'; agendamento: MeuAgendamento }
  | { fase: 'erro'; agendamento: MeuAgendamento; tipo: FeegowErroTipo; mensagem: string }
  | { fase: 'escolher_dia'; agendamento: MeuAgendamento; slots: SlotDisponibilidade[] }
  | { fase: 'escolher_hora'; agendamento: MeuAgendamento; slots: SlotDisponibilidade[]; dia: string }
  | { fase: 'confirmando'; agendamento: MeuAgendamento; slot: SlotDisponibilidade };

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
      return 'Esse horário acabou de ser ocupado. Volte e escolha outro.';
    case 'rede':
      return 'Sem conexão. Verifique a internet e tente de novo.';
    default:
      // Nunca exibir payload cru do servidor — ver nota em `novo-agendamento.tsx`.
      return mensagemServidor && mensagemServidor.length < 120 && !/[{}"\\]/.test(mensagemServidor)
        ? mensagemServidor
        : 'Não foi possível completar agora. Tente de novo em instantes.';
  }
}

/** Trilha de status confirmada na doc oficial (não medida ao vivo com agendamento real
 * — `statusId` pode vir `null` de qualquer forma, ver comentário em `types.ts`). Só os
 * dois estados "ativos" (1, 7) ganham botão de ação — cancelar/remarcar um agendamento
 * já desmarcado ou já atendido não faz sentido de produto, mesmo que a Feegow aceitasse. */
function rotuloStatus(statusId: number | null): { texto: string; tom: 'ok' | 'aviso' | 'erro' | 'neutro' } | null {
  switch (statusId) {
    case 1:
      return { texto: 'não confirmado', tom: 'aviso' };
    case 7:
      return { texto: 'confirmado', tom: 'ok' };
    case 11:
    case 16:
      return { texto: 'desmarcado', tom: 'erro' };
    case 15:
      return { texto: 'remarcado', tom: 'neutro' };
    case 6:
      return { texto: 'não compareceu', tom: 'erro' };
    default:
      return null; // status desconhecido ou ausente — não inventa rótulo
  }
}

function podeAgir(statusId: number | null): boolean {
  return statusId === 1 || statusId === 7;
}

export default function MeusAgendamentos() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [remarcacao, setRemarcacao] = useState<Remarcacao | null>(null);

  const carregar = useCallback(async () => {
    setCarga({ estado: 'carregando' });
    // 🔴 `appoints/search` devolve `profissional_id` mas NÃO o nome do profissional nem
    //    o da especialidade — por isso a lista mostrava "Profissional a confirmar" mesmo
    //    em agendamento com médico definido (reportado em campo, 21/08/2026). O catálogo
    //    de `opcoes` tem os nomes; cruzamos por id aqui.
    const [r, rOpcoes] = await Promise.all([getMeusAgendamentos(), getOpcoes()]);
    if (!r.ok) {
      setCarga({ estado: 'erro', tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    // Opções são COMPLEMENTO: se falharem, a lista ainda aparece — só sem os nomes.
    const profs = rOpcoes.ok ? new Map(rOpcoes.dados.profissionais.map((p) => [p.id, p])) : null;
    const esps = rOpcoes.ok ? new Map(rOpcoes.dados.especialidades.map((e) => [e.id, e.nome])) : null;

    const comNomes = r.dados.map((a) => {
      const prof = a.profissionalId !== null ? profs?.get(a.profissionalId) : undefined;
      return {
        ...a,
        // Só preenche o que veio vazio — se a Feegow um dia mandar o nome, ele vence.
        profissionalNome:
          a.profissionalNome ??
          (prof ? (prof.tratamento ? `${prof.tratamento} ${prof.nome}` : prof.nome) : null),
        especialidadeNome:
          a.especialidadeNome ??
          // Fonte certa: especialidade DESTE agendamento, não a primeira do profissional
          // (bug documentado — Cardiologia exibida numa consulta de Geriatria).
          (a.especialidadeId !== null ? (esps?.get(a.especialidadeId) ?? null) : null) ??
          (prof?.especialidadeIds.length ? (esps?.get(prof.especialidadeIds[0]) ?? null) : null),
      };
    });

    setCarga({ estado: 'pronto', lista: separarPorData(comNomes, hojeIsoLocal()).futuros, opcoes: rOpcoes.ok ? rOpcoes.dados : null });
  }, []);

  // 🔴 useFocusEffect, NÃO useEffect. A tela fica na pilha de navegação: ao criar um
  //    agendamento e voltar para cá, o componente era reaproveitado sem remontar, o
  //    efeito não rodava de novo e a lista mostrada era a ANTIGA — dando a impressão de
  //    que o agendamento não tinha sido criado (visto em campo 21/08/2026: o registro
  //    existia na Feegow e a tela não o mostrava). Recarregar no foco cobre também o
  //    cancelamento feito na recepção enquanto o app estava aberto.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  function confirmarCancelamento(a: MeuAgendamento) {
    Alert.alert('Cancelar agendamento?', 'Isso libera o horário na agenda da clínica. Não dá pra desfazer.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar agendamento', style: 'destructive', onPress: () => executarCancelamento(a) },
    ]);
  }

  async function executarCancelamento(a: MeuAgendamento) {
    setCancelando(a.id);
    const r = await cancelarAgendamento(a.id);
    setCancelando(null);
    if (!r.ok) {
      Alert.alert('Não foi possível cancelar', mensagemErro(r.tipo, r.mensagem));
      return;
    }
    void carregar();
  }

  async function iniciarRemarcacao(a: MeuAgendamento) {
    if (a.profissionalId === null) return; // botão nem deveria aparecer nesse caso
    setRemarcacao({ fase: 'carregando', agendamento: a });
    // Reaproveita as opções já carregadas com a lista; só busca de novo se faltarem.
    let opcoes = carga.estado === 'pronto' ? carga.opcoes : null;
    if (!opcoes) {
      const rOpcoes = await getOpcoes();
      if (!rOpcoes.ok) {
        setRemarcacao({ fase: 'erro', agendamento: a, tipo: rOpcoes.tipo, mensagem: rOpcoes.mensagem });
        return;
      }
      opcoes = rOpcoes.dados;
    }
    const locaisPorId = new Map(opcoes.locais.map((l) => [l.id, l]));
    const rDisp = await getDisponibilidade({ profissionalId: a.profissionalId }, locaisPorId);
    if (!rDisp.ok) {
      setRemarcacao({ fase: 'erro', agendamento: a, tipo: rDisp.tipo, mensagem: rDisp.mensagem });
      return;
    }
    setRemarcacao({ fase: 'escolher_dia', agendamento: a, slots: rDisp.dados });
  }

  function confirmarRemarcacao(
    agendamento: MeuAgendamento,
    slot: SlotDisponibilidade,
    slotsRestantes: SlotDisponibilidade[]
  ) {
    Alert.alert(
      'Remarcar agendamento?',
      `Novo horário: ${formatData(slot.data)} às ${slot.horario.slice(0, 5)}. O horário atual é liberado na agenda.`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => executarRemarcacao(agendamento, slot, slotsRestantes) },
      ]
    );
  }

  async function executarRemarcacao(
    agendamento: MeuAgendamento,
    slot: SlotDisponibilidade,
    slotsRestantes: SlotDisponibilidade[]
  ) {
    setRemarcacao({ fase: 'confirmando', agendamento, slot });
    const r = await reagendarAgendamento(agendamento.id, slot.data, slot.horario);
    if (!r.ok) {
      Alert.alert('Não foi possível remarcar', mensagemErro(r.tipo, r.mensagem));
      // 🔴 Devolve a lista INTACTA. Zerar aqui fazia a tela dizer "nenhum outro horário
      //    livre" quando o que falhou foi a REMARCAÇÃO, não a busca (mesmo defeito
      //    corrigido em `agendar.tsx`, 20/08/2026). Segue sem refazer a busca.
      setRemarcacao({ fase: 'escolher_dia', agendamento, slots: slotsRestantes });
      return;
    }
    setRemarcacao(null);
    void carregar();
  }

  // ── Sub-tela de remarcação, sobrepõe a lista enquanto ativa ──
  if (remarcacao) {
    // Mesmo fluxo de duas etapas do "novo agendamento": calendário e depois horário.
    // Antes era uma lista corrida que repetia a mesma data em dezenas de linhas.
    const voltar = () => {
      if (remarcacao.fase === 'escolher_hora') {
        setRemarcacao({
          fase: 'escolher_dia',
          agendamento: remarcacao.agendamento,
          slots: remarcacao.slots,
        });
        return;
      }
      setRemarcacao(null);
    };

    const horasDoDia =
      remarcacao.fase === 'escolher_hora'
        ? remarcacao.slots
            .filter((sl) => sl.data === remarcacao.dia)
            .slice()
            .sort((a, b) => a.horario.localeCompare(b.horario))
        : [];

    return (
      <Screen titulo={remarcacao.fase === 'escolher_hora' ? 'Novo horário' : 'Nova data'}>
        <Pressable onPress={voltar} style={s.voltar}>
          <Ionicons name="chevron-back" size={18} color={color.navy} />
          <Text style={s.voltarTxt}>Voltar</Text>
        </Pressable>

        {remarcacao.fase === 'carregando' || remarcacao.fase === 'confirmando' ? (
          <ActivityIndicator color={color.navy} style={{ marginTop: space.xl }} />
        ) : remarcacao.fase === 'erro' ? (
          <Aviso tom="info" icone="information-circle" texto={mensagemErro(remarcacao.tipo, remarcacao.mensagem)} />
        ) : remarcacao.slots.length === 0 ? (
          <Card style={s.vazio}>
            <Text style={s.vazioTexto}>Nenhum outro horário livre com este profissional nos próximos dias.</Text>
          </Card>
        ) : remarcacao.fase === 'escolher_dia' ? (
          <Card>
            <Text style={s.linhaTitulo}>
              {remarcacao.agendamento.profissionalNome ?? 'Mesmo profissional'}
            </Text>
            <Text style={s.remarcaSub}>Escolha a nova data.</Text>
            <CalendarioMes
              diasComVaga={[...new Set(remarcacao.slots.map((sl) => sl.data))]}
              onEscolherDia={(dia) =>
                setRemarcacao({
                  fase: 'escolher_hora',
                  agendamento: remarcacao.agendamento,
                  slots: remarcacao.slots,
                  dia,
                })
              }
            />
          </Card>
        ) : remarcacao.fase === 'escolher_hora' ? (
          <>
            <Text style={s.diaEscolhido}>{formatData(remarcacao.dia)}</Text>
            <View style={s.gradeHoras}>
              {horasDoDia.map((slot, i) => (
                <Pressable
                  key={`${slot.horario}-${i}`}
                  style={s.chipHora}
                  onPress={() => confirmarRemarcacao(remarcacao.agendamento, slot, remarcacao.slots)}
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

  if (carga.estado === 'carregando') {
    return (
      <Screen titulo="Meus agendamentos" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (carga.estado === 'erro') {
    return (
      <Screen titulo="Meus agendamentos" scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(carga.tipo, carga.mensagem)} />
      </Screen>
    );
  }

  const { lista } = carga;

  return (
    <Screen titulo="Meus agendamentos">
      {lista.length === 0 ? (
        <Card style={s.vazio}>
          <Ionicons name="calendar-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTexto}>Nenhum agendamento no momento.</Text>
        </Card>
      ) : (
        lista.map((a) => {
          const status = rotuloStatus(a.statusId);
          const mostrarAcoes = podeAgir(a.statusId);
          return (
            <Card key={a.id} style={s.cardAgendamento}>
              <View style={s.linha}>
                <View style={s.linhaIcon}>
                  <Ionicons name="calendar" size={18} color={color.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linhaTitulo}>{a.especialidadeNome ?? 'Consulta'}</Text>
                  <Text style={s.linhaSub}>
                    {a.profissionalNome ?? 'Profissional a confirmar'}
                    {a.data ? ` · ${formatData(a.data)}` : ''}
                    {a.horario ? ` às ${a.horario.slice(0, 5)}` : ''}
                  </Text>
                </View>
                {status ? <Pill texto={status.texto} tom={status.tom} /> : null}
              </View>

              {mostrarAcoes ? (
                <View style={s.acoes}>
                  {a.profissionalId !== null ? (
                    <Pressable onPress={() => iniciarRemarcacao(a)} style={s.botaoSecundario}>
                      <Text style={s.botaoSecundarioTxt}>Remarcar</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => confirmarCancelamento(a)}
                    style={s.botaoPerigo}
                    disabled={cancelando === a.id}
                  >
                    {cancelando === a.id ? (
                      <ActivityIndicator size="small" color={color.danger} />
                    ) : (
                      <Text style={s.botaoPerigoTxt}>Cancelar</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  vazio: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  vazioTexto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, textAlign: 'center' },
  cardAgendamento: { marginBottom: space.sm },
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
  acoes: { flexDirection: 'row', gap: space.sm, marginTop: space.md, justifyContent: 'flex-end' },
  botaoSecundario: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  botaoSecundarioTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  botaoPerigo: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FBE6E6',
    minWidth: 76,
    alignItems: 'center',
  },
  botaoPerigoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.danger },
  voltar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: space.md },
  voltarTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  remarcaSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2, marginBottom: space.lg },
  diaEscolhido: { fontFamily: font.bold, fontSize: size.base, color: color.ink, marginBottom: space.md, textTransform: 'capitalize' },
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
