// ═══ BLOCO: AGENDAMENTO (S2-L3) ═══
//
// Leitura: opções (catálogo), disponibilidade (horários) e "meus agendamentos". Mesmo
// padrão de `exames.ts` — HTTP autenticado via `chamarFeegow`, separado de `data.ts`
// (Supabase direto).
//
// Shapes de `opcoes` e `disponibilidade` CONFIRMADOS ao vivo em 19/08/2026 (não
// presumidos da doc — ver docs/FEEGOW-LEITURA.md §§2-6 e docs/sessions/2026-08-19-*).
// `MeuAgendamento` é melhor esforço — ver comentário em `types.ts`.

import { lerRestricaoIdade, type FaixaIdade } from './idade';
import { chamarFeegow, type FeegowResultado } from './feegowApi';
import type { Especialidade, LocalAgenda, MeuAgendamento, Profissional, SlotDisponibilidade, Unidade } from './types';

// ─── Helpers de leitura defensiva ───────────────────────────────────────────

function paraNumero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

function paraTexto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ─── Opções (catálogo) ──────────────────────────────────────────────────────

/**
 * Salas de import, sem correspondência real na clínica — nunca podem aparecer pro
 * cliente. Confirmado ao vivo (19/08): `{id:26, local:"importado", unidade_id:0}` e
 * `{id:27, local:"importado", unidade_id:1}`. Allowlist por id, não por nome — o §5 do
 * FEEGOW-LEITURA já avisa que filtrar por nome não é robusto.
 */
const SALAS_LIXO = new Set([26, 27]);

function normalizarEspecialidade(item: unknown): Especialidade | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = paraNumero(o.especialidade_id);
  const nome = paraTexto(o.nome);
  if (id === null || nome === null) return null;
  return { id, nome, exibirAgendamentoOnline: Number(o.exibir_agendamento_online) === 1 };
}

function normalizarUnidade(item: unknown): Unidade | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = paraNumero(o.unidade_id);
  const nomeFantasia = paraTexto(o.nome_fantasia);
  if (id === null || nomeFantasia === null) return null;
  return { id, nomeFantasia, cidade: paraTexto(o.cidade) ?? '', bairro: paraTexto(o.bairro) ?? '' };
}

function normalizarLocal(item: unknown): LocalAgenda | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = paraNumero(o.id);
  const unidadeId = paraNumero(o.unidade_id);
  if (id === null || unidadeId === null) return null;
  if (SALAS_LIXO.has(id)) return null; // filtrado aqui, nunca chega à tela
  return { id, unidadeId };
}

function paraNumeroOuString(v: unknown): number | string | null {
  if (typeof v === 'number' || typeof v === 'string') return v;
  return null;
}

function normalizarProfissional(item: unknown): (Profissional & { faixa: FaixaIdade | null }) | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = paraNumero(o.profissional_id);
  const nome = paraTexto(o.nome);
  if (id === null || nome === null) return null;
  const especialidades = Array.isArray(o.especialidades) ? o.especialidades : [];
  const especialidadeIds = especialidades
    .map((e) => (e && typeof e === 'object' ? paraNumero((e as Record<string, unknown>).especialidade_id) : null))
    .filter((n): n is number => n !== null);
  // `age_restriction` vem ANINHADO num objeto próprio (confirmado ao vivo 19/08/2026:
  // `{ age_restriction: { idade_minima, idade_maxima } }`), não como campos soltos no
  // profissional — não é a mesma forma da grafia usada em `disponibilidade`
  // (`{age_from, age_to}`, IRMÃO de `local_id`, ver `achatarDisponibilidade`).
  const restricao = o.age_restriction;
  const restricaoCrua =
    restricao && typeof restricao === 'object'
      ? {
          idade_minima: paraNumeroOuString((restricao as Record<string, unknown>).idade_minima),
          idade_maxima: paraNumeroOuString((restricao as Record<string, unknown>).idade_maxima),
        }
      : null;
  return {
    id,
    nome,
    tratamento: paraTexto(o.tratamento),
    especialidadeIds,
    faixa: lerRestricaoIdade(restricaoCrua),
  };
}

export type Opcoes = {
  especialidades: Especialidade[];
  unidades: Unidade[];
  locais: LocalAgenda[];
  profissionais: (Profissional & { faixa: FaixaIdade | null })[];
};

export async function getOpcoes(): Promise<FeegowResultado<Opcoes>> {
  const r = await chamarFeegow<{
    especialidades: unknown;
    unidades: { matriz?: unknown; unidades?: unknown } | null;
    locais: unknown;
    profissionais: unknown;
  }>('/api/feegow/agendamento/opcoes');
  if (!r.ok) return r;

  const especialidades = (Array.isArray(r.dados.especialidades) ? r.dados.especialidades : [])
    .map(normalizarEspecialidade)
    .filter((e): e is Especialidade => e !== null && e.exibirAgendamentoOnline);

  // matriz + unidades concatenadas: a distinção não importa pro cliente escolher onde ir.
  const listaUnidadesCru = [
    ...(Array.isArray(r.dados.unidades?.matriz) ? r.dados.unidades!.matriz! : []),
    ...(Array.isArray(r.dados.unidades?.unidades) ? r.dados.unidades!.unidades! : []),
  ];
  const unidades = listaUnidadesCru.map(normalizarUnidade).filter((u): u is Unidade => u !== null);

  const locais = (Array.isArray(r.dados.locais) ? r.dados.locais : [])
    .map(normalizarLocal)
    .filter((l): l is LocalAgenda => l !== null);

  const profissionais = (Array.isArray(r.dados.profissionais) ? r.dados.profissionais : [])
    .map(normalizarProfissional)
    .filter((p): p is Profissional & { faixa: FaixaIdade | null } => p !== null);

  return { ok: true, dados: { especialidades, unidades, locais, profissionais } };
}

// ─── Disponibilidade ────────────────────────────────────────────────────────

/** Janela de busca. Maior que isso o payload cresce demais (§2 do FEEGOW-LEITURA: 4 dias
 * sem filtro já deu milhares de entradas); menor arrisca mostrar "sem horário" com
 * frequência mesmo havendo vaga um pouco mais à frente. Ajustável — não é contrato da API. */
export const JANELA_DISPONIBILIDADE_DIAS = 21;

function isoOffsetDias(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Achata o shape aninhado (profissional → local_id → data → horários) em uma lista
 * plana de slots, já sem as salas 26/27 (via `locaisPorId`) e já SEM o profissional
 * inteiro quando o dado dele é ilegível — não inventa slot de item malformado.
 *
 * 🔴 O nível de topo é literalmente `{ "profissional_id": { "<id>": {...} } }` — a
 * CHAVE do objeto de fora é o texto fixo `"profissional_id"`, não os ids em si (esses
 * ficam UM nível dentro). Confirmado ao vivo 19/08/2026; bateu com o §3 do
 * FEEGOW-LEITURA.md, que eu tinha lido errado na primeira versão desta função — o teste
 * contra dado real (não só tsc) foi o que pegou isso.
 */
function achatarDisponibilidade(cru: unknown, locaisPorId: Map<number, LocalAgenda>): SlotDisponibilidade[] {
  if (!cru || typeof cru !== 'object') return [];
  const envelope = cru as Record<string, unknown>;
  const porProfissional = envelope.profissional_id;
  if (!porProfissional || typeof porProfissional !== 'object') return [];

  const slots: SlotDisponibilidade[] = [];
  for (const [profStr, entradaProf] of Object.entries(porProfissional as Record<string, unknown>)) {
    const profissionalId = paraNumero(profStr);
    if (profissionalId === null || !entradaProf || typeof entradaProf !== 'object') continue;
    // `age_restriction` é IRMÃO de `local_id`, não filho — não usado aqui (a checagem de
    // idade acontece na tela, cruzando com `Profissional.faixa` de `getOpcoes`, que já
    // tem a mesma informação na outra grafia). Ler os locais.
    const porLocal = (entradaProf as Record<string, unknown>).local_id;
    if (!porLocal || typeof porLocal !== 'object') continue;

    for (const [localStr, porData] of Object.entries(porLocal as Record<string, unknown>)) {
      const localId = paraNumero(localStr);
      const local = localId === null ? undefined : locaisPorId.get(localId);
      if (!local) continue; // salas 26/27 (e qualquer id desconhecido) caem aqui
      if (!porData || typeof porData !== 'object') continue;

      for (const [data, horarios] of Object.entries(porData as Record<string, unknown>)) {
        if (!Array.isArray(horarios)) continue; // `[]` é "sem vaga", já cai natural aqui
        for (const h of horarios) {
          if (typeof h !== 'string') continue;
          slots.push({ profissionalId, localId: local.id, unidadeId: local.unidadeId, data, horario: h });
        }
      }
    }
  }
  return slots;
}

export async function getDisponibilidade(
  filtros: { especialidadeId?: number; profissionalId?: number },
  locaisPorId: Map<number, LocalAgenda>
): Promise<FeegowResultado<SlotDisponibilidade[]>> {
  const params: Record<string, string> = {
    tipo: 'A',
    data_inicio: isoOffsetDias(0),
    data_fim: isoOffsetDias(JANELA_DISPONIBILIDADE_DIAS),
  };
  if (filtros.especialidadeId !== undefined) params.especialidade_id = String(filtros.especialidadeId);
  if (filtros.profissionalId !== undefined) params.profissional_id = String(filtros.profissionalId);
  const qs = new URLSearchParams(params);
  const r = await chamarFeegow<{ disponibilidade: unknown }>(
    `/api/feegow/agendamento/disponibilidade?${qs.toString()}`
  );
  if (!r.ok) return r;
  return { ok: true, dados: achatarDisponibilidade(r.dados.disponibilidade, locaisPorId) };
}

// ─── Meus agendamentos ──────────────────────────────────────────────────────

/**
 * Extração defensiva do id — mesmo padrão de `extrairIdsAgendamento` em
 * `app-feegow-guard.ts` do erp, porque nem lá o campo é dado como certo.
 */
function extrairId(o: Record<string, unknown>): number | null {
  for (const chave of ['agendamento_id', 'id_agendamento', 'id', 'appoint_id']) {
    const n = paraNumero(o[chave]);
    if (n !== null) return n;
  }
  return null;
}

function extrairTexto(o: Record<string, unknown>, candidatos: string[]): string | null {
  for (const chave of candidatos) {
    const v = paraTexto(o[chave]);
    if (v !== null) return v;
  }
  return null;
}

function normalizarMeuAgendamento(item: unknown): MeuAgendamento | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = extrairId(o);
  if (id === null) return null;
  return {
    id,
    profissionalId: paraNumero(o.profissional_id ?? o.ProfissionalID ?? o.id_profissional),
    data: extrairTexto(o, ['data', 'Data', 'data_agendamento']),
    horario: extrairTexto(o, ['horario', 'Horario', 'hora']),
    statusId: paraNumero(o.status_id ?? o.StatusID),
    profissionalNome: extrairTexto(o, ['profissional_nome', 'nome_profissional', 'ProfissionalNome']),
    especialidadeNome: extrairTexto(o, ['especialidade_nome', 'nome_especialidade', 'EspecialidadeNome']),
  };
}

export async function getMeusAgendamentos(): Promise<FeegowResultado<MeuAgendamento[]>> {
  const r = await chamarFeegow<{ agendamentos: unknown }>('/api/feegow/agendamento');
  if (!r.ok) return r;
  const lista = Array.isArray(r.dados.agendamentos) ? r.dados.agendamentos : [];
  return { ok: true, dados: lista.map(normalizarMeuAgendamento).filter((a): a is MeuAgendamento => a !== null) };
}

// ─── Cancelar / Remarcar (S2-L4) ────────────────────────────────────────────
//
// Primeira ESCRITA do app em sistema de terceiro. A recepção da clínica VÊ o resultado.
// A posse (o agendamento pertence a quem está logado) é verificada no SERVIDOR
// (`pacientePossuiAgendamento`, fail-closed) — aqui só repassamos o `agendamento_id`;
// não há checagem de posse redundante no app porque ela não teria como ser confiável
// (o app não vê a lista "crua" da Feegow, só o que o erp já filtrou).
//
// 🔴 Criar agendamento NÃO está neste lote — bloqueado por dois problemas do lado do
// erp-dimplus (fora deste repo): (1) não existe rota de catálogo de procedimentos pro
// app, e `procedimento_id` é obrigatório pra criar; (2) a rota `POST /agendamento` do
// erp não passa `tabela_id` pra `criarAgendamentoFeegow`, o que faria o agendamento
// nascer no PARTICULAR CHEIO em vez do preço DIM+. Ver handoff da sessão.

export async function cancelarAgendamento(
  agendamentoId: number,
  obs?: string
): Promise<FeegowResultado<{ ok: true }>> {
  const r = await chamarFeegow<{ ok: boolean }>('/api/feegow/agendamento/cancelar', {
    method: 'POST',
    body: { agendamento_id: agendamentoId, ...(obs ? { obs } : {}) },
  });
  if (!r.ok) return r;
  return { ok: true, dados: { ok: true } };
}

export async function reagendarAgendamento(
  agendamentoId: number,
  data: string,
  horario: string
): Promise<FeegowResultado<{ ok: true }>> {
  const r = await chamarFeegow<{ ok: boolean }>('/api/feegow/agendamento/reagendar', {
    method: 'POST',
    body: { agendamento_id: agendamentoId, data, horario },
  });
  if (!r.ok) return r;
  return { ok: true, dados: { ok: true } };
}
// ── FIM BLOCO ──
