# 2026-08-17 — S1 (varredura) + recon de leitura da Feegow

**Versão final:** v0.3.4 · **Commits:** `de9f594` (fix) · `d868e9d` (recon) · handoff a seguir
**Sessão anterior:** `2026-08-17-boundary-e-fix-financeiro.md`

---

## O QUE FOI FEITO

### v0.3.4 — `description` vazia caía num fallback morto

`data.ts` fazia `p.description ?? 'Mensalidade'`. O `??` só cobre null/undefined — e a
coluna **nunca é NULL**: são **147 registros com string VAZIA**. O fallback era letra morta
e a linha da fatura renderizava título em branco. Corrigido para
`(p.description ?? '').trim() || 'Mensalidade'`.

Provado por 6/6 casos executados, incluindo a armadilha do `||`: a string `"0"` é truthy e
passa intacta, não é engolida pelo fallback.

Mesmo commit: comentário incorreto em `types.ts` (ver Método, abaixo).

### `docs/FEEGOW-LEITURA.md` — recon do caminho de leitura

Leitura da Feegow **validada por chamada real** (`feegow_disponibilidade`, `feegow_locais`).
Deixou de ser "a verificar". Os achados estão no documento; ler ANTES de tocar no S2.

---

## MÉTODO — o que a varredura por query pegou e o device não pegaria

O S1 foi desenhado como "varrer as telas com as contas de teste". **As 3 contas de teste têm
ZERO faturas com descrição vazia.** Varrer só em device não acharia o bug entregue nesta
sessão — ele vive em cliente real.

A varredura foi feita em DUAS frentes, e elas não se substituem:
- leitura de código (o que a tela assume)
- contagem no banco (o que o dado realmente é)

Regra derivada: **conta de teste não é amostra da base.** Ela prova o fluxo, não o dado.

### Comentário que mentia (segundo caso em duas sessões)

`types.ts` explicava `subscription_next_due` NULL como "dependente não tem assinatura
própria". O dado desmente: **385 NULLs (48%) para 44 dependentes** — sobram 341 sem
explicação. A causa real do grosso NÃO foi apurada; isso está registrado como tal.

É o segundo comentário incorreto sobre infra/dado em duas sessões (o primeiro foi o
`exposdk:57.0.0` do workflow). Comentário errado induz decisão errada e custa hipótese.

---

## DECISÕES TOMADAS

1. **Descrição vazia:** corrigir com `.trim() ||`, não com `??`. (Henrique aceitou proposta.)
2. **SOS:** correção ADIADA por decisão do Henrique. Registrado inline em `index.tsx`.
3. **CNPJ / documento vazio:** PARADO por decisão do Henrique. Registrado inline em
   `format.ts`.
4. **Rede:** mantida. Levantado que os 5 parceiros do mock são **empresas reais nomeadas**
   (Drogaria São Paulo, Droga Raia, Delboni, OdontoCare) — se não houver parceria assinada,
   exibi-las numa demo comercial é promessa falsa e o rodapé "rede em expansão" não cobre,
   porque o prospect lê o nome e não lê o rodapé. Recomendação registrada: ocultar via
   `app_features.rede` (uma linha de SQL, reversível) se não houver contrato.
   **Aguarda o Henrique confirmar o status das parcerias.**
5. **Feegow:** recon primeiro, construção depois. Nenhuma linha de S2 escrita.

---

## ESTADO ATUAL

- v0.3.4 no `main`. `tsc --noEmit` limpo. Bump nos três lugares.
- ⚠️ **NADA validado em device nesta sessão.** Existe `.github/workflows/expo-update.yml`,
  então o push provavelmente publicou OTA — NÃO confirmado que rodou nem que entregou.
- ⚠️ O fix da v0.3.4 **não é exercitável pelas contas de teste** (0 faturas com desc vazia).
  Validação real dele é por query ou por conta de cliente real liberada.
- Banco intocado nesta sessão. Nenhuma migração, nenhuma escrita.

---

## PEGADINHAS DESCOBERTAS

- **`??` vs `||` em coluna `text`:** string vazia não é null. Em coluna sem NOT NULL e sem
  CHECK, vinda de sistema externo, `??` cobre metade dos casos. Padrão irmão do bug do
  `rotuloStatus` (v0.3.3): a tela assume uma forma que o dado não garante.
- **`clientes` NÃO tem data de nascimento.** Verificado em `information_schema`. Bloqueia o
  filtro de `age_restriction` da Feegow — ver `docs/FEEGOW-LEITURA.md` §6.2. Decisão aberta.
- **Payload da Feegow sem filtro é inviável no device** (~45 profissionais × 57 horários em
  4 dias). Obriga a tela a pedir especialidade ANTES do horário.
- **`age_restriction` tem 4 formatos e grafia diferente entre endpoints.** FEEGOW-LEITURA §4.
- **`local_id` é SALA, não unidade**, e as salas 26/27 se chamam `"importado"`.
- **`feegow_agendamentos` sem `paciente_id` devolve agenda de paciente REAL.** Não chamar
  sem filtro — dado de saúde de terceiro.
- **Refutado, não gastar tempo de novo:** `ModuloKey` cobre as 8 chaves reais de
  `app_features` (nenhum módulo órfão em `ATALHOS`); `nome` vazio = 0 casos; `membro_desde`
  nulo = 0 casos; `value`/`due_date` nulos em `pagamentos` = 0. Logo `iniciais`,
  `formatMesAno` e `formatBRL` estão seguros — verificado por contagem.
- **A conta boa `55566677720` vence em 2028-07-29**, não 2027 como diziam os handoffs
  anteriores. O cartão mostra `07/2028`.

---

## PRÓXIMOS PASSOS

- [ ] Henrique confere a aba Perfil em device: tem que dizer `v0.3.4 · 17/08/2026`. Se
      aparecer 0.3.3, é cache do Expo Go — matar e reabrir.
- [ ] **Decidir a idade** (FEEGOW-LEITURA §6.2): puxar da Feegow / criar coluna / não
      filtrar. Bloqueia o S2 de verdade.
- [ ] **Decidir `feegow_paciente_id` de teste.** Se sim, é criação de paciente na Feegow =
      ESCRITA EM PRODUÇÃO, conversa própria com autorização explícita. Nunca paciente real.
- [ ] **Confirmar status das parcerias da Rede** (decisão 4).
- [ ] S2 · tela de agendamento read-only, já na forma da §8 do FEEGOW-LEITURA.
- [ ] S3 · termo de aceite — segue BLOQUEIO JURÍDICO, `contrato_termos` vazia.
- [ ] S4 · escrita na Feegow. Só depois do S2 validado em device.
- [ ] S5 · build/submit lojas.
- [ ] Dívidas adiadas: SOS (decisão 2), CNPJ (decisão 3).

## FORA DE ESCOPO
WhatsApp · push · realtime · remover mock da Rede · aprovação de contrato e RBAC de
funcionário no celular (permanecem no erp-dimplus).

---

## PROMPT DE RETOMADA

```
v0.3.4 · commit d868e9d · repo dmgocupacional/dimplus-app · branch main
(NÃO confie no hash escrito aqui — rode `git log --oneline -5`.)

Leia primeiro:
- docs/FEEGOW-LEITURA.md                              (recon Feegow — LER ANTES DO S2)
- docs/sessions/2026-08-17-s1-e-recon-feegow.md        (esta sessão)
- docs/sessions/2026-08-17-boundary-e-fix-financeiro.md
- docs/sessions/2026-08-17-s0-contas-teste.md          (contas de teste)

CONTEXTO: app com auth por CPF (email sintético), máquina de sessão de 4 estados, 4 abas
com dado REAL do Supabase — exceto a Rede, que é mock declarado. Em 17/08: 3 contas de
teste liberadas, estado `pronto` alcançado em produção, e três bugs do mesmo padrão
corrigidos (tela preta sem diagnóstico; crash do Financeiro em 807 pagamentos; descrição
de fatura caindo num fallback morto). O padrão é sempre o mesmo: A TELA ASSUME UMA FORMA
QUE O DADO NÃO GARANTE. Procure por isso.

CONTA PARA TESTAR: CPF 55566677720 / senha DimPlus@2026 (única com histórico coerente).
Atenção: ela vence em 2028-07-29, e as 3 contas de teste NÃO exercitam o fix da v0.3.4.

ESCOPO, em ordem:
1. DECISÕES do Henrique que bloqueiam o S2, resolver ANTES de codar:
   a) idade — `clientes` NÃO TEM data de nascimento (verificado em information_schema).
      Sem ela não há como aplicar o `age_restriction` da Feegow: a tela ofereceria
      pediatra (age_to:16) para adulto, e no S4 a Feegow recusa só na confirmação.
      Opções em FEEGOW-LEITURA §6.2: puxar da Feegow (cobre só os 538 vinculados) /
      criar coluna e preencher 809 / não filtrar (registrar como escolha).
   b) feegow_paciente_id de teste — as 3 contas liberadas têm NULL, então o S2 nasce em
      empty state em 100% delas. Vincular exige criar paciente na Feegow = ESCRITA EM
      PRODUÇÃO. NUNCA a paciente real (exporia agenda de terceiro).
   c) Rede — os 5 parceiros do mock são empresas reais NOMEADAS. Se não houver parceria
      assinada, ocultar via app_features.rede. Aguarda status das parcerias.
2. S2 · Agendamento Feegow READ-ONLY. A leitura JÁ FOI VALIDADA por chamada real. A flag
   `agendamento` já existe em app_features, desligada — é ligar, não criar. A tela já
   nasce tendo que ter a forma da §8 do FEEGOW-LEITURA: especialidade ANTES do horário
   (payload sem filtro é inviável no device), horários agrupados por UNIDADE e não por
   sala, salas 26/27 ("importado") fora, [] = sem vaga e não erro, age_restriction lido
   nas DUAS grafias ({age_from,age_to} aqui e {idade_minima,idade_maxima} no outro
   endpoint), sentinelas 0/127 não exibidas, caminho tratado para os 271 sem vínculo.
3. S3 · Termo de aceite — BLOQUEIO JURÍDICO: contrato_termos vazia e o texto é decisão de
   advogado. Não redigir cláusula por conta própria.
4. S4 · Escrita na Feegow. Só depois do S2 validado em device. Sem tabela_id 6 o
   agendamento nasce no PARTICULAR CHEIO; procedimento_id é obrigatório.
5. S5 · Build e submit para as lojas.

DÍVIDAS ADIADAS (decisão do Henrique, registradas inline no código):
- SOS é um TOQUE MORTO: flag ativa + rota null = tile parece aberto e não faz nada, em
  100% das contas. Comentário em src/app/(tabs)/index.tsx.
- CNPJ/documento vazio em formatCPF/maskCPF: 10 clientes com 14 dígitos viram CPF falso,
  4 sem documento viram "•••.000.000-••". Comentário em src/lib/format.ts.

NÃO MEXER:
- PagamentoStatus é união ABERTA de propósito (| (string & {})). NÃO FECHAR.
- O `default` do rotuloStatus é intocável, mesmo parecendo exaustivo.
- O `.trim() ||` do data.ts: NÃO voltar para `??` — 147 registros têm string vazia.
- DELETED permanece visível como "cancelada" — decisão do Henrique.
- SDK 54 é teto; runtimeVersion.policy = "sdkVersion" intocável.
- Sem realtime e sem push (decisão de projeto).
- Aprovação de contrato e RBAC de funcionário ficam no erp-dimplus.

REGRAS:
- Nada de código sem "vai" explícito.
- Schema-first via Supabase MCP (projeto bhrxfudnhxqntnnbgyjg) antes de código de dados.
- Ler o arquivo inteiro antes de afirmar qualquer coisa sobre ele.
- "Funcionou"/"quebrou" NÃO valem sem a versão junto — conferir a aba Perfil primeiro.
- Conta de teste NÃO é amostra da base: ela prova o fluxo, não o dado. Bug de dado se
  acha por contagem no banco, não por varredura em device.
- Bump em TRÊS lugares no mesmo commit: src/lib/version.ts + package.json + app.json.
- feegow_agendamentos/historico SEM paciente_id devolve dado de paciente REAL — não
  chamar sem filtro.
- feegow_criar_agendamento escreve na agenda de PRODUÇÃO que a recepção vê. Leitura
  antes de escrita, sem atalho.
```
