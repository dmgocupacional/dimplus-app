// ═══ BLOCO: TELA — EXAMES (S2-L2) ═══
//
// Primeira tela do app a consumir `chamarFeegow` (S2-L1). Leitura pura: pedidos
// (solicitados) e laudos (prontos) do paciente logado. Sem escrita, sem `age_restriction`
// — isso fica pro S2-L3 (agendamento).
//
// 🔴 O 404 "CPF sem cadastro na clínica" é CASO REAL, provado ao vivo no L1 com a conta
// de teste — não é erro, é estado de UI próprio. Precisa de mensagem que não pareça bug.
//
// Os demais estados de `chamarFeegow` (401/403/307/rede) também têm texto próprio: a
// pessoa nunca deveria ver "erro ao carregar" genérico aqui.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import { formatData } from '@/lib/format';
import { getLaudos, getPedidosExame, getUrlLaudo } from '@/lib/exames';
import type { FeegowErroTipo } from '@/lib/feegowApi';
import type { Laudo, PedidoExame } from '@/lib/types';
import { color, font, radius, size, space } from '@/theme/tokens';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; tipo: FeegowErroTipo; mensagem: string }
  | { estado: 'pronto'; pedidos: PedidoExame[]; laudos: Laudo[] };

/** Mensagem por tipo de erro — nunca "algo deu errado" genérico. */
function mensagemErro(tipo: FeegowErroTipo, mensagemServidor: string): string {
  switch (tipo) {
    case 'nao_encontrado':
      // Este é o "CPF sem cadastro na clínica" — caso REAL provado ao vivo no L1.
      return 'Não encontramos seu cadastro na clínica ainda. Fale com a central de atendimento para regularizar.';
    case 'modulo_desativado':
      return 'Este serviço estará disponível em breve.';
    case 'nao_autenticado':
    case 'sem_sessao':
      return 'Sua sessão expirou. Saia e entre novamente para continuar.';
    case 'rede':
      return 'Sem conexão. Verifique a internet e tente de novo.';
    default:
      return mensagemServidor || 'Não foi possível carregar seus exames agora.';
  }
}

/** `DataPedido` cru vem `"AAAA-MM-DD HH:MM:SS"`; `formatData` só olha os 10 primeiros
 * chars, então funciona igual pra data pura e pra datetime. */
function dataOuTraco(iso: string | null): string {
  return iso ? formatData(iso) : '—';
}

export default function Exames() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [abrindoLaudo, setAbrindoLaudo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarga({ estado: 'carregando' });
    const [rPedidos, rLaudos] = await Promise.all([getPedidosExame(), getLaudos()]);

    // Os dois batem no mesmo paciente — se um falhar por sessão/cadastro, o outro falha
    // pela mesma razão. Mostrar o primeiro erro encontrado é suficiente; não é preciso
    // reconciliar dois erros diferentes na tela.
    if (!rPedidos.ok) {
      setCarga({ estado: 'erro', tipo: rPedidos.tipo, mensagem: rPedidos.mensagem });
      return;
    }
    if (!rLaudos.ok) {
      setCarga({ estado: 'erro', tipo: rLaudos.tipo, mensagem: rLaudos.mensagem });
      return;
    }
    setCarga({ estado: 'pronto', pedidos: rPedidos.dados, laudos: rLaudos.dados });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrirLaudo(labReportId: number) {
    setAbrindoLaudo(labReportId);
    const r = await getUrlLaudo(labReportId);
    setAbrindoLaudo(null);
    if (!r.ok) {
      // Falha pontual em pegar a URL assinada — não derruba a tela inteira, só este laudo.
      return;
    }
    Linking.openURL(r.dados).catch(() => {
      // sem app de PDF / sem navegador — falha silenciosa é aceitável aqui, mesmo padrão de ajuda.tsx
    });
  }

  if (carga.estado === 'carregando') {
    return (
      <Screen titulo="Exames" scroll={false}>
        <ActivityIndicator color={color.navy} />
      </Screen>
    );
  }

  if (carga.estado === 'erro') {
    return (
      <Screen titulo="Exames" scroll={false}>
        <Aviso tom="info" icone="information-circle" texto={mensagemErro(carga.tipo, carga.mensagem)} />
      </Screen>
    );
  }

  const { pedidos, laudos } = carga;

  return (
    <Screen titulo="Exames">
      <Titulo>Laudos prontos</Titulo>
      {laudos.length === 0 ? (
        <Card style={s.vazio}>
          <Ionicons name="document-text-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTexto}>Nenhum laudo pronto por aqui ainda.</Text>
        </Card>
      ) : (
        laudos.map((l) => (
          <Pressable
            key={l.labReportId}
            onPress={() => abrirLaudo(l.labReportId)}
            disabled={abrindoLaudo === l.labReportId}
          >
            <Card style={s.linha}>
              <View style={s.linhaIcon}>
                <Ionicons name="document-text" size={18} color={color.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linhaTitulo}>Laudo de {dataOuTraco(l.dataLaudo)}</Text>
                <Text style={s.linhaSub}>Pedido em {dataOuTraco(l.dataPedido)}</Text>
              </View>
              {abrindoLaudo === l.labReportId ? (
                <ActivityIndicator size="small" color={color.navy} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={color.ink3} />
              )}
            </Card>
          </Pressable>
        ))
      )}

      <Titulo>Exames solicitados</Titulo>
      {pedidos.length === 0 ? (
        <Card style={s.vazio}>
          <Ionicons name="clipboard-outline" size={30} color={color.ink3} />
          <Text style={s.vazioTexto}>Nenhum exame solicitado no momento.</Text>
        </Card>
      ) : (
        pedidos.map((p) => (
          <Card key={p.id} style={s.linha}>
            <View style={s.linhaIcon}>
              <Ionicons name="flask" size={18} color={color.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.linhaTitulo}>{p.nome ?? (p.exameId ? `Exame #${p.exameId}` : 'Exame')}</Text>
              <Text style={s.linhaSub}>Solicitado em {dataOuTraco(p.dataPedido)}</Text>
              {p.observacao ? <Text style={s.observacao}>{p.observacao}</Text> : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  vazio: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  vazioTexto: {
    fontFamily: font.regular,
    fontSize: size.sm,
    color: color.ink2,
    textAlign: 'center',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.sm,
  },
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
  observacao: {
    fontFamily: font.regular,
    fontSize: size.xs,
    color: color.ink3,
    marginTop: 4,
  },
});
// ── FIM BLOCO ──
