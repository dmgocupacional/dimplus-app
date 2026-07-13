// ═══ BLOCO: FORMATADORES ═══
// Funções puras. Sem dependência de estado, sem I/O.

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara parcial — o cartão não precisa expor o CPF inteiro na tela. */
export function maskCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}

export function formatBRL(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

/** ISO (YYYY-MM-DD) → DD/MM/AAAA. Sem `new Date()`: evita o bug de fuso do RN. */
export function formatData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** ISO → MM/AAAA. */
export function formatMesAno(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-');
  return `${m}/${y}`;
}

/** Compara datas ISO sem instanciar Date. Negativo = a vem antes de b. */
export function compareISO(a: string, b: string): number {
  return a.slice(0, 10).localeCompare(b.slice(0, 10));
}
// ── FIM BLOCO ──
