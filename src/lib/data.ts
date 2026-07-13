// ═══ BLOCO: CAMADA DE DADOS ═══
//
// FASE 1c = MOCK TOTAL. Nenhuma linha aqui toca o Supabase.
//
// Por quê: sem a FASE 1b (auth CPF+OTP) não existe sessão, logo não existe auth.uid(),
// logo o RLS de cliente construído na FASE 0 não tem como funcionar. A alternativa
// (ler com a chave anon usando um cliente_id fixo) exigiria AFROUXAR uma policy num
// banco que atende cliente pagante — trocaria conveniência de dev por risco em produção.
// Recusado. Decisão do Henrique em 13/07/2026 ("mock a").
//
// O CONTRATO ABAIXO É O CONTRATO REAL. As assinaturas (async, tipos de retorno) são as
// que a versão Supabase vai ter. Quando a 1b entrar, troca-se o CORPO de cada função
// por uma query — e NENHUMA TELA MUDA. É esse o ponto de manter a indireção.

import type { Cliente, Fatura, Modulo, Parceiro } from './types';

const delay = (ms = 260) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Fixtures ───────────────────────────────────────────────────────────────
// Cliente fictício. NÃO usar dado de cliente real aqui — o repo é versionado.

const CLIENTE: Cliente = {
  id: 'mock-cliente-0001',
  nome: 'Mariana S. Oliveira',
  cpf: '12345678901',
  telefone: '11991234567',
  plano: 'DIM+ SAÚDE',
  app_acesso: 'liberado',
  membro_desde: '2024-05-01',
  validade: '2026-05-01',
};

const MODULOS: Modulo[] = [
  { key: 'cartao', nome: 'Cartão digital', ativo: true, exige_pagamento: false },
  { key: 'rede', nome: 'Rede parceira', ativo: true, exige_pagamento: true },
  { key: 'financeiro', nome: 'Financeiro', ativo: true, exige_pagamento: false },
  { key: 'ajuda', nome: 'Ajuda', ativo: true, exige_pagamento: false },
  // Os quatro abaixo nascem desligados no banco — aparecem como "em breve".
  { key: 'agendamento', nome: 'Agendamento', ativo: false, exige_pagamento: true },
  { key: 'exames', nome: 'Meus exames', ativo: false, exige_pagamento: true },
  { key: 'telemedicina', nome: 'Telemedicina', ativo: false, exige_pagamento: true },
  { key: 'sos', nome: 'SOS', ativo: false, exige_pagamento: false },
];

const FATURAS: Fatura[] = [
  {
    id: 'mock-pag-003',
    descricao: 'Mensalidade · Julho/2026',
    valor: 49.9,
    vencimento: '2026-07-20',
    status: 'PENDING',
    link_pagamento: null,
  },
  {
    id: 'mock-pag-002',
    descricao: 'Mensalidade · Junho/2026',
    valor: 49.9,
    vencimento: '2026-06-20',
    status: 'RECEIVED',
    link_pagamento: null,
  },
  {
    id: 'mock-pag-001',
    descricao: 'Mensalidade · Maio/2026',
    valor: 49.9,
    vencimento: '2026-05-20',
    status: 'RECEIVED',
    link_pagamento: null,
  },
];

const PARCEIROS: Parceiro[] = [
  {
    id: 'p1',
    nome: 'Drogaria São Paulo',
    categoria: 'Farmácia',
    beneficio: 'Até 30% em genéricos',
    endereco: 'Av. dos Autonomistas, 1400',
    cidade: 'Osasco',
  },
  {
    id: 'p2',
    nome: 'Droga Raia',
    categoria: 'Farmácia',
    beneficio: 'Até 25% em medicamentos',
    endereco: 'R. Antônio Agu, 210',
    cidade: 'Osasco',
  },
  {
    id: 'p3',
    nome: 'Clínica DMG Ocupacional',
    categoria: 'Clínica',
    beneficio: 'Consulta com valor reduzido',
    endereco: 'R. Narciso Sturlini, 88',
    cidade: 'Osasco',
  },
  {
    id: 'p4',
    nome: 'Laboratório Delboni',
    categoria: 'Laboratório',
    beneficio: 'Exames a partir de R$ 19',
    endereco: 'Av. Hilário Pereira de Souza, 500',
    cidade: 'Osasco',
  },
  {
    id: 'p5',
    nome: 'OdontoCare Itapevi',
    categoria: 'Odontologia',
    beneficio: 'Limpeza + avaliação sem custo',
    endereco: 'Av. Pres. Vargas, 77',
    cidade: 'Itapevi',
  },
];

// ─── Contrato público ───────────────────────────────────────────────────────
// TODO(fase-1b): trocar o corpo destas funções por queries no Supabase.
// As assinaturas NÃO devem mudar.

export async function getCliente(): Promise<Cliente> {
  await delay();
  return CLIENTE;
}

export async function getModulos(): Promise<Modulo[]> {
  await delay();
  return MODULOS;
}

export async function getFaturas(): Promise<Fatura[]> {
  await delay();
  return FATURAS;
}

export async function getRede(): Promise<Parceiro[]> {
  await delay();
  return PARCEIROS;
}
// ── FIM BLOCO ──
