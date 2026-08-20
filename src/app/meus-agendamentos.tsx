// ═══ BLOCO: TELA — MEUS AGENDAMENTOS (S2-L3) ═══
//
// Leitura pura. 🔴 O shape do item NÃO foi confirmado ao vivo (conta de teste dá 404,
// mesmo caso de `exames`) — `normalizarMeuAgendamento` em `agendamento.ts` já trata
// campo por campo como incerto. Esta tela precisa tolerar `null` em qualquer campo
// exceto `id` sem quebrar layout.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Pill, Screen, Titulo } from '@/components/ui';
import { getMeusAgendamentos } from '@/lib/agendamento';
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
      return mensagemServidor || 'Não foi possível carregar seus agendamentos agora.';
  }
}

/** Trilha de status confirmada na doc oficial (não medida ao vivo com agendamento real
 * — `statusId` pode vir `null` de qualquer forma, ver comentário em `types.ts`). */
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

export default function MeusAgendamentos() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });

  const carregar = useCallback(async () => {
    setCarga({ estado: 'carregando' });
    const r = await getMeusAgendamentos();
    if (!r.ok) {
      setCarga({ estado: 'erro', tipo: r.tipo, mensagem: r.mensagem });
      return;
    }
    setCarga({ estado: 'pronto', lista: r.dados });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
          return (
            <Card key={a.id} style={s.linha}>
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
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
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
