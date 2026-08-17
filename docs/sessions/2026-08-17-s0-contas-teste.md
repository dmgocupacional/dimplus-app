# 2026-08-17 — S0 · Contas de teste liberadas (estado `pronto` alcançado)

**Versão:** v0.3.1 · **Commit base:** `c6c88ed`
**Natureza da sessão:** EXECUÇÃO em produção. Nenhuma linha de código do app foi alterada.
**Antecedente:** `2026-08-17-diagnostico-demo-e-gestor.md` — que apurou 0 contas de app existentes.

---

## O QUE FOI FEITO

Pela primeira vez desde o início do projeto, o estado `pronto` da máquina de sessão foi
alcançado em produção. Antes desta sessão: 809 clientes, 0 com `user_id`, 0 com
`app_acesso='liberado'`.

Três contas de TESTE liberadas ponta a ponta, pelo caminho real de produção:

| CPF | Cliente | Plano | Financeiro |
|---|---|---|---|
| `11144477735` | ZZ TESTE ANUAL - NAO COBRAR | DIM+ Sagrado | 1 fatura `DELETED` |
| `11122233396` | ZZ TESTE 12X DIMPLUS - NAO COBRAR | DIM+ Saúde | parcelas `DELETED` |
| `55566677720` | ZZ TESTE NAO COBRA SAGRADO PAGOU AGORA | DIM+ Sagrado | `RECEIVED_IN_CASH` + `PENDING` 2027 |

Senha das três: `DimPlus@2026`

**Para demonstração use `55566677720`** — é a única com histórico de pagamento coerente
(anuidade quitada + próxima vencendo). As outras duas só têm cobrança cancelada de teste.

---

## COMO FOI FEITO (e por que assim)

```
POST /api/public/app-cadastro  ×3          ← curl, rota pública real
       ├─ cria usuário no auth (email sintético {cpf}@app.dimeg.com.br)
       └─ grava app_acesso_solicitacoes (status=pendente, user_id, cliente_id)
                    ↓
Henrique aprovou as 3 na tela do ERP       ← fluxo real do staff
                    ↓
clientes.user_id = solicitacao.user_id  +  app_acesso='liberado'
```

**Decisão: NÃO criar usuário em `auth.users` por SQL.** `pgcrypto` está disponível e o
insert manual funcionaria, mas a conta nasceria por um caminho diferente do de produção —
a demo validaria um fluxo que não é o fluxo. Usar a rota pública garante bcrypt, email
sintético e honeypot idênticos aos de um cadastro real.

**Decisão: aprovação pela tela do ERP, não por SQL.** Custa alguns minutos a mais e valida
de graça o fluxo de aprovação do staff, que também nunca havia rodado em produção.

---

## PROVAS EXECUTADAS (não inferidas)

1. `POST /api/public/app-cadastro` → HTTP 200 nos 3. **Não é prova** — a rota é muda por
   design e responde o mesmo texto para qualquer caso.
2. SQL em `app_acesso_solicitacoes` → 3 linhas `pendente`, `user_id` preenchido,
   `cliente_id` casado no cliente certo. A rota fez o match por CPF sozinha.
3. Após aprovação: `clientes.app_acesso='liberado'`, `user_id` preenchido, e
   `clientes.user_id = solicitacao.user_id` conferido — bate nos 3.
4. `POST /api/public/app-login` → `access_token` nos 3, JWT com
   `role=authenticated` e `email={cpf}@app.dimeg.com.br`.
5. **A prova que vale:** REST direto no Supabase com o token de cada conta.
   `clientes` devolveu 1 linha com plano, `pagamentos` devolveu faturas,
   `app_features` devolveu as 8 flags. Token que loga mas não enxerga dado seria
   estado `aguardando`, não `pronto` — por isso o passo 4 sozinho não bastava.

---

## DESCOBERTAS

### `agendamento` já existe como flag, desligada
`app_features` tem 8 chaves: `cartao`, `rede`, `sos`, `financeiro`, `ajuda` (ativas) e
`agendamento`, `telemedicina` (inativas). O módulo de agendamento Feegow (sprint futuro)
**não precisa criar estrutura de feature** — precisa ligar a flag existente.

### Vínculo com a Feegow já existe no schema
`clientes` tem `feegow_paciente_id` (bigint), `feegow_vinculado_em`, `feegow_vinculo_origem`.
**538 dos 809 clientes já vinculados (66%).** Agendamento pelo app é viável, mas nasce
cobrindo 2/3 da base — os outros 271 precisam de um caminho tratado, não de erro seco.

⚠️ As 3 contas de teste têm `feegow_paciente_id` NULL. A tela de agendamento nascerá em
estado vazio nelas. Decidir no sprint de agendamento se vincula a um paciente de teste na
Feegow — **nunca a um paciente real**, sob risco de expor agenda de terceiro.

### Faturas `DELETED` aparecem na tela
`isAdimplente()` só trata `OVERDUE` e `DUNNING_REQUESTED`, então `DELETED` não bloqueia
acesso — correto. Mas a aba Financeiro renderiza a linha da cobrança cancelada.
**Pendente de decisão:** filtrar `DELETED` da listagem (patch pequeno, v0.3.2) ou manter.

---

## ESTADO ATUAL

- Repo intocado em código. Único arquivo novo é este handoff.
- Banco: 3 clientes de teste alterados (`user_id`, `app_acesso`), 3 solicitações aprovadas,
  3 usuários novos em `auth.users`. Nenhum cliente real tocado.
- Bloqueio #1 do diagnóstico anterior (**ausência de contas**) está RESOLVIDO.
- Bloqueio #2 (**754 contratos sem aceite, `contrato_termos` vazia**) segue ABERTO e
  pertence ao repo `erp-dimplus`. É bloqueio jurídico, não técnico: falta o texto do termo,
  que é decisão de advogado.

## PRÓXIMOS PASSOS

- [ ] **Henrique roda o app em Expo Go** com `55566677720`. Bloqueador — exige aparelho.
      Validar: fonte Nunito, carteirinha, tabs, safe area, aba Financeiro.
- [ ] S1 · Polir telas existentes para demo, em cima do que a validação apontar (v0.3.2).
- [ ] S2 · Agendamento Feegow **read-only** (meus agendamentos + horários livres).
- [ ] S3 · Termo de aceite no app — depende do texto do advogado + gravação no erp-dimplus.
- [ ] S4 · Agendar de fato (escrita na Feegow). Só depois do S2 validado.
- [ ] S5 · Configuração de build/submit para as lojas.

## PEGADINHAS

- `feegow_criar_agendamento` escreve na **agenda de produção que a recepção vê**. Erro ali
  produz paciente fantasma no consultório. Leitura antes de escrita, sem atalho.
- Filtro por CPF prefixo `111%` na base captura **pessoas reais** (ALEXANDRA LOUIS,
  MARINA SILVA DE BRITO). Nunca operar contas de teste por `LIKE` — sempre por `id`.
- As rotas públicas são mudas de propósito (anti-enumeração de CPF). HTTP 200 no cadastro
  não significa sucesso; só a verificação em banco significa.
- Publicar nas lojas exige conta de teste funcional para o revisor da Apple — era
  justamente o que não existia até hoje.
- SDK 54 é teto; `runtimeVersion.policy = "sdkVersion"` não se toca.

---

## PROMPT DE RETOMADA

```
v0.3.1 · repo dmgocupacional/dimplus-app

Leia primeiro: docs/sessions/2026-08-17-s0-contas-teste.md
e docs/sessions/2026-08-17-diagnostico-demo-e-gestor.md

Estado: S0 concluído. Três contas de TESTE liberadas e provadas em produção —
o estado `pronto` da máquina de sessão foi alcançado pela primeira vez.
Use CPF 55566677720 / senha DimPlus@2026 para demonstrar (é a única com
histórico de pagamento coerente).

Próximo na fila: S1 (polir telas para demo) em cima do resultado da validação
em Expo Go. Depois S2 (agendamento Feegow READ-ONLY).

Decisões pendentes:
- filtrar faturas DELETED da aba Financeiro (v0.3.2)?
- aba Rede fica com mock declarado ou é ocultada na demo?
- vincular feegow_paciente_id de teste nas 3 contas? (nunca paciente real)

Não mexer: SDK 54 é teto; runtimeVersion.policy = "sdkVersion" intocável;
sem realtime nem push (decisão de projeto); aprovação de contrato e RBAC de
funcionário permanecem no erp-dimplus.

Regras: nada de código sem "vai" explícito. Schema-first via Supabase MCP antes
de qualquer código de dados. Ler arquivo inteiro antes de afirmar algo sobre ele.
Escrita na Feegow só depois da leitura validada.
```
