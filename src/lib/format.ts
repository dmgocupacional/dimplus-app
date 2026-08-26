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

/**
 * DD/MM/AAAA digitado → AAAA-MM-DD, ou null se não for data REAL.
 *
 * 🔴 Regex de formato NÃO basta: `31/02/2020` e `99/99/9999` passam por qualquer
 * `\d{2}/\d{2}/\d{4}`. A conferência é por reconstrução — monta a data em UTC e checa se os
 * três componentes sobreviveram. Fevereiro 31 vira 2 de março e os componentes não batem.
 *
 * ⚠️ UTC de propósito. `new Date(1990, 4, 10)` usa fuso local e, em runtime com TZ ≠ Brasília,
 * devolveria o dia anterior — o mesmo problema de fuso que já mordeu em datas-cobranca.
 *
 * Limites espelham o CHECK `clientes_data_nascimento_sanidade`: depois de 1900-01-01 e antes
 * de hoje. Manter alinhado — divergir aqui produz 500 opaco em vez de erro explicado.
 */
export function dataParaISO(v: string): string | null {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dt.getUTCFullYear() !== ano ||
    dt.getUTCMonth() !== mes - 1 ||
    dt.getUTCDate() !== dia
  ) {
    return null;
  }
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (dt.getTime() >= hojeUTC) return null;
  if (ano < 1900) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
