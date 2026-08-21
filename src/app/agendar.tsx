// ═══ BLOCO: TELA — AGENDAR (MENU) ═══
//
// Porta de entrada do módulo de agendamento. Só navegação — nenhuma chamada de rede
// acontece aqui, de propósito: até 20/08/2026 esta rota abria direto na escolha de
// especialidade, o que fazia o app buscar catálogo e horários mesmo quando o cliente só
// queria ver o que já tinha marcado.
//
// As três entradas são caminhos DIFERENTES sobre o mesmo módulo:
//   · Novo agendamento     → `/novo-agendamento` (especialidade → profissional → criar)
//   · Meus agendamentos    → `/meus-agendamentos` (futuros, com cancelar/remarcar)
//   · Histórico            → `/historico-agendamentos` (encerrados, somente leitura)
//
// O corte entre "meus" e "histórico" é por DATA, não por status: `statusId` vem `null`
// com frequência (shape nunca confirmado ao vivo — ver `types.ts`), e cortar por um
// campo que costuma faltar jogaria agendamento real para o lado errado.
import { router } from 'expo-router';

import { Card, LinhaLista, Screen, Titulo } from '@/components/ui';

export default function Agendar() {
  return (
    <Screen titulo="Agendar">
      <Titulo>O que você quer fazer?</Titulo>

      <Card>
        <LinhaLista
          icone="calendar"
          titulo="Novo agendamento"
          subtitulo="Marcar consulta com um especialista."
          onPress={() => router.push('/novo-agendamento' as never)}
        />
      </Card>

      <Card>
        <LinhaLista
          icone="list"
          titulo="Meus agendamentos"
          subtitulo="O que já está marcado. Dá pra remarcar ou cancelar."
          onPress={() => router.push('/meus-agendamentos' as never)}
        />
      </Card>

      <Card>
        <LinhaLista
          icone="time"
          titulo="Histórico de agendamentos"
          subtitulo="Consultas realizadas e desmarcadas."
          onPress={() => router.push('/historico-agendamentos' as never)}
        />
      </Card>
    </Screen>
  );
}
// ── FIM BLOCO ──
