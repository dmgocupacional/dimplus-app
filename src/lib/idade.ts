// ═══ BLOCO: IDADE E RESTRIÇÃO DE FAIXA ═══
//
// Por que este módulo existe (17/08/2026):
// até esta data NÃO HAVIA data de nascimento em NENHUMA tabela do banco — verificado por
// varredura em `information_schema` em todo o schema `public`, não só em `clientes`. Sem
// idade, a tela de agendamento ofereceria pediatra (`age_to: 16`) para adulto de 40 anos e
// a Feegow recusaria só na CONFIRMAÇÃO, depois de o cliente escolher horário.
//
// A decisão foi criar `clientes.data_nascimento` como dado NOSSO (a idade é regra de negócio
// nossa) e semeá-la da Feegow. Resultado do backfill: 531 dos 538 vinculados preenchidos.
//
// 🔴 O QUE O BACKFILL **NÃO** COBRIU, e é o caso que mais importa:
// os 271 clientes sem `feegow_paciente_id` continuam sem idade — e os 44 DEPENDENTES estão
// TODOS nesse grupo (0 dependentes com data). Dependente é justamente quem pode ser criança.
// Logo: o caminho "sem idade conhecida" NÃO é exceção rara, é o caminho de 100% do público
// pediátrico. Ele tem que ser bom, não um empty state.
//
// Consumido pelo S2. Nada aqui toca tela — só cálculo.

/** Restrição de faixa já normalizada. `null` em cada ponta = sem limite naquela ponta. */
export type FaixaIdade = {
  min: number | null;
  max: number | null;
};

/**
 * 🔴 A MESMA informação tem DUAS grafias na Feegow, dependendo do endpoint:
 *   - `feegow_disponibilidade`                  → { age_from, age_to }
 *   - `feegow_profissionais_por_especialidade`  → { idade_minima, idade_maxima }
 * Ler só uma faz o filtro passar batido SEM ERRO NENHUM. Por isso o tipo aceita as duas.
 */
export type RestricaoIdadeCrua =
  | {
      age_from?: number | string | null;
      age_to?: number | string | null;
      idade_minima?: number | string | null;
      idade_maxima?: number | string | null;
    }
  | null
  | undefined;

/**
 * Sentinelas de "sem limite" que a Feegow escreve COMO SE fossem restrição real.
 * Observadas na mesma resposta: `{age_from: 0, age_to: 127}` significa "atende todo mundo".
 * Exibir isso como "atende de 0 a 127 anos" é ruído; tratar como limite é filtro errado.
 */
const SENTINELA_MIN = 0;
const SENTINELA_MAX = 127;

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Normaliza `age_restriction` cru nas duas grafias, derrubando as sentinelas.
 * Devolve `null` quando o profissional não tem restrição efetiva alguma — o chamador
 * não precisa distinguir "veio null" de "veio 0/127", que significam a mesma coisa.
 */
export function lerRestricaoIdade(cru: RestricaoIdadeCrua): FaixaIdade | null {
  if (!cru) return null;

  // primeira grafia que aparecer, em cada ponta, independentemente da outra
  const minBruto = numeroOuNull(cru.age_from ?? cru.idade_minima);
  const maxBruto = numeroOuNull(cru.age_to ?? cru.idade_maxima);

  const min = minBruto === null || minBruto <= SENTINELA_MIN ? null : minBruto;
  const max = maxBruto === null || maxBruto >= SENTINELA_MAX ? null : maxBruto;

  if (min === null && max === null) return null;
  // faixa invertida é dado corrompido; tratar como "sem restrição" seria oferecer horário
  // que a Feegow vai recusar, então preserva-se e quem decide é `atendeFaixa`.
  return { min, max };
}

/**
 * Idade em anos completos NA DATA DE REFERÊNCIA — não hoje.
 * Quem faz 18 na semana que vem muda de faixa: usar `new Date()` aqui erraria a
 * elegibilidade de um agendamento marcado para depois do aniversário.
 *
 * `nascimento` é a string ISO (`AAAA-MM-DD`) que vem de `clientes.data_nascimento`.
 * Devolve `null` para qualquer entrada que não seja uma data ISO válida — inclusive
 * string vazia, que é forma REAL em coluna `text` vinda de sistema externo.
 */
export function idadeEm(nascimento: string | null | undefined, referencia: Date): number | null {
  if (typeof nascimento !== 'string') return null;
  const s = nascimento.trim();
  if (!s) return null;

  // ⚠️ NÃO usar `new Date(s)`: a Feegow entrega nascimento em d-m-Y ("29-04-1964") e
  // `new Date()` nessa forma é Invalid Date SILENCIOSO. Aqui só se aceita ISO, de propósito
  // — a conversão d-m-Y → ISO acontece no backfill, não em runtime de tela.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const ano = Number(ys);
  const mes = Number(ms);
  const dia = Number(ds);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (!Number.isFinite(referencia.getTime())) return null;

  let idade = referencia.getFullYear() - ano;
  // ainda não fez aniversário no ano de referência?
  const mesRef = referencia.getMonth() + 1;
  const diaRef = referencia.getDate();
  if (mesRef < mes || (mesRef === mes && diaRef < dia)) idade -= 1;

  if (idade < 0) return null; // nascimento no futuro: dado inválido, não idade negativa
  return idade;
}

/**
 * O profissional atende esta idade?
 *
 * 🔴 Idade DESCONHECIDA devolve `null`, não `false`. São coisas diferentes e a tela precisa
 * distinguir: `false` = "não atende, esconda"; `null` = "não sei, MOSTRE com a faixa
 * rotulada e deixe o usuário decidir". Colapsar `null` em `false` esconderia o pediatra de
 * 100% dos dependentes — que são exatamente as crianças. Colapsar em `true` ofereceria
 * horário que a Feegow recusa na confirmação.
 */
export function atendeFaixa(idade: number | null, faixa: FaixaIdade | null): boolean | null {
  if (faixa === null) return true; // sem restrição atende qualquer idade, mesmo desconhecida
  if (idade === null) return null;
  if (faixa.min !== null && idade < faixa.min) return false;
  if (faixa.max !== null && idade > faixa.max) return false;
  return true;
}

/**
 * Rótulo curto da faixa, para a tela mostrar quando a idade é desconhecida.
 * `null` quando não há restrição — nesse caso a tela não deve escrever nada.
 */
export function rotuloFaixa(faixa: FaixaIdade | null): string | null {
  if (faixa === null) return null;
  const { min, max } = faixa;
  if (min !== null && max !== null) return `Atende de ${min} a ${max} anos`;
  if (max !== null) return `Atende até ${max} anos`;
  if (min !== null) return `Atende a partir de ${min} anos`;
  return null;
}
// ── FIM BLOCO ──
