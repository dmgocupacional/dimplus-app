# ROADMAP — Inclusão de dependentes pelo titular

> ⚠️ Este NÃO é o `ROADMAP-APP.md` citado em `src/lib/types.ts`, `src/lib/gate.ts`,
> `src/theme/tokens.ts` e `src/app/(auth)/login.tsx`. Aquele vive em
> **`erp-dimplus/docs/ROADMAP-APP.md`** — não existe cópia neste repo.
>
> 🔴 **A FONTE DE VERDADE de dependentes é o erp-dimplus**, não este arquivo:
> `erp-dimplus/docs/ROADMAP.md` §"Dependentes (titular ↔ dependente) — 20/07/2026 · v0.155.1",
> `erp-dimplus/docs/ROADMAP-APP.md` §"Fronteira ERP × App" e
> `erp-dimplus/docs/sessions/2026-07-20-dependentes.md`.
> Este arquivo é a visão do lado app + o sequenciamento de 17/08. Ao divergir, o erp manda.
> **Revisado contra o erp-dimplus em 17/08/2026** (commit `30f319f`).

Decisões tomadas pelo Henrique em 17/08/2026. Diagnóstico completo em
`docs/sessions/2026-08-17-dependentes-diagnostico.md`.

---

## O QUE JÁ EXISTE (não reconstruir)

A regra de negócio de dependente **já está no banco e com trigger ativo**:

- `fn_dependentes_situacao(titular)` → devolve pronto `limite`, `usados`, `excedentes`,
  `politica`, `valor_excedente`, `pode_adicionar`. **É o contrato da tela.** Não recalcular
  limite no app.
- `trg_valida_limite_dependentes` — barra INSERT quando a política é `barrar`.
- `trg_dependente_herda_status` / `trg_espelha_status_dependentes` — status do titular
  propaga para os dependentes.
- `trg_atribui_carteirinha` — dependente já ganha carteirinha.

Planos reais: **PLUS** (486 clientes) limite 5, política `cobrar`, R$ 29,90 extra ·
**SAG** (21) limite 3, `barrar` · **OZ** (0) limite 3, `barrar`.
**6 titulares já estão exatamente no limite** (3 SAG, 3 PLUS) — o caso de borda é o primeiro
toque do botão, não cenário futuro.

Estado dos 44 dependentes atuais: todos com CPF, **todos sem `plano_id`, zero com `user_id`,
zero com `app_acesso` liberado**. Dependente hoje é registro cadastral: não loga, não tem
assinatura própria.

## OS TRÊS BURACOS

1. **Excedente não cobra ninguém.** Política `cobrar` deixa o trigger passar e nenhuma função
   gera cobrança. Vazamento de receita que **já existe hoje no balcão**, independente do app.
2. **Titular não vê os dependentes.** Única policy de leitura do app é
   `clientes_app_own_select` → `user_id = auth.uid()`; dependente tem `user_id` nulo.
3. **Não há caminho de escrita do app.** Nenhuma policy de INSERT para `authenticated`.

---

## 🔴 CONFLITO COM DECISÃO ANTERIOR — RESOLVER ANTES DA S-A

Em **20/07/2026** (`erp-dimplus/docs/sessions/2026-07-20-dependentes.md`, "Próximos passos"
item 1) ficou decidido que o ajuste da assinatura no Asaas **não se faz sem duas condições**:

1. **chave de sandbox do Asaas** — "só existe a de produção hoje; não dá pra provar
   'sem double-charge' sem mexer em cobrança real de cliente";
2. **gatilho MANUAL com preview — nunca automático no cadastro.**

O registro fecha com: *"erro aqui vira cobrança errada no cartão de um cliente, e isso não
tem `git revert`."*

A decisão de **17/08** (titular insere dependente pelo app → gera avulsa e corrige a
assinatura) é **exatamente o gatilho automático no cadastro** que a de 20/07 proibiu — e
ainda move o gatilho para a mão do CLIENTE FINAL, não do staff.

**Condição 1 verificada em 17/08: continua NÃO ATENDIDA.** Não existe sandbox do Asaas —
as únicas env no erp-dimplus são `ASAAS_API_KEY` / `ASAAS_API_URL` (uma só chave), e todo
"sandbox" nos docs do erp é o **Vercel** (`erp-dimplus-wxyc`), não o Asaas.

**PROPOSTA (pendente de confirmação do Henrique):** a aprovação do staff (S-E) É o "gatilho
manual com preview". O titular SOLICITA pelo app; o staff vê o preview do valor e aprova; a
APROVAÇÃO dispara a cobrança. Nada automático, nada na mão do cliente, e o fluxo do app
continua existindo. Isso satisfaz a condição 2 sem abrir mão da decisão de 17/08.
A condição 1 (sandbox) segue em aberto e **bloqueia a validação da S-A**.

---

## O QUE JÁ EXISTE NO ERP (levantado em 17/08 — NÃO reconstruir)

- 🔴 **CHECK `clientes_dependente_sem_cobranca_check`**: dependente NÃO PODE ter `asaas_id`,
  `asaas_subscription_id`, `asaas_adesao_id` nem `plano_id`. É invariante de banco, não
  convenção. **Confirma que o excedente vai na assinatura DO TITULAR** — e explica o
  `plano_id` nulo dos 44. Regra do erp: *"ler os CHECKs antes de planejar filtro"*.
- **`PUT /subscriptions/{id}` JÁ EXISTE** em `src/app/api/asaas/subscription/route.ts`
  (erp-dimplus). O encanamento está pronto; falta a REGRA de excedente e a idempotência.
- **UI de dependentes já existe** (v0.154.0 → v0.155.1): bloco de dependentes no cadastro,
  modal de gerenciar dependentes de cliente já cadastrado, parentesco como lista fixa.
  A S-E é ADAPTAÇÃO, não construção.
- **`fn_cliente_adimplente` resolve para o TITULAR** → `fn_cliente_pode` já bloqueia o
  dependente quando o titular está OVERDUE, **sem mudança no app**. O bloqueio por
  inadimplência que o Henrique pediu em 17/08 JÁ FUNCIONA.
- **Dependente já foi previsto com `user_id` e paciente Feegow próprios** desde 20/07, e o
  ROADMAP-APP já o trata como usuário normal com duas diferenças: **sem financeiro**
  (`asaas_id` NULL → módulo `financeiro` fica FORA para ele) e adimplência do titular.
  A decisão de 17/08 (login próprio) **confirma** o desenho existente, não o muda.
- `reclassificar_status_clientes` é blindado com `WHERE titular_id IS NULL` — sem isso todo
  dependente virava `churn` a cada sync, em silêncio.
- Testes de comportamento de 20/07 rodaram contra PROD com rollback: titular limpo →
  `fn_cliente_pode(dep,'agendamento')` = true; titular OVERDUE → false.

### Pendências herdadas do erp (entram nesta linha)
- **Nunca testado com dependente real na Feegow** — validar no primeiro caso de produção.
  Casa com o S2 deste repo.
- **Métricas de vida** (vidas ativas/bloqueadas, razão vidas/contrato, distribuição por
  contrato em baldes 0/1-3/4-5/6+): desenhadas em 20/07, **nunca implementadas**. Entram AO
  LADO dos KPIs de CONTRATO, nunca no lugar.

---

## DECISÕES (17/08/2026)

**Cobrança do excedente — dois momentos.** No cadastro inicial, o excedente entra no cálculo
da assinatura. **Depois** do cadastro fechado, gera **uma avulsa** (a primeira) e a
recorrente passa a somar tudo: `79,90 + 29,90 = R$ 109,80`. Como a partir daí vira parcela
única, **bloquear todos os dependentes por inadimplência é correto** — não existem mais
cobranças paralelas separando "quem pagou" de "quem não pagou". (Objeção inicial ao bloqueio
coletivo retirada: ela valia para o desenho de cobranças paralelas, que não é este.)

**Menor vs maior.** Dependente **menor** fica dentro do login do titular. Dependente **maior**
tem login próprio **e o titular PERDE acesso** a resultados e visualizações dele.

> 🔴 Duas consequências que essa regra cria, registradas para não se perderem:
> - Os 44 dependentes atuais **não têm nascimento**, então a classificação menor/maior é
>   INVERIFICÁVEL para eles. O Henrique afirmou em 17/08 que **todos são maiores** e que cada
>   um terá login próprio — premissa aceita para os LEGADOS, mas **não confirmável por query**.
>   Para os NOVOS o trilho decide por data, nunca por premissa: sem isso, um filho de 12 anos
>   ganharia login. É por isso que a S-B (nascimento obrigatório) vem ANTES da S-F (login).
> - A regra **vira sozinha com o tempo**: dependente que faz 18 anos muda de trilho e o
>   titular perde acesso que tinha ontem. Tem que ser avaliada **na leitura, contra a data
>   corrente** — não congelada no cadastro. É exatamente o desenho de `idadeEm`, que recebe a
>   data de referência de fora. Decidir se o titular é avisado antes (perder acesso sem
>   explicação vira chamado no SAC).

**Aprovação.** Todo e qualquer cadastro passa por aprovação do staff. A solicitação grava na
hora (auditoria preservada, titular vê "em análise"); nada vira cliente ativo sem decisão.

**Idempotência da cobrança.** Verificar-antes-de-criar **não** resolve duplo toque: as duas
requisições consultam ao mesmo tempo, veem o mesmo nada e as duas criam. A garantia é
**chave única no banco** (titular + dependente + competência) para a segunda tentativa
FALHAR no banco, mais `externalReference` derivado da mesma chave no Asaas, para a segunda
chamada ser reconhecida como repetição. Mostrar o código da cobrança já feita é a
**exibição** apoiada nessa chave — não a garantia em si.

---

## SPRINTS

### S-A · Cobrança do excedente — `erp-dimplus` · ⛔ BLOQUEADA (sandbox do Asaas)
Vazamento que já existe hoje e independe do app. Os dois caminhos acima + chave única +
`externalReference`.
⛔ **Não iniciar sem resolver o conflito acima.** `PUT /subscriptions/{id}` já existe; o que
falta é a regra de excedente, a idempotência e — principalmente — um jeito de PROVAR
ausência de double-charge sem cobrar cliente real.
**Pronto quando:** 6º dependente no PLUS gera avulsa e assinatura corrigida para 109,80;
segunda tentativa falha no banco e devolve o código da cobrança já feita; SAG/OZ seguem
barrando.
**Fora:** qualquer coisa de app.
`assinaturas` é ESPELHO do Asaas (`asaas_id`, `raw`) — mudar valor é chamada à API, não
UPDATE na tabela.

### S-B · Nascimento obrigatório no cadastro — `erp-dimplus`
Balcão e `/api/public/app-cadastro`, `fonte='cadastro'`. Sem isso o buraco dos 271 volta a
crescer e a regra menor/maior fica sem base.
**Pronto quando:** cadastro novo rejeita sem nascimento; nenhum registro novo nasce com NULL.

### S-C · Leitura de dependentes no app — ✅ ENTREGUE 17/08/2026 (v0.5.0 + v0.5.1)

Entregue: `fn_app_meus_dependentes()` no banco, `getMeusDependentes()` + tipos no app, e a
tela `src/app/dependentes.tsx` (rota EMPILHADA, não aba — (tabs)/ criaria uma quinta aba
automaticamente). Entrada pelo Perfil.

🔴 **FIX DE SEGURANÇA ENCONTRADO NO CAMINHO (P0, aplicado):** `fn_dependentes_situacao`,
`fn_dependentes_qtd` e `fn_cliente_titular` são `SECURITY DEFINER`, recebem o titular COMO
PARÂMETRO e estavam com `EXECUTE` para **public/anon/authenticated**. Com a chave pública do
app — **inclusive sem login** — dava para passar um uuid arbitrário e ler plano, limite, uso
e valor de excedente de OUTRO titular. Mesma classe do fix de `fn_mover_estagio_lead`.
REVOKE aplicado; `service_role` mantido (o único chamador é uma rota do ERP via
`createAdminClient`, que ignora grants, então o ERP não quebrou).
A RPC nova NÃO recria o furo: é **sem parâmetro**, resolve o titular do `auth.uid()` dentro
da função. Se alguém "simplificar" chamando `fn_dependentes_situacao` direto do app, o furo
volta.

Provado por canária em transação REVERTIDA contra produção: sem sessão → vazio, não erro;
com sessão de titular real → seus 5 dependentes, limite 5, usados 5, `pode_adicionar` true
(PLUS/`cobrar`). Rollback conferido, zero resíduo.

🔴 **Nenhum dos 18 titulares com dependentes tem `user_id`** → a tela abre vazia em 100% dos
casos reais. O estado vazio é o caminho PRINCIPAL, não a exceção.

_(escopo original abaixo)_

### S-C · Leitura de dependentes no app — `dimplus-app`
Policy para o titular ver seus dependentes + RPC expondo `fn_dependentes_situacao`.
**Zero escrita.** Primeira coisa que o usuário nota; entrega valor sozinha.
**Pronto quando:** titular vê a lista e "3 de 5 usados"; titular sem dependente vê estado
vazio CORRETO, não erro.
⚠️ Se a decisão de 17/08 valer (dependente MAIOR tem login próprio e **o titular PERDE acesso
a resultados e visualizações**), esta sprint mostra ao titular apenas a EXISTÊNCIA e a
contagem — nunca resultado de exame ou agenda de dependente maior. A lista é cadastral.

### S-D · Solicitação de inclusão — `dimplus-app` + `erp-dimplus`
Tabela `dependente_solicitacoes` no molde de `app_acesso_solicitacoes` (`status` default
`pendente`, `decidido_por`, `decidido_em`) + RPC `SECURITY DEFINER` com **REVOKE de
public/anon/authenticated**. **Não** abrir INSERT em `clientes` via RLS para o cliente final:
é a tabela mais sensível do sistema. Nascimento obrigatório no formulário. Plano `cobrar` +
titular no limite → tela mostra o valor ANTES do envio.
**Pronto quando:** grava como `pendente` e nada vira cliente ativo; plano `barrar` recusa com
mensagem clara; duplo envio não cria duas.
> `app_acesso_solicitacoes` é fila de "quero acesso ao app" (CPF + telefone). Serve de
> MODELO, mas reusá-la para inclusão de dependente torceria a semântica.

### S-E · Fila de aprovação — `erp-dimplus`
Staff aprova/recusa com `decidido_por`/`decidido_em`. Só na aprovação o registro entra em
`clientes` — e os triggers existentes fazem o resto.
**Pronto quando:** aprovação cria o dependente e dispara a cobrança da S-A; recusa registra
motivo e o titular vê.

### S-F · Login próprio do dependente maior — `dimplus-app`
Só depois da S-B rodando: é ela que garante a data que decide o trilho.
Desenho JÁ previsto no erp desde 20/07 (dependente com `user_id` e paciente Feegow próprios).
🔴 **O módulo `financeiro` fica FORA do dependente** — `asaas_id` é NULL por CHECK, então sem
faturas, sem 2ª via, sem assinatura. Lista vazia ali é estado CORRETO, não falha (já está
documentado em `src/lib/types.ts`).

---

## ORDEM RECOMENDADA

⚠️ **A ordem de 17/08 (S-A primeiro) foi CORRIGIDA**: a S-A está bloqueada por dependência
externa (sandbox do Asaas), não por engenharia. Puxá-la para a frente da fila pararia a fila.

Ordem revisada:
1. **S-B** (nascimento obrigatório) — desbloqueada, barata, e é pré-requisito do trilho
   menor/maior. Lidera.
2. **S-C** (leitura no app) — desbloqueada, entrega valor sozinha, zero escrita.
3. **S-A** quando a sandbox for resolvida (ou quando o Henrique aceitar a proposta de gatilho
   manual via S-E como substituto da condição 2).
4. **S-D → S-E → S-F.**

O **S2 (agendamento)** corre em paralelo no app: está desbloqueado desde que a idade foi
resolvida e não depende de nenhuma sprint desta lista.

S-A e S-B são `erp-dimplus`; S-C em diante são o app. **1 conversa = 1 repo**: S-A/S-B pedem
sessão própria no erp-dimplus.
