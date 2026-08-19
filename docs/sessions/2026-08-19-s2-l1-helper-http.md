# S2-L1 — Helper HTTP autenticado (19/08/2026)

## O que foi feito

Criado `src/lib/feegowApi.ts` — primeira chamada autenticada do app ao `erp-dimplus`.
Antes deste lote: zero ocorrências de `Bearer`/`Authorization` em `src/` (confirmado por
grep antes de começar).

- `chamarFeegow<T>(path, opcoes)`: pega token via `supabase.auth.getSession()` na hora da
  chamada (não mexe em `session.tsx`, não cria segundo cliente Supabase).
- Mapeia status HTTP → `FeegowErroTipo`: `sem_sessao` (307) · `nao_autenticado` (401) ·
  `modulo_desativado` (403) · `nao_encontrado` (404) · `conflito` (409) ·
  `indisponivel` (502) · `erro_servidor` (5xx) · `rede` (fetch falhou).
- `redirect: 'manual'` na chamada, com checagem de **ambos** os formatos possíveis de
  redirect (307 cru OU `type: 'opaqueredirect'`) — não assumimos qual o RN devolve sem
  provar.

## Estado atual

Provado ao vivo (Node, contra `https://erp-dimplus.vercel.app`, conta de teste CPF
`55566677720`), script em `/tmp/smoke.mjs` (não versionado):

- `opcoes` com token válido → `200`, dado real da Feegow (especialidades).
- `opcoes` sem token → `307`, `type: 'basic'` (**não** opaco — confirma que a checagem de
  status 307 direto era necessária, não só o `opaqueredirect`).
- `opcoes` com token inválido → `401`, `{"error":"não autenticado"}`.
- `exames/pedidos` com token válido → `404`, `{"error":"CPF sem cadastro na clínica."}`
  (caso real, mapeado para `nao_encontrado`).

`403` (módulo desativado) **não foi exercitado ao vivo** neste lote — as flags
`agendamento`/`exames` estão `ativo=true` em produção, então não há como provocar 403 sem
desligar a flag. O mapeamento existe e está coberto por `tipoPorStatus`, mas fica como
lacuna de prova até algum lote futuro testar com flag desligada (ou teste unitário mockado).

⚠️ O smoke test rodou em **Node** (`fetch` do undici), não no device/RN. `type: 'basic'`
no redirect manual é o comportamento do Node — o comentário no código já registra que não
se pode assumir que o RN se comporte igual; o código trata os dois casos, mas o
comportamento real do RN **ainda não foi observado**.

tsc --noEmit: verde. `expo export --platform web`: verde (18 rotas, sem erro).

## Decisões tomadas

- Token buscado no momento da chamada (`getSession()` dentro do helper), não guardado em
  `session.tsx` — opção (A) do doc, evita duplicar fonte de verdade da sessão.
- `redirect: 'manual'` tratando dois formatos de resposta, por não confiar em suposição
  sobre fetch do React Native vs. browser vs. Node.
- Nenhuma tela criada. Este lote fecha só o helper.

## Próximos passos

- S2-L2 — tela de exames (leitura pura), primeiro consumidor real do helper, inclusive o
  caso 404 já provado aqui.
- Ao rodar no device/simulador pela primeira vez (não só Node), confirmar se `resp.type`
  vem `'basic'` ou `'opaqueredirect'` no cenário sem-token — anotar aqui se divergir do
  Node.

## Pegadinhas descobertas

- `redirect: 'manual'` **não** é garantidamente opaco fora de browser — no Node (undici) o
  307 vem cru, com `type: 'basic'`. Não generalizar comportamento de fetch entre runtimes
  sem testar.
