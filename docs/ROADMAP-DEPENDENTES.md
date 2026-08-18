# ROADMAP — Inclusão de dependentes pelo titular

> ⚠️ Este NÃO é o `ROADMAP-APP.md` citado em `src/lib/types.ts`, `src/lib/gate.ts`,
> `src/theme/tokens.ts` e `src/app/(auth)/login.tsx`. Aquele vive em
> **`erp-dimplus/docs/ROADMAP-APP.md`** — não existe cópia neste repo. Este arquivo cobre
> só a linha de dependentes, decidida em 17/08/2026.

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

### S-A · Cobrança do excedente — `erp-dimplus`
Vazamento que já existe hoje e independe do app. Os dois caminhos acima + chave única +
`externalReference`.
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

### S-C · Leitura de dependentes no app — `dimplus-app`
Policy para o titular ver seus dependentes + RPC expondo `fn_dependentes_situacao`.
**Zero escrita.** Primeira coisa que o usuário nota; entrega valor sozinha.
**Pronto quando:** titular vê a lista e "3 de 5 usados"; titular sem dependente vê estado
vazio CORRETO, não erro.

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

---

## ORDEM RECOMENDADA

**S-A → S-B** primeiro (é dinheiro vazando hoje, e independe de tudo), com o **S2
(agendamento)** correndo em paralelo no app — ele está desbloqueado desde que a idade foi
resolvida, e não depende de nenhuma sprint desta lista.

S-A e S-B são `erp-dimplus`; S-C em diante são o app. **1 conversa = 1 repo**: S-A/S-B pedem
sessão própria no erp-dimplus.
