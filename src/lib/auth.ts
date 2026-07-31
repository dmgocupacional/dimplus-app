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

/** Mínimo 8; teto 72 porque acima disso o bcrypt do Supabase trunca em silêncio. */
export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

// ─── Cadastro ───────────────────────────────────────────────────────────────
export async function solicitarCadastro(dados: {
  cpf: string;
  telefone: string;
  nome: string;
  senha: string;
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
