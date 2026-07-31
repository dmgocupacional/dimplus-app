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

## Prova de comportamento em produção (31/07, pós-deploy)

Feita contra `erp-dimplus.vercel.app` e o PostgREST de produção. Read-only: **nada foi escrito.**

**Neutralidade do login — provada.** Quatro casos, resposta byte a byte idêntica
(`{"error":"CPF ou senha inválidos."}`, HTTP 401): CPF que existe e tem conta com senha errada ·
CPF inexistente · CPF mal formado · payload sem senha.

**Canal lateral de tempo — investigado e descartado.** A primeira medição deu 0,6s para CPF
existente contra 5,9s para inexistente, o que pareceria oráculo por relógio: o CPF sem
solicitação cai no fallback que varre `clientes` inteira. Hipótese testada em 3 rodadas com o
container quente e **refutada** — 0,35–0,88s nos dois casos, com o inexistente às vezes mais
rápido. Os 5,9s eram cold start.
⚠️ Não é garantia permanente: o fallback é O(n) sobre `clientes` e o caminho do CPF resolvível
paga bcrypt. Hoje o ruído de rede cobre a diferença. **Se a base crescer muito, remedir.**

**Queries do `data.ts` — validadas contra o schema real.** As três (`clientes` com o embed
`planos:plano_id(nome)`, `pagamentos`, `app_features`) responderam **200 com lista vazia** usando
só a chave anon. Isso prova duas coisas ao mesmo tempo: coluna inexistente ou relação inválida
dariam **400** no parse, antes do RLS — então nenhuma coluna foi inventada; e o RLS está
**fechado para anônimo**, sem vazar linha alguma sem sessão.

**Forma do embed.** `clientes_plano_id_fkey` é FK many-to-one para `planos`, logo o PostgREST
devolve **objeto**, não array. A normalização defensiva em `getCliente` cobre os dois casos —
fica como está, custa nada e sobrevive a uma FK que mude de cardinalidade.

**Ainda NÃO provado (exige escrita, não autorizada nesta sessão):** o caminho feliz do login,
isto é, uma conta com senha conhecida entrando e o RLS devolvendo dado. Depende de criar
cadastro de teste ou trocar a senha de uma conta existente.

**Achado de estado:** a linha de teste da sessão de 31/07 (`TESTE CLAUDE B`, CPF `00000000191`)
segue **pendente** na fila, com conta criada. Conforme o handoff anterior previu, isso significa
que a recusa nunca foi exercitada na tela — a metade da mecânica que o container não prova.

## 🔴 BLOQUEADOR ENCONTRADO NA PROVA — `phone_provider_disabled`

**O login por telefone está DESLIGADO no projeto Supabase.** Descoberto ao provar o caminho
feliz, que nunca tinha sido executado ponta a ponta (o checklist da sessão anterior tinha esse
item; ficou por fazer).

Resposta crua do GoTrue para `POST /auth/v1/token?grant_type=password` com telefone e senha
corretos:

```
{"code":422,"error_code":"phone_provider_disabled","msg":"Phone logins are disabled"}
```

**Por que isso passou despercebido até agora:** `admin.createUser({ phone, password,
phone_confirm: true })` usa a API de administração, que **bypassa a configuração de providers**.
A conta é criada com sucesso, aparece na fila, tudo parece certo. O login NÃO bypassa — ele passa
pelo GoTrue normal, que recusa **antes de sequer olhar a senha**. Ou seja: a metade que escreve
funciona e a metade que lê não, e nada no build acusa.

Isto **não é bug do código da SPRINT B**. A rota `/api/public/app-login` e o app estão corretos;
eles não teriam como funcionar contra um provider desligado. É um bloqueador da **FASE 1b inteira**,
que assume `signInWithPassword({ phone })` como mecânica de entrada.

### Ação necessária (não dá para fazer por código)

Dashboard → **Authentication → Sign In / Providers → Phone** → habilitar.
`api.supabase.com` está bloqueado no container e config de Auth não sai por SQL, então isto é
manual por necessidade, não por preguiça.

**Não é preciso contratar SMS.** A doc do Supabase condiciona o SMS provider a *confirmar* o
telefone no signup — e a confirmação aqui já vem do `phone_confirm: true`. Login por telefone +
senha é recurso distinto do OTP.

⚠️ **Ao habilitar, conferir se o SIGNUP público por telefone fica fechado.** Habilitar o provider
pode abrir `POST /auth/v1/signup` com telefone para qualquer um com a chave anon. Não seria
vazamento (as contas nasceriam inertes e o RLS não devolve nada), mas encheria `auth.users` de
lixo e ruído. Queremos **login ligado, signup público desligado** — quem cria conta é a rota de
cadastro, via admin.

**Se o Supabase exigir SMS provider mesmo assim**, o plano B é trocar a identidade de telefone
para um **email sintético derivado do CPF** (ex.: `{cpf}@app.dimplus.invalid`), invisível para o
usuário. Isso funciona sem provider nenhum, mas muda uma premissa da FASE 0 e **exige decisão do
Henrique** — não implementar por conta própria.

### Estado de teste deixado na base (LIMPAR)

Para provar o caminho feliz foi criado um cadastro de teste que **ficou incompleto** por causa do
bloqueador acima:

- `app_acesso_solicitacoes`: CPF `52998224725`, `TESTE QA SPRINT B`, telefone `+5511999990002`
- `auth.users`: conta com esse telefone

Nenhum cliente real foi tocado: 777 clientes, 0 vinculados, 0 liberados, 80 pagamentos órfãos e a
sequência de carteirinha em 78320 — **tudo igual a antes**. Antes de inserir qualquer coisa foram
lidos os triggers de `clientes`: `fn_adota_pagamentos_orfaos` retorna cedo quando `asaas_id` é
NULL, e `fn_atribui_carteirinha` retorna cedo quando o número já vem preenchido. Por isso o
cliente de teste nem chegou a ser criado.

## ✅ PLANO B PROVADO PONTA A PONTA (31/07, com service role)

O Henrique não tem provider de SMS, então habilitar o phone provider está fora. O plano B —
**identidade = email sintético derivado do CPF** — foi provado inteiro contra produção antes de
uma linha de código ser escrita:

| # | Passo | Resultado |
|---|---|---|
| 1 | `admin.createUser` com email sintético + `email_confirm: true` | ✅ conta criada, **nenhum email enviado** |
| 2 | `POST /token?grant_type=password` com email + senha | ✅ **login passou** (o que era impossível com telefone) |
| 3 | Sessão válida com `clientes.user_id` NULL | ✅ RLS devolve `[]` — conta inerte funciona |
| 4 | Cliente vinculado + `app_acesso='liberado'` | ✅ RLS devolve **1 linha de 778** |
| 5 | `app_features` com sessão | ✅ 8 módulos |
| 6 | `pagamentos` sem vínculo | ✅ `[]` |

**A validação de domínio é do signup PÚBLICO, não do admin.** Quatro domínios foram testados
pelo caminho admin — inclusive `app.dimeg.com.br` (que o signup público rejeitava) e
`dimplus.local` (que nem é TLD válido) — e **todos passaram**. O admin bypassa a validação pelo
mesmo motivo que bypassa a config de providers. Logo o domínio é escolha de desenho, não
restrição técnica.

**O embed `planos` vem como OBJETO**, confirmado com sessão real: `"planos": {"nome": "DIM+
Saúde"}`. A normalização defensiva de `getCliente` estava certa; fica como está.

**Achado colateral:** `sos` está `ativo=true` no banco. O mock da 1c tinha `false`. Não é bug —
é a realidade do banco, e a tela vai mostrar SOS ligado.

### Por que isto é melhor que um remendo

O email sintético é determinístico a partir do CPF, então **o login deixa de precisar resolver
CPF → telefone consultando o banco**. Some junto toda a fragilidade dessa resolução: a ordem
"solicitação antes de cliente", o caso de CPF duplicado, o telefone divergente. E no cadastro, a
busca por conta existente passa a ter **filtro server-side por email** — o que elimina o laço de
páginas do `listUsers`, que era pegadinha documentada (paginava, não filtrava por telefone, e um
falso-negativo fazia o cadastro sumir calado).

**O telefone não some**: continua em `clientes.telefone` e na solicitação, como dado de negócio.
Só deixa de ser credencial.

⚠️ **Isto adia a dependência de SMS, não elimina.** Quando a WABA sair, plugar OTP por telefone
vai exigir `updateUser({ phone })`, que exige SMS provider configurado.

**Custo de migração: zero.** São 0 clientes vinculados e nenhuma conta real. Cada cadastro real
que entrar antes da troca vira conta para migrar depois.

### Estado da base após a prova

Revertida ao exato: **777 clientes · 0 vinculados · 0 liberados · 80 pagamentos órfãos ·
sequência de carteirinha 78320**. Todos os usuários de teste apagados. Sobrou apenas a conta
`+5511999990001` da solicitação `TESTE CLAUDE B`, que é da sessão anterior.
⚠️ **Essa solicitação deve ser RECUSADA, não aprovada** — a conta dela é phone-based e não
conseguirá logar no desenho novo.

### Efeito colateral do teste (registrado por honestidade)

Ao sondar a validação de domínio pelo signup público, o rate limit de envio de email do projeto
foi consumido (`over_email_send_rate_limit`). Convites ou resets de senha de staff podem ter
falhado na hora seguinte. Sondagem por signup público não se repete — o caminho admin não
envia email.

## ✅ IMPLEMENTADO E PROVADO PELAS ROTAS REAIS (erp v0.208.0 · app v0.3.1)

O plano B saiu do teste e virou código. Provado **contra as rotas em produção**, não só contra
o mecanismo do Supabase:

| # | Passo | Resultado |
|---|---|---|
| 1 | `POST /api/public/app-cadastro` | ✅ resposta neutra, solicitação na fila, conta criada |
| 2 | `POST /api/public/app-login` | ✅ devolve `access_token`, `refresh_token`, `expires_at` |
| 3 | Senha errada, mesmo CPF | ✅ 401 idêntico ao de CPF inexistente |
| 4 | Sessão sem aprovação | ✅ `clientes` devolve `[]` → app mostra "Quase lá" |
| 5 | `app_features` na mesma sessão | ✅ 8 módulos (não depende de aprovação) |
| 6 | Após vincular + liberar | ✅ **a MESMA sessão** passa a ver 1 linha de 778 |
| 7 | Reversão | ✅ 777 · 0 · 0 · 80 · 0 contas de app |

O item 6 é o que mais importa: **não foi preciso relogar**. Quem estava na tela "Quase lá" e
toca em "Verificar de novo" depois da aprovação entra — que é exatamente o fluxo desenhado.

### O que mudou no código

**`erp-dimplus` v0.208.0** (`8171688`):
- `src/lib/app-identidade.ts` (novo) — `emailDoCpf()`, fonte única. Domínio `app.dimeg.com.br`.
- `app-cadastro/route.ts` — cria com `email` + `email_confirm: true`; busca conta existente com
  **filtro server-side**, eliminando o laço de 40 páginas do `listUsers`.
- `app-login/route.ts` — **`resolverTelefone` deletada**. A chave é derivada, não consultada.

**`dimplus-app` v0.3.1**: só texto. A ajuda do campo telefone dizia "é por ele que a sua conta é
identificada" e virou mentira. Nenhuma tela mudou — é o que a indireção do `auth.ts` comprou.

### ⚠️ Cuidados que ficam

- **NÃO configurar MX em `app.dimeg.com.br`.** O subdomínio é deliberadamente inerte.
- **Trocar o domínio invalida todas as contas.** O email é a chave de login: mudar o sufixo faz o
  login derivar uma chave inexistente. Se um dia precisar, é migração (UPDATE em `auth.users`),
  não troca de constante.
- **Isto adia a dependência de SMS, não elimina.** OTP por telefone no futuro vai exigir
  `updateUser({ phone })`, que exige SMS provider.
- A solicitação `TESTE CLAUDE B` (`+5511999990001`) é **phone-based e não loga** no desenho novo.
  **Recusar, não aprovar.**

### 🔎 Achado colateral: a sequência de carteirinha está sendo queimada sem gerar cliente

`seq_carteirinha_titular` saltou de **78320 para 78668** (348 números) durante a sessão, e no
mesmo período foram criados **zero** clientes — nenhuma carteirinha acima de 78320 existe na
tabela. Não foram os inserts de teste: eles passaram `numero_carteirinha` preenchido, e
`fn_atribui_carteirinha` retorna cedo nesse caso (verificado no código-fonte da função).

Hipótese não confirmada: algum processo de sync tenta inserir clientes que já existem. `nextval`
não é transacional, então o número é consumido mesmo quando o INSERT aborta por conflito.
Não é urgente (a sequência é `int` e há folga), mas é sintoma de sync fazendo trabalho à toa.
**Investigar na frente do ERP**, não aqui.

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
v0.3.1 (dimplus-app) · backend em erp-dimplus v0.208.0
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

✅ RESOLVIDO: a identidade do auth é EMAIL SINTÉTICO do CPF (erp: src/lib/app-identidade.ts),
não telefone. O phone provider do Supabase está desligado e exigiria SMS contratado. Cadastro e
login foram provados ponta a ponta pelas rotas em produção. NÃO reverter para telefone.
Base limpa; nenhum resíduo de teste.

FALTA: validar no Expo Go, no aparelho. Nada foi provado no celular ainda.

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
