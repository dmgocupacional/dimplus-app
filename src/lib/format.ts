// ═══ BLOCO: FORMATADORES ═══
// Funções puras. Sem dependência de estado, sem I/O.
//
// 🔴 BURACO CONHECIDO EM `formatCPF` / `maskCPF` (apurado 17/08/2026, tratamento adiado
// pelo Henrique). Ambas fazem `padStart(11,'0').slice(0,11)`, o que assume 11 dígitos.
// A base tem, dos 809 clientes:
//     11 dígitos ... 795   (ok)
//     14 dígitos ... 10    → CNPJ, vira CPF FALSO formatado no cartão e no Perfil
//      0 dígitos ...  4    → vira "•••.000.000-••", INVENTA um documento
// Alcançabilidade provavelmente nula hoje: o cadastro do app casa por CPF, então essas
// contas dificilmente existem no app. NÃO foi confirmado. Antes de gastar patch, conferir
// se algum desses 14 consegue chegar a app_acesso='liberado'.

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ═══ MÁSCARAS DE DIGITAÇÃO ═══
// 26/08/2026. Diferentes de `formatCPF`: aquela é para EXIBIR um valor completo e faz
// `padStart`, o que num campo de digitação transformaria "1" em "000.000.000-01". Estas
// formatam PARCIALMENTE, conforme a pessoa digita.
//
// ⚠️ Só afetam o que aparece na tela. `/api/public/app-cadastro` e `/api/public/app-login`
// aceitam `min(11).max(18)` e normalizam no servidor, então o valor mascarado trafega sem
// problema — foi conferido antes de aplicar.

/** 000.000.000-00, parcial. */
export function mascaraCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * (00) 00000-0000, parcial. Trata celular (11 dígitos) e fixo (10).
 *
 * ⚠️ Com 10 dígitos o corte é 4+4, com 11 é 5+4. Fixar em 5+4 sempre exibiria
 * "(11) 3456-789" como "(11) 34567-89" enquanto a pessoa digita um fixo.
 */
export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const corte = d.length > 10 ? 7 : 6;
  if (d.length <= corte) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

/** DD/MM/AAAA, parcial. */
export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
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
