# Sessão 31/07/2026 — SPRINT B: auth por CPF+senha e dados reais

## O que foi feito

O app saiu do mock. Duas frentes, dois repos:

**`erp-dimplus` v0.207.0** (exceção autorizada ao "1 conversa = 1 repo" — arquivo novo, sem
conflito com a frente de repaginação):
- `src/lib/telefone.ts` — **fonte única** de `paraE164`. Havia três cópias da mesma regra e
  duas já divergiram (falso positivo de `telefone_divergente`, v0.206.1). Commit de refactor
  separado do de feature (Tidy First).
- `POST /api/public/app-login` — CPF + senha → resolve telefone server-side → tokens.

**`dimplus-app` v0.3.0:**
- `src/lib/supabase.ts` (cliente único, AsyncStorage), `src/lib/auth.ts` (cadastro/login/sair),
  `src/components/Campo.tsx`.
- `(auth)/login.tsx` · `(auth)/cadastro.tsx` · `(auth)/aguardando.tsx` · `(auth)/_layout.tsx`.
- `data.ts` com queries reais; `session.tsx` com máquina de 4 estados; `_layout.tsx` roteando.
- `dev.tsx` **removido**.

## Decisões tomadas (e por quê)

| Decisão | Razão |
|---|---|
| Login por **CPF**, não telefone | A rota de cadastro promete "entre com seu CPF". Pedir telefone no login contradiria a própria mensagem e viraria ligação pra recepção. |
| A rota de login mora no **erp**, não no app | Traduzir CPF→telefone exige ler `clientes`, e o RLS não devolve nada sem sessão. É server-side por necessidade. |
| Login **não** é oráculo de enumeração | Só passa quem sabe a senha. CPF inexistente, CPF sem conta e senha errada devolvem o MESMO 401. A rota nunca ecoa o telefone resolvido. |
| Resolver telefone pela **solicitação** antes do cadastro | O `auth.users` nasceu com o telefone DIGITADO no cadastro, que pode divergir do cadastro antigo. Resolver pelo `clientes` faria quem tem divergência levar "senha inválida" com a senha certa. |
| Conta inerte **loga** | Negar a sessão esconderia do beneficiário o próprio status. Quem decide o que ele vê é o RLS. |
| `getRede()` **segue mock** | Não existe tabela de parceiros. Criar uma sem CRUD no ERP pariria tabela órfã (inserir farmácia por SQL). O par certo é `tabela + tela + policy`, lote do erp. |
| `validade` → `proximo_vencimento` | Não existe coluna de validade. Só há `subscription_next_due`, que é outra coisa. Pintar um de outro mentiria no cartão. |
| Painel de dev removido | Simulava o gate quando não havia sessão. Com RLS real, forçar estado mentiria sobre o que o banco devolve. |

## Pegadinhas descobertas

- **`NextResponse` reutilizado no escopo do módulo quebra em silêncio.** A constante `FALHA`
  carrega um body stream de uso único: o segundo request do mesmo container receberia body já
  consumido. Virou função `falha()`. Pego no review, não no build.
- **`AsyncStorage` no web é `localStorage`, e o `expo export --platform web` roda no Node**,
  onde `window` não existe. O Supabase lê o storage assim que é criado → o build quebrava com
  `ReferenceError: window is not defined` antes de qualquer tela renderizar. Storage em memória
  no web resolve (o preview web não precisa de sessão persistida).
- **`useSegments()` é tipado como tupla de 1 elemento** em alguns casos; ler `segments[1]`
  não compila. Lê-se como `string[]`.
- **README apontava `exposdk:57.0.0` num projeto SDK 54.** Corrigido.

## Estado atual

`erp-dimplus` v0.207.0 (`75216e5`) e `dimplus-app` v0.3.0 (`b15db91`), ambos na `main`.
`tsc --noEmit` verde nos dois; `next build` verde no erp; `expo export --platform web` verde
no app. **Nada provado no aparelho ainda** — ver checklist.

## Dívidas abertas (não pioradas, não resolvidas)

1. **Reset de senha sem caminho automático.** A tela de login diz a verdade ("fale com a
   central") em vez de oferecer um formulário que só gera fila.
2. **Rede parceira mock.** Rodapé "rede em expansão" na tela.
3. Rate-limit em memória nas duas rotas públicas (serverless reinicia) — best-effort.
4. `agendamento`/`exames` seguem `ativo=false` por design.

## O que NÃO foi tocado

`gate.ts` (verificado por `git diff --stat`: vazio), policies da FASE 0, `fn_cliente_pode`,
`fn_cliente_adimplente`, `runtimeVersion.policy`, versão do SDK, middleware, e nada da frente
de repaginação do ERP.

## Checklist de validação (Expo Go no aparelho — preview web NÃO prova nada)

1. Abrir o app deslogado → cai na tela de **login**.
2. "Criar meu acesso" → cadastro com CPF de cliente real → mensagem neutra de recebido.
3. Solicitação aparece em `/dashboard/app` → Solicitações com **Conta: senha criada**.
4. Logar com esse CPF+senha → cai em **"Quase lá"** (aguardando), não em erro.
5. Aprovar no ERP → tocar **"Verificar de novo"** → entra nas tabs com dado real.
6. Cartão: nome, CPF mascarado, plano, "PRÓX. VENCIMENTO" (some se não houver assinatura).
7. Financeiro: faturas reais. Com um **dependente**, deve mostrar "Cobrança no titular".
8. Fechar e reabrir o app → **continua logado** (persistência de sessão).
9. Perfil → **Sair** → volta pro login.
10. Login com CPF inexistente e com senha errada → **mesma** mensagem, indistinguível.

---

## Prompt de retomada

```
v0.3.0 (dimplus-app) · backend em erp-dimplus v0.207.0 · commit b15db91
Contexto: dimplus-app (dmgocupacional/dimplus-app), branch main.
(NÃO confie em hash escrito aqui — rode `git log --oneline -5`.)

⚠️ FRENTE PARALELA: existe outra conversa no repo erp-dimplus (repaginação). Repos diferentes.
NÃO commitar em erp-dimplus a partir daqui — a exceção da SPRINT B (rota /api/public/app-login)
já foi consumida e está fechada.

Ler antes de agir:
- README.md do dimplus-app (seção "Como a sessão decide a tela")
- docs/sessions/2026-07-31-sprint-b-auth.md (este arquivo)
- src/state/session.tsx (a máquina de 4 estados) e src/app/_layout.tsx (quem navega)
- src/lib/data.ts (o contrato) e src/lib/auth.ts
- erp-dimplus/docs/ROADMAP-APP.md — seção "1b-provisória"

Contexto: o app está em v0.3.0 com auth real (CPF + senha, sem OTP) e dados vindos do
Supabase pelo RLS da FASE 0. As telas de login, cadastro e "aguardando aprovação" existem.
Falta VALIDAR no Expo Go — nada foi provado no aparelho (checklist de 10 itens neste doc).

Decisões que constrangem a implementação:
- O gate mora no BANCO (fn_cliente_pode). gate.ts é stub de UI. NÃO replicar regra nova.
- Conta inerte LOGA e não enxerga nada. Estado 'aguardando' é NORMAL, nunca erro.
- Mensagens de login/cadastro são vagas de propósito. NÃO detalhar ("CPF não encontrado" etc.)
  — reabriria a enumeração de CPF pelo lado do cliente.
- Só o _layout raiz navega por estado de sessão. Telas NÃO empurram rota depois de logar.
- Telefone SEMPRE em E.164, com a MESMA normalização dos dois lados (paraE164).
- Senha: mínimo 8, teto 72 (bcrypt; acima o Supabase trunca calado).
- getRede() é mock declarado: não existe tabela de parceiros. Não inventar uma sem o CRUD.
- Não existe coluna de "validade": usar subscription_next_due, e sumir quando NULL.
- Escopo B2C/CPF. Sem CNPJ, sem Receita/BrasilAPI.

Dívidas conhecidas (não resolver, só não piorar):
- "Esqueci minha senha" sem saída automática — a tela de login diz a verdade.
- Rede parceira mock; agendamento/exames com ativo=false por design.

Pegadinhas do repo (custaram caro, não repetir):
- SDK 54 é TETO — o Expo Go do iPhone do Henrique não passa disso. Não subir.
- runtimeVersion.policy = "sdkVersion". Trocar quebra o Expo Go em SILÊNCIO.
- AsyncStorage no web é localStorage e o export web roda no Node: sem o storage em memória
  de src/lib/supabase.ts, o build quebra com "window is not defined".
- NextResponse no escopo do módulo tem body stream de uso único — no erp, use função.
- Preview web NÃO prova que o app funciona. Validação real é Expo Go no aparelho.
- Push na main → GitHub Actions → EAS Update → aparece no Expo Go em ~2min.

Bump obrigatório nos TRÊS lugares no mesmo commit:
src/lib/version.ts (APP_VERSION + APP_VERSION_DATA) + package.json + app.json.
NÃO tocar: policies da FASE 0, fn_cliente_pode, gate.ts, runtimeVersion, versão do SDK.
```
