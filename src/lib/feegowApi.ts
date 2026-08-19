// ═══ BLOCO: FEEGOW API — HELPER HTTP AUTENTICADO ═══
//
// S2-L1. Primeira chamada autenticada que o app faz ao erp-dimplus. Até aqui o app só
// falava com o Supabase direto (`src/lib/data.ts`) e com duas rotas PÚBLICAS sem header
// (`src/lib/auth.ts`). As rotas `/api/feegow/*` exigem sessão de CLIENTE — este arquivo é
// o único lugar que sabe como pedir o token e montar o header.
//
// De onde vem o token: `supabase.auth.getSession()` chamado AQUI, na hora da requisição —
// não em `session.tsx`. O SDK devolve o token já renovado (autoRefreshToken:true em
// `supabase.ts`), e assim não duplicamos fonte de verdade nem mexemos num arquivo sensível
// ao ciclo de sessão. NUNCA criar um segundo cliente Supabase — quebraria o refresh do
// cliente único (ver cabeçalho de `supabase.ts`).
//
// Contrato de erro do lado do erp (`app-feegow-guard.ts`): toda resposta de erro é
// `{ error: string }` com um destes status — 401/403/404/307/409/502/500. Mapeamos cada
// um para um `tipo` que a tela consome sem precisar saber o número do status:
//
//   'sem_sessao'        → 307: faltou o header Authorization (não deveria acontecer em uso
//                          normal — só se chamarmos o helper sem sessão local).
//   'nao_autenticado'   → 401: token ausente/expirado. Renovar é responsabilidade DO APP —
//                          o erp não tem onde gravar um token novo sem cookie.
//   'modulo_desativado' → 403: flag do módulo desligada pra este cliente.
//   'nao_encontrado'    → 404: caso REAL (ex.: "CPF sem cadastro na clínica"), não é bug.
//   'conflito'          → 409: pré-condição de dado ausente (ex.: cadastro sem CPF).
//   'indisponivel'      → 502: a Feegow (terceiro) não respondeu.
//   'erro_servidor'     → 500 ou qualquer status 5xx não mapeado.
//   'rede'              → fetch nunca completou (sem internet, timeout, etc.).
//
// `paciente_id` NUNCA é parâmetro deste helper nem de quem o chama — o erp deriva do CPF
// do logado. Não adicionar esse campo aqui.

import { supabase, API_BASE } from './supabase';

export type FeegowErroTipo =
  | 'sem_sessao'
  | 'nao_autenticado'
  | 'modulo_desativado'
  | 'nao_encontrado'
  | 'conflito'
  | 'indisponivel'
  | 'erro_servidor'
  | 'rede';

export type FeegowResultado<T> =
  | { ok: true; dados: T }
  | { ok: false; tipo: FeegowErroTipo; mensagem: string; status?: number };

function tipoPorStatus(status: number): FeegowErroTipo {
  if (status === 307) return 'sem_sessao';
  if (status === 401) return 'nao_autenticado';
  if (status === 403) return 'modulo_desativado';
  if (status === 404) return 'nao_encontrado';
  if (status === 409) return 'conflito';
  if (status === 502) return 'indisponivel';
  return 'erro_servidor';
}

type Opcoes = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

/**
 * Chama uma rota `/api/feegow/*` do erp-dimplus com o token da sessão atual.
 *
 * `path` começa com `/` (ex.: `/api/feegow/agendamento/opcoes`).
 *
 * ⚠️ `redirect: 'manual'` é necessário: sem isto, o `fetch` do RN segue o 307 do
 * `middleware.ts` (protege `/api` fora de `publicApiRoutes`) e a resposta final vira a
 * página de login em vez do 307 — perderíamos justamente o sinal que precisamos tratar.
 */
export async function chamarFeegow<T>(path: string, opcoes: Opcoes = {}): Promise<FeegowResultado<T>> {
  const { data, error: eSessao } = await supabase.auth.getSession();
  if (eSessao || !data.session) {
    // Sem sessão local: nem vale chamar o erp — é o mesmo estado que o 307 representaria.
    return { ok: false, tipo: 'sem_sessao', mensagem: 'Sessão não encontrada. Faça login novamente.' };
  }
  const token = data.session.access_token;

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, {
      method: opcoes.method ?? 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(opcoes.body ? { body: JSON.stringify(opcoes.body) } : {}),
    });
  } catch {
    return { ok: false, tipo: 'rede', mensagem: 'Sem conexão. Verifique a internet e tente de novo.' };
  }

  // `redirect: 'manual'` tem semântica de "opaque redirect" (`type: 'opaqueredirect'`,
  // `status: 0`) definida para fetch de BROWSER, por causa de CORS — não é garantido que o
  // fetch do React Native se comporte igual, porque RN não tem esse modelo de segurança.
  // Por isso tratamos os dois formatos possíveis: o opaco (browser/web preview) e o 307 cru
  // (mais provável no device). Não assumir qual vai aparecer sem prova ao vivo.
  if (resp.type === 'opaqueredirect' || resp.status === 0 || resp.status === 307) {
    return { ok: false, tipo: 'sem_sessao', mensagem: 'Sessão não encontrada. Faça login novamente.' };
  }

  if (!resp.ok) {
    let mensagem = 'Não foi possível completar a operação.';
    try {
      const json = (await resp.json()) as { error?: string };
      if (json.error) mensagem = json.error;
    } catch {
      // Corpo não é JSON (ex.: página de erro HTML) — mantém a mensagem padrão.
    }
    return { ok: false, tipo: tipoPorStatus(resp.status), mensagem, status: resp.status };
  }

  const dados = (await resp.json()) as T;
  return { ok: true, dados };
}
// ── FIM BLOCO ──
