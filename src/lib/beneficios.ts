// ═══ BLOCO: BENEFÍCIOS INCLUSOS (SALDO E MOVIMENTOS) ═══
// 28/09/2026 · Sprint B. O que o plano da pessoa inclui, quanto já usou e o que está agendado,
// vindo do erp (/api/app/beneficios → fn_beneficios_saldo / fn_beneficios_movimentos).
// Regras do Henrique: agendou RESERVA · atendido USA · falta PERDE · cancelar ou remarcar com
// menos de 24h PERDE · com 24h ou mais DEVOLVE. O erp decide; aqui só se mostra e se AVISA
// antes de cancelar/remarcar em cima da hora.
// Horas da Feegow chegam LOCAIS (America/Sao_Paulo) e sem fuso: "AAAA-MM-DDTHH:MM:SS".
import { chamarFeegow } from '@/lib/feegowApi';

export type Beneficio = {
  categoria_id: string;
  nome: string;
  modo: 'incluso' | 'desconto';
  desconto_pct: number | null;
  periodicidade: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  /** null = ilimitado ou desconto (não se conta uso). */
  quantidade: number | null;
  usadas: number;
  reservadas: number;
  perdidas: number;
  restantes: number | null;
};

export type Movimento = {
  agendamento_id: number | null;
  categoria_id: string;
  quando: string;
  estado: 'usada' | 'reservada' | 'perdida' | 'devolvida';
  motivo: string;
  especialidade: string | null;
  unidade: { nome: string; endereco: string | null } | null;
  /** Até quando dá para cancelar ou remarcar sem perder (só em "reservada"). */
  prazo_sem_perda: string | null;
};

export type MeusBeneficios = {
  plano: { nome: string; inclui_clube: boolean; forma_cobranca: string } | null;
  beneficios: Beneficio[];
  movimentos: Movimento[];
};

export async function buscarBeneficios(): Promise<MeusBeneficios | null> {
  const r = await chamarFeegow<MeusBeneficios>('/api/app/beneficios');
  return r.ok ? r.dados : null;
}

/** "Agora" no relógio de São Paulo, na mesma forma das horas da Feegow. */
function agoraSP(): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? '00';
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour') === '24' ? '00' : v('hour')}:${v('minute')}:${v('second')}`;
}

/** true = já passou do prazo de 24h: cancelar ou remarcar agora desconta a consulta. */
export function passouDoPrazo(prazoSemPerda: string | null): boolean {
  if (!prazoSemPerda) return false;
  return agoraSP() > prazoSemPerda.slice(0, 19);
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** "sex 09/10 às 14:00". */
export function formatarQuando(local: string): string {
  const [d, h] = local.split('T');
  const [y, m, dd] = (d ?? '').split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, dd ?? 1)).getUTCDay()] ?? '';
  return `${dia} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${(h ?? '00:00').slice(0, 5)}`;
}

/** Reservadas por agendamento, para a tela de agendamentos marcar em amarelo. */
export function reservadasPorAgendamento(b: MeusBeneficios | null): Map<number, Movimento> {
  const m = new Map<number, Movimento>();
  for (const x of b?.movimentos ?? []) {
    if (x.estado === 'reservada' && x.agendamento_id != null) m.set(x.agendamento_id, x);
  }
  return m;
}

/** Só os benefícios com contagem (quantidade limitada). */
export function beneficiosContados(b: MeusBeneficios | null): Beneficio[] {
  return (b?.beneficios ?? []).filter((x) => x.modo === 'incluso' && x.quantidade != null);
}
// ── FIM BLOCO ──
