# 2026-08-17 — Diagnóstico pré-evento + escopo visão gestor

**Versão:** v0.3.1 · **Commit base:** `29040ef`
**Natureza da sessão:** DIAGNÓSTICO. Nenhuma linha de código ou SQL foi executada.
**Contexto:** eventos em 17/08 (hoje) e 18/08. Objetivo era app "completo" para demonstrar valor.

---

## ACHADOS CRÍTICOS (via query real em `bhrxfudnhxqntnnbgyjg`)

### 1. Nenhuma conta de app existe em produção — BLOQUEIA A DEMO

```
clientes total ................ 804
app_acesso = 'liberado' ....... 0
user_id preenchido ............ 0
```

Consequência: o estado `pronto` da máquina de sessão (tabs, carteirinha,
financeiro, rede) **nunca foi alcançado em produção por ninguém**. Não é
falta de teste em device — é ausência de dado. O roteiro de validação
`2026-08-05-validacao-expo-go.md` travaria no passo 5 por falta de conta,
não por bug.

### 2. 752 contratos sem prova de consentimento — RISCO JURÍDICO ABERTO

```
contratos ..................... 752
contratos com aceite_em ....... 0
contrato_termos publicados .... 0
```

A estrutura jurídica **já existe e é adequada**:
- `contrato_termos`: `versao`, `texto`, `hash`, `publicado_em`
- `contratos`: `termo_versao_id`, `aceite_em`, `aceite_ip`,
  `aceite_user_agent`, `aceite_por`

O conjunto (quem/quando/de onde/qual texto via hash) sustenta aceite
eletrônico em disputa. Está 100% vazio. O aceite nunca ocorreu.

**Bloqueio não é técnico:** sem linha em `contrato_termos` não há texto a
aceitar, e esse texto é decisão jurídica (advogado), não de engenharia.

### 3. Validação em device continua não executada
Dívida herdada da v0.3.1. Requer aparelho físico — só o Henrique executa.

### 4. Dado de resultado para dashboard gestor É viável
```
leads .............. 757    leads últimos 30d ...... 164
convertidos ........ 20     conversões 30d ......... 19
vendedoras ativas .. 6
```
`leads` já tem `estagio`, `vendedora_id`, `vendedora_nome`, `data_conversao`,
`valor_proposta`, `origem_canal`, `motivo_perda`, `etapa_desde`,
`promessa_pagamento_em`. Suficiente para dashboard real.

---

## DECISÕES TOMADAS

1. **Visão gestor não é tela, é modelo de permissão.** Todo o app assenta em
   RLS que devolve UMA linha (`clientes_app_own_select`: `user_id = auth.uid()`;
   `getCliente()` faz `.limit(1).maybeSingle()` sem passar id). Gestor exige
   leitura cruzada de N clientes → policies novas + papel `gestor` + seletor
   de contexto na sessão. Máquina de 4 estados passa a 4 × 2 papéis.

2. **Não portar o ERP para o celular.** Aprovação de contrato (documento longo)
   e RBAC de funcionário permanecem no erp-dimplus. Ao celular vai só o que
   nasce dele: aprovar na fila, consultar CPF, ver pulso.

3. **Dashboard agregado em SQL, nunca no device.** `fn_gestor_resumo` devolve
   números prontos. Puxar 757 leads para o app seria erro de performance e
   furo de RLS.

4. **Leitura antes de escrita na visão gestor.** Pulso/Time (read-only) vem
   ANTES de aprovar-com-um-toque. Inverte a ordem sugerida inicialmente:
   menor risco, maior valor imediato.

5. **Demo deve usar contas de teste, não clientes reais.** Liberar acesso a
   cliente real que nunca aceitou termo repete o problema do achado #2 em
   pequena escala.

6. **Rede segue mock declarado** (`REDE_E_MOCK`, 5 parceiros). Decisão
   pendente: manter na demo com discurso de expansão, ou ocultar a aba.

---

## ESCOPO DA VISÃO GESTOR (desenhado, não construído)

Recorte: *o ERP filtrado por "o que exige minha atenção agora"* — não um ERP menor.

**Bloco 1 — Pulso** (read-only, toggle dia/semana/mês): leads novos,
conversões, valor fechado. Cada número com comparativo vs. período anterior.

**Bloco 2 — Time**: ranking das 6 vendedoras (recebidos, convertidos, taxa).
`vendedora_nome` já desnormalizado → barato.

**Bloco 3 — Precisa de você** (única lista com ação): cadastros aguardando,
leads parados por `etapa_desde`, promessas de pagamento vencidas.

**Adicionados por sugestão:** funil por estágio; agregação de `motivo_perda`
(coletado hoje e nunca lido); log de auditoria de quem aprovou o quê.

---

## ERRO DA SESSÃO (registrado para não repetir)

Assistente calculou o cronograma assumindo "hoje = quinta 13/08", quando a
data real é **segunda 17/08 — dia do primeiro evento**. Todo o plano S0→S6
foi dimensionado sobre data inventada. Corrigido ao final da sessão.
**Regra: ler a data do ambiente, nunca inferir de contexto.**

---

## ESTADO ATUAL

Nada alterado. Repo em `29040ef`, banco intocado. Todo o valor desta sessão
é diagnóstico.

## PRÓXIMOS PASSOS (reordenados para a realidade de hoje)

**Hoje, antes do evento — só isto cabe:**
- [ ] Criar 2–3 contas de TESTE (não clientes reais) com `user_id` +
      `app_acesso='liberado'`. ~10min. **Aguarda decisão: teste ou CPF real.**
- [ ] Henrique roda os 8 passos do roteiro em Expo Go. ~20min. **Bloqueador.**
- [ ] Decidir: aba Rede fica com mock ou é ocultada na demo.

**Pós-evento, em ordem:**
- [ ] S-1 · Publicar `contrato_termos` v1 com hash — **exige texto de advogado**.
      Depois: fluxo de aceite no fechamento gravando ip/user_agent/termo_versao_id.
      Decidir também a remediação dos 752 contratos retroativos.
- [ ] Auto-refresh no "Quase lá" (polling 5s) — mata o silêncio entre cadastro
      ao vivo e aprovação manual no ERP.
- [ ] Fundação gestor no banco: papel, policies cruzadas, auditoria,
      `fn_gestor_resumo`. Sem tela.
- [ ] Tela gestor Pulso + Time (read-only).
- [ ] Gestor com ação: "Precisa de você", aprovar, buscar CPF.

## FORA DE ESCOPO DECLARADO
WhatsApp · push notification · remover mock da Rede · aprovação de contrato
e RBAC de funcionário no celular (permanecem no ERP).

## PEGADINHAS
- `getCliente()` não recebe id — depende inteiramente da RLS. Qualquer leitura
  multi-cliente exige policy nova, não mudança de query.
- Sem realtime e sem push por decisão de projeto: transição de "Quase lá" para
  "pronto" só ocorre por ação manual do usuário.
- SDK 54 é teto; `runtimeVersion.policy = "sdkVersion"` não se toca.
- Fluxo de aprovação depende de humano no ERP — gargalo operacional, não bug.

---

## PROMPT DE RETOMADA — dimplus-app (esta frente)

```
v0.3.1 · commit 29040ef · repo dmgocupacional/dimplus-app

Leia primeiro: docs/sessions/2026-08-17-diagnostico-demo-e-gestor.md
e docs/sessions/2026-08-05-validacao-expo-go.md

Estado: nada foi implementado. A sessão anterior foi diagnóstico e apurou dois
bloqueios de fato: (1) nenhuma conta de app existe em producao — 804 clientes,
0 com app_acesso='liberado' e 0 com user_id, logo o estado `pronto` nunca foi
alcancado por ninguem; (2) 752 contratos sem nenhum aceite registrado (essa
segunda frente pertence ao repo erp-dimplus, nao a este).

Escopo desta frente, em ordem:
1. Criar 2-3 contas de TESTE (nao clientes reais) com user_id + app_acesso.
   Decisao pendente do Henrique: contas de teste ou CPF real.
2. Henrique roda os 8 passos do roteiro em Expo Go — bloqueador, exige aparelho.
3. Corrigir o que a validacao achar (bump v0.3.2).
4. Auto-refresh no "Quase la": polling 5s enquanto a tela esta aberta, para
   eliminar o silencio entre cadastro ao vivo e aprovacao manual no ERP (v0.4.0).
5. Telas gestor Pulso + Time, read-only, depois da fundacao no banco (v0.5.0).

Decisoes pendentes: aba Rede fica com mock declarado ou e ocultada na demo.

Nao mexer: SDK 54 e teto; runtimeVersion.policy = "sdkVersion" intocavel;
nao introduzir realtime nem push (decisao de projeto); nao portar aprovacao de
contrato nem RBAC de funcionario para o celular.

Regras: nada de codigo sem "vai" explicito. Schema-first via Supabase MCP antes
de qualquer codigo de dados. Ler arquivo inteiro antes de afirmar qualquer coisa
sobre ele. Dashboard sempre agregado em SQL, nunca calculado no device.
```

## PROMPT PARA A CONVERSA PARALELA — erp-dimplus (frente contratos)

```
Contexto: erp-dimplus. Preciso equilibrar duas frentes paralelas — esta e uma
conversa do dimplus-app. Leia isto antes de propor qualquer coisa.

DESCOBERTA CRITICA feita na conversa do dimplus-app em 17/08, via query real no
Supabase bhrxfudnhxqntnnbgyjg:

  contratos ..................... 752
  contratos com aceite_em ....... 0
  contrato_termos publicados .... 0

752 contratos e ZERO prova de consentimento. A estrutura juridica ja existe e e
adequada — contrato_termos tem versao/texto/hash/publicado_em, e contratos tem
termo_versao_id/aceite_em/aceite_ip/aceite_user_agent/aceite_por. O conjunto
sustenta aceite eletronico em disputa judicial. So esta vazia: o aceite nunca
aconteceu em nenhum fechamento.

Tambem apurado: clientes = 804, mas app_acesso='liberado' = 0 e user_id = 0.
Nenhuma conta de app existe. Isso e tratado na outra conversa (dimplus-app).

DIVISAO DE TRABALHO (1 conversa = 1 repo):
- Esta conversa (erp-dimplus): contratos, termo de aceite digital no fechamento,
  remediacao dos 752 retroativos, e futuramente fn_gestor_resumo.
- Outra conversa (dimplus-app): contas de teste, validacao em device,
  auto-refresh do "Quase la", telas da visao gestor.
- Fronteira compartilhada: papel `gestor` + policies RLS de leitura cruzada.
  Combinar em qual conversa isso roda antes de alguem aplicar migracao, para
  nao colidirmos no mesmo banco.

O QUE PRECISO, nesta ordem:
1. Diagnostico primeiro, sem codigo. Grep real no repo por onde o fechamento
   acontece hoje (Balcao, conversao de lead, criacao de contrato) e me diga em
   quais pontos exatos o aceite deveria ser gravado. Nao assuma estrutura.
2. Diga se existe texto de contrato aprovado em algum lugar do repo (gerador de
   contratos, template, PDF). Se existir, e candidato a contrato_termos v1. Se
   nao existir, o bloqueio e juridico e nao tecnico — diga isso e pare ai.
3. Aplique o GATE DE PROPAGACAO antes de qualquer plano: levante por grep a
   matriz de superficies afetadas por aceite de contrato e apresente como lista
   de decisao item a item. Nao propague sozinho.
4. Traga a decisao sobre os 752 retroativos como escolha explicita minha, com
   trade-offs — nao escolha por mim.

RESTRICOES:
- Nada de codigo, SQL ou commit sem meu "vai" explicito.
- Schema-first via Supabase MCP antes de qualquer codigo de dados.
- CUTOVER SEM JANELA em migracao de leitura A->B: trigger de espelho no banco
  antes de migrar leitura; nunca backfill manual como transicao.
- Version bump no erp-dimplus: QUATRO lugares no mesmo commit — package.json +
  Sidebar.tsx + footer do login + VERSAO em src/app/balcao/client.tsx.
  (Corrigido em 17/08: este bloco dizia TRES, e foi por isso que a v0.255.0 saiu com
  o balcao em 0.254.1 em producao. O balcao exibe a versao em tela de proposito.)
  ATENCAO: o bump do dimplus-app e outro — src/lib/version.ts + package.json + app.json.
- Aceite de contrato e area juridica: nao redija clausula por conta propria.
  Sinalize o que precisa passar por advogado.
```

---

## 🔵 ADENDO 17/08 — o que mudou no erp-dimplus depois deste handoff

Escrito da conversa do **erp-dimplus** ao sincronizar as duas frentes. Este handoff
descrevia o ERP em `v0.253.0`; ele **já está em `v0.255.1`**. Nada aqui muda o escopo do
app — é para quem clonar o ERP a partir deste documento não achar o repo diferente do texto.

🔴 **PONTO ÚNICO DE RETOMADA DO ERP:** `docs/sessions/RETOMADA-erp-dimplus.md` **no repo
erp-dimplus** (não os prompts embutidos em handoffs, que envelhecem). Ler de lá.

**O que entrou no ERP:**
- `v0.253.1` — 589 linhas de drawer morto removidas (U5 fase 1).
- `v0.254.0` — balcão mostra o que o plano inclui ("não cobra", **sem preço**).
  🔴 O plano do **dependente** vem do **titular** (dependente tem `clientes.plano_id` NULL).
- `v0.254.1` — `indicacao-modal.tsx` virou `components/DetalheModal.tsx` (U5 fase 2a).
- `v0.255.0` — **motivo de perda obrigatório**; `fn_mover_estagio_lead` vira a porta de
  escrita de `leads.estagio`; 33 perdas sem motivo revertidas.
- `v0.255.1` — balcão volta à versão certa + `QuickAcao` sem `value` duplicado.

**Cancelados com medição** (não reabrir sem refazer a conta): U5 fase 3b e
`fn_mover_estagio_indicacao`.

### 🔴 O que INTERESSA a esta conversa
1. **A fronteira `gestor` continua SEM DONO.** Papel + policies RLS cruzadas tocam o
   **mesmo banco** (`bhrxfudnhxqntnnbgyjg`) das duas conversas e nenhuma reivindicou.
   Proposta da outra frente: **roda no ERP, o app só consome.**
   ⚠️ **Nenhuma das duas aplica `apply_migration` de `gestor` antes do combinado do Henrique.**
2. **Contratos:** confirmado que o bloqueio é **jurídico, não técnico** — a estrutura no
   banco está pronta, mas **não existe texto de contrato DIM+ Saúde** em lugar nenhum
   (o Gerador de Contratos DIMEG é do DMG Ocupacional, B2B, e não serve).
   E o 752 engana: **739 são `backfill` de script**, 11 `erp`, 4 `sync` — só 15 vieram de
   fechamento. Diagnóstico completo em
   `erp-dimplus/docs/sessions/2026-08-17-diagnostico-contratos-aceite.md`.
