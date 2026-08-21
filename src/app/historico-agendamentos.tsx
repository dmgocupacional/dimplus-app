// ═══ BLOCO: TELA — HISTÓRICO DE AGENDAMENTOS ═══
//
// Consultas encerradas: as que já passaram e as que foram desmarcadas (estas mesmo com
// data futura — ver `separarPorData`). SOMENTE LEITURA, de propósito: cancelar ou remarcar algo
// que já aconteceu não faz sentido de produto, e a Feegow aceitaria a chamada — o que
// mexeria na agenda real da clínica por engano. Por isso nenhum botão de ação aqui.
//
// Mesma fonte de `meus-agendamentos` (`GET /api/feegow/agendamento`, janela -30/+180 do
// erp); o corte futuro × passado é por DATA, em `separarPorData` — ver o comentário lá
// sobre por que não é por `statusId`.
//
// 🔴 O shape do item NÃO foi confirmado ao vivo (ver `types.ts`): qualquer campo pode vir
// `null` exceto `id`. Esta tela tolera isso — nunca esconde um item por campo faltando.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Pill, Screen } from '@/components/ui';
import { getMeusAgendamentos, getOpcoes, hojeIsoLocal, separarPorData } from '@/lib/agendamento';
import type { FeegowErroTipo } from '@/lib/feegowApi';
import { formatData } from '@/lib/format';
import type { MeuAgendamento } from '@/lib/types';
import { color, font, radius, size, space } from '@/theme/tokens';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; tipo: FeegowErroTipo; mensagem: string }
  | { estado: 'pronto'; lista: MeuAgendamento[] };

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

/** Mesma trilha de status de `meus-agendamentos`, sem os rótulos que só fazem sentido
 *  em agendamento ativo. `null` = status ausente ou desconhecido: não inventa rótulo. */
function rotuloStatus(statusId: number | null): { texto: string; tom: 'ok' | 'aviso' | 'erro' | 'neutro' } | null {
  switch (statusId) {
    case 3:
      return { texto: 'atendido', tom: 'ok' };
    case 6:
      return { texto: 'não compareceu', tom: 'erro' };
    case 11:
    case 16:
      return { texto: 'desmarcado', tom: 'neutro' };
    case 15:
      return { texto: 'remarcado', tom: 'neutro' };
    default:
      return null;
  }
}

export default function HistoricoAgendamentos() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });

  const carregar = useCallback(async () => {
    setCarga({ estado: 'carregando' });
    // Mesmo caso de `meus-agendamentos`: a Feegow manda `profissional_id`, não o nome —
    // resolvemos pelo catálogo de opções, senão a tela toda diz "não informado".
    const [r, rOpcoes] = await Promise.all([getMeusAgendamentos(), getOpcoes()]);
    if (!r.ok) {
      setCarga({ estado: 'erro', tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    const profs = rOpcoes.ok ? new Map(rOpcoes.dados.profissionais.map((p) => [p.id, p])) : null;
    const esps = rOpcoes.ok ? new Map(rOpcoes.dados.especialidades.map((e) => [e.id, e.nome])) : null;
    const comNomes = r.dados.map((a) => {
      const prof = a.profissionalId !== null ? profs?.get(a.profissionalId) : undefined;
      return {
        ...a,
        profissionalNome:
          a.profissionalNome ??
          (prof ? (prof.tratamento ? `${prof.tratamento} ${prof.nome}` : prof.nome) : null),
        especialidadeNome:
          a.especialidadeNome ??
          (prof?.especialidadeIds.length ? (esps?.get(prof.especialidadeIds[0]) ?? null) : null),
      };
    });
    // Mais recentes primeiro: no histórico o que interessa é a última consulta, não a
    // primeira. `data` pode chegar null aqui agora (desmarcado sem data) — o `?? ''`
    // no comparador joga esses para o fim em vez de quebrar a ordenação.
    const passados = separarPorData(comNomes, hojeIsoLocal()).passados.sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? '')
    );
    setCarga({ estado: 'pronto', lista: passados });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carga.estado === 'carregando') {
    return (
      <Screen titulo="Histórico" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (carga.estado === 'erro') {
    return (
      <Screen titulo="Histórico" scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(carga.tipo, carga.mensagem)} />
      </Screen>
    );
  }

  const { lista } = carga;

  return (
    <Screen titulo="Histórico">
      {lista.length === 0 ? (
        <Card style={s.vazio}>
          <Ionicons name="time-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTexto}>Nada por aqui ainda. Consultas realizadas e desmarcadas aparecem nesta tela.</Text>
        </Card>
      ) : (
        lista.map((a) => {
          const status = rotuloStatus(a.statusId);
          return (
            <Card key={a.id} style={s.cardAgendamento}>
              <View style={s.linha}>
                <View style={s.linhaIcon}>
                  <Ionicons name="time" size={18} color={color.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linhaTitulo}>{a.especialidadeNome ?? 'Consulta'}</Text>
                  <Text style={s.linhaSub}>
                    {a.profissionalNome ?? 'Profissional não informado'}
                    {a.data ? ` · ${formatData(a.data)}` : ''}
                    {a.horario ? ` às ${a.horario.slice(0, 5)}` : ''}
                  </Text>
                </View>
                {status ? <Pill texto={status.texto} tom={status.tom} /> : null}
              </View>
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
});
// ── FIM BLOCO ──
