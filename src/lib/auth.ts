// ═══ BLOCO: AUTENTICAÇÃO ═══
//
// O Supabase Auth NÃO loga por CPF. A identidade real é um EMAIL SINTÉTICO derivado do CPF,
// que o ERP monta em `/api/public/app-login` — o app nunca vê nem precisa saber. Era o TELEFONE
// até 31/07/2026; mudou porque o phone provider do Supabase está desligado e habilitá-lo exigiria
// contratar SMS. Provado em produção: login por telefone respondia `phone_provider_disabled`
// ANTES de olhar a senha, então nenhuma senha jamais funcionaria.
//
// O app manda CPF + senha e recebe só os tokens, que injeta no cliente Supabase. Essa fronteira
// é o motivo de a troca de identidade NÃO ter mexido em nenhuma tela.
//
// 🔒 AS DUAS ROTAS SÃO DELIBERADAMENTE MUDAS. O cadastro responde sempre a mesma coisa; o
// login responde sempre o mesmo erro. NÃO inventar mensagem específica aqui ("CPF não
// encontrado", "telefone já cadastrado", "essa conta ainda não foi aprovada") — isso
// reconstruiria pelo lado do app o oráculo de enumeração de CPF que as rotas existem para
// não ser. Se a mensagem parecer vaga demais para o usuário, ela está certa.

import { supabase, API_BASE } from './supabase';

/**
 * Telefone → E.164 (+55DDDNNNNNNNN), ou null.
 * ⚠️ MESMA regra do `paraE164` do erp-dimplus (`src/lib/telefone.ts`). Ela existe aqui só
 * para barrar formato inválido ANTES do POST e evitar um 400 que o usuário não entenderia —
 * a normalização que VALE é sempre a do servidor. Se a do erp mudar, esta muda junto.
 *
 * O telefone deixou de ser credencial em 31/07, mas continua sendo enviado no cadastro: é dado
 * de negócio (contato, e conferência do staff na hora de aprovar). Não remover.
 */
export function paraE164(v: string): string | null {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `+55${d}`;
}

export function cpfValido(v: string): boolean {
  return v.replace(/\D/g, '').length === 11;
}

/**
 * Forma de e-mail, não existência. Deliberadamente FROUXO: a validação que vale é a do Zod na
 * rota, e uma regex apertada aqui recusaria endereços válidos (TLD longo, `+` no local part)
 * antes mesmo de o servidor ver. Serve só para não gastar uma ida ao servidor com typo óbvio.
 */
export function emailValido(v: string): boolean {
  const t = v.trim();
  return t.length >= 5 && t.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

/** Mínimo 8; teto 72 porque acima disso o bcrypt do Supabase trunca em silêncio. */
export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

// ─── Cadastro ───────────────────────────────────────────────────────────────
// ═══ TERMO DO AUTO-CADASTRO ═══
// 26/08/2026. O termo aparece ANTES de enviar a solicitação. Isso só é possível porque o
// auto-cadastro é SEMPRE DIM+ Básico Plus — o plano é conhecido aqui, então o texto carrega
// preço, fidelidade e multa. Rota pública: nesse momento ainda não existe sessão.
export type TermoCadastro = {
  disponivel: boolean;
  termo?: { id: string; versao: string; texto: string };
  plano?: { nome: string; valor_mensal: number; valor_adesao: number; limite_dependentes: number };
};

export async function buscarTermoCadastro(): Promise<TermoCadastro | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/public/app-termo-cadastro`);
    if (!resp.ok) return null;
    return (await resp.json()) as TermoCadastro;
  } catch {
    // null = desconhecido. NÃO devolver `{disponivel:false}`: falha de rede viraria "não há
    // termo" e a tela deixaria a pessoa se cadastrar sem aceitar nada.
    return null;
  }
}

// ═══ CONSULTA DE CEP ═══
// 26/08/2026. Passa pelo erp e não direto no ViaCEP: o app é binário congelado na loja, e
// trocar de provedor exigiria nova submissão. O servidor já cai para o BrasilAPI sozinho.
export type EnderecoCEP = {
  encontrado: boolean;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export async function consultarCEP(cep: string): Promise<EnderecoCEP> {
  try {
    const resp = await fetch(`${API_BASE}/api/public/cep?cep=${cep.replace(/\D/g, '')}`);
    if (!resp.ok) return { encontrado: false };
    return (await resp.json()) as EnderecoCEP;
  } catch {
    // Rede fora: a tela deixa preencher na mão. CEP não pode travar uma adesão.
    return { encontrado: false };
  }
}

export async function solicitarCadastro(dados: {
  cpf: string;
  telefone: string;
  nome: string;
  senha: string;
  // 10/09/2026 — e-mail REAL, canal do link de recuperação de senha. Opcional aqui porque é
  // opcional na rota; o ERP grava em `clientes.email` e nunca sobrescreve o de um cadastro
  // que já existia. Sem ele a pessoa depende da equipe para recuperar acesso.
  email?: string;
  // 26/08 — prova de identidade do pré-cadastrado. Batendo com o cadastro, entra sem fila.
  data_nascimento?: string;
  // Aceite capturado nesta tela, junto com vencimento e forma.
  termo_versao_id?: string;
  aceite?: boolean;
  dia_vencimento?: 10 | 20 | 30;
  forma_pagamento?: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  // Endereço obrigatório: o Asaas exige CEP e número para cobrar no cartão.
  endereco_cep: string;
  endereco_numero: string;
  endereco_logradouro: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_complemento?: string;
}): Promise<Resultado> {
  try {
    const resp = await fetch(`${API_BASE}/api/public/app-cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dados, website: '' }), // honeypot vazio: somos humanos
    });
    const json = (await resp.json()) as { ok?: boolean; mensagem?: string; error?: string };
    if (!resp.ok) return { ok: false, erro: json.error ?? 'Não foi possível enviar agora.' };
    return { ok: true, mensagem: json.mensagem };
  } catch {
    return { ok: false, erro: 'Sem conexão. Verifique a internet e tente de novo.' };
  }
}

// ─── Recuperação de acesso ──────────────────────────────────────────────────
// 10/09/2026. Substitui a dívida datada: até aqui não havia "esqueci minha senha" e a troca
// era feita à mão pela equipe.
//
// 🔒 A RESPOSTA DO ERP É NEUTRA e esta função NÃO tenta melhorá-la. Ela devolve a mesma
// mensagem havendo conta ou não, tendo e-mail cadastrado ou não. Distinguir os casos daria ao
// app um oráculo de quem é cliente da DIM+ — o mesmo que o cadastro e o login evitam.
export async function recuperarAcesso(dados: {
  cpf: string;
  // 10/09/2026 — os três servem SÓ a quem ainda não tem e-mail cadastrado. Quem já tem canal
  // recebe no e-mail antigo e estes campos são IGNORADOS pelo servidor: e-mail de quem já tem
  // nunca é trocado por esta rota, senão bastaria saber um CPF para sequestrar a conta.
  email?: string;
  data_nascimento?: string;
  telefone?: string;
}): Promise<Resultado> {
  try {
    const resp = await fetch(`${API_BASE}/api/public/app-recuperar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const json = (await resp.json()) as { ok?: boolean; mensagem?: string; error?: string };
    if (!resp.ok) return { ok: false, erro: json.error ?? 'Não foi possível enviar agora.' };
    return { ok: true, mensagem: json.mensagem };
  } catch {
    return { ok: false, erro: 'Sem conexão. Verifique a internet e tente de novo.' };
  }
}

// ─── Login ──────────────────────────────────────────────────────────────────
export async function entrar(cpf: string, senha: string): Promise<Resultado> {
  try {
    const resp = await fetch(`${API_BASE}/api/public/app-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, senha }),
    });
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };
    if (!resp.ok || !json.access_token || !json.refresh_token) {
      return { ok: false, erro: json.error ?? 'CPF ou senha inválidos.' };
    }
    // `setSession` grava no AsyncStorage e liga o auto-refresh. A partir daqui o RLS passa a
    // valer — inclusive para devolver NADA, se a conta ainda não foi aprovada.
    const { error } = await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });
    if (error) return { ok: false, erro: 'Não foi possível iniciar a sessão.' };
    return { ok: true };
  } catch {
    return { ok: false, erro: 'Sem conexão. Verifique a internet e tente de novo.' };
  }
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut();
}
// ── FIM BLOCO ──
