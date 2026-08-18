# 2026-08-17 — Nascimento: coluna própria + backfill da Feegow (v0.4.0)

**Sessão anterior:** `2026-08-17-s1-e-recon-feegow.md`
**Decisão fechada:** a 1a do escopo (idade). Bloqueava o S2.

---

## A DECISÃO E O PORQUÊ

Escolhido **coluna própria semeada da Feegow**, não leitura on-demand.

O argumento que decidiu não foi economia: **a idade é regra de negócio nossa**
(`age_restriction`, dependente menor, elegibilidade por faixa). Ler on-demand da Feegow
cobre só os vinculados, deixa os 271 restantes permanentemente fora, não cobre cliente novo
e põe uma chamada externa no caminho de render de tela.

Achado que reforçou: varri `information_schema` no schema `public` inteiro por
`nasc|birth|idade|age|aniver` — **nenhuma tabela do banco** tinha nascimento, não só
`clientes`. Não existia origem interna nenhuma. As opções "puxar da Feegow" e "criar coluna"
do §6.2 colapsavam na mesma fonte; diferiam só em cachear ou não.

---

## O QUE FOI FEITO

### Banco (produção, `bhrxfudnhxqntnnbgyjg`)

Migração `add_data_nascimento_clientes`:
- `clientes.data_nascimento date`
- `clientes.data_nascimento_fonte text` — CHECK `feegow|cadastro|manual`
- CHECK de sanidade: `> 1900-01-01 and < current_date`

A coluna de **fonte** não é enfeite: sem ela não há como distinguir NULL "nunca tentamos" de
NULL "tentamos e a origem não tinha", e só o segundo caso precisa de ação humana.

Nota sobre o CHECK: usa `CURRENT_DATE`, que não é imutável. Verificado que a constraint
existiu de fato (`pg_get_constraintdef`, não o `success` da tool). Na prática é seguro aqui —
uma data válida hoje só fica mais no passado amanhã; o único caso que mudaria de lado seria
data futura virar válida, que não acontece.

### Backfill dos 538 vinculados

Resultado **medido**, não estimado:

```
538 lidos ... 531 com data · 4 vazias na origem · 3 sentinela `30-11--0001`
```

Os 7 sem data ficaram com `fonte='feegow'` e `data_nascimento` NULL — é o design da coluna
de fonte funcionando.

Estado final conferido por query (não por suposição):
`531 com_data · 7 tentado_sem_data · 271 nunca_tentado · 0 vinculados não processados`.

Script retomável em `scripts/backfill-nascimento.mjs`.

### App (v0.4.0)

- **`src/lib/idade.ts`** (novo): `idadeEm`, `lerRestricaoIdade`, `atendeFaixa`, `rotuloFaixa`.
  Puro, sem tela. É o alicerce que o S2 consome.
- `types.ts`: `Cliente.data_nascimento`.
- `data.ts`: campo no select e no mapeamento.
- Sem tela nova — o S2 não foi escrito nesta sessão.

Duas decisões de design dentro do módulo, as duas contraintuitivas:
1. `idadeEm` recebe a **data de referência** e não usa `new Date()` internamente. Quem faz 18
   na semana que vem muda de faixa: calcular "hoje" erraria a elegibilidade de um agendamento
   marcado para depois do aniversário.
2. `atendeFaixa` devolve **`null` para idade desconhecida, distinto de `false`**. `false` =
   "não atende, esconda"; `null` = "não sei, mostre com a faixa rotulada". Colapsar em `false`
   esconderia o pediatra de 100% dos dependentes; colapsar em `true` ofereceria horário que a
   Feegow recusa na confirmação.

---

## 🔴 O ACHADO QUE MUDA O S2

**Zero dos 44 dependentes ficou com data.** Todos os 44 estão entre os 271 sem
`feegow_paciente_id`, e dependente é exatamente quem pode ser criança.

O backfill cobriu **100% dos titulares vinculados e 0% do público pediátrico.** Nenhuma
quantidade de backfill via Feegow resolve isso — só a captura no cadastro (passo 3).

Consequência de projeto: o caminho "idade desconhecida" não é exceção rara a ser tratada com
empty state. É o caminho normal para todo o público pediátrico, e tem que mostrar o
profissional com a faixa rotulada.

Distribuição de quem tem data: **529 adultos, 2 menores de 16, idade média 51.** Pediatra é
ruído para 99,6% de quem já tem idade conhecida.

---

## PEGADINHAS DESCOBERTAS

- **Sentinela `30-11--0001`** (ano negativo) = "sem data" na Feegow, em 3 pacientes. `new Date()`
  nela **não dá erro**: dá data absurda que passaria pelo CHECK e viraria idade de dois mil
  anos. Foi o parser explícito que pegou.
- **`nascimento` vem em d-m-Y**, confirmado em chamada real. Já estava no §7 do recon, agora
  confirmado no volume.
- **Rate limit do MCP vem em JSON puro** `{"error":"rate limit"}`, **sem envelope SSE**. O
  primeiro lote perdeu 20 leituras porque o retry tratava isso como "dado ruim" em vez de
  "espere". Lotes de ~110 com 350ms entre chamadas: zero erro.
- **`nohup`/`&` não sobrevive entre chamadas de tool no container.** O primeiro run morreu em
  ~100 de 538 e perdeu tudo, porque só gravava no fim. Corrigido com checkpoint JSONL linha a
  linha — o trabalho passou a ser retomável em vez de tudo-ou-nada.
- **`pgrep -f <script>` dá falso positivo**: casa com o próprio shell que contém o nome na
  linha de comando. PID diferente a cada chamada era o sinal. Usar `ps -eo cmd | grep node`.
- Duas datas extremas são plausíveis, não lixo: `2026-03-06` (bebê de 5 meses) e `1923-01-27`
  (103 anos). Não "corrigir".
- **`tabela_id: 0` + `matricula: "PARTICULAR"`** num paciente vinculado ao DIM+. O §7 avisa
  que sem `tabela_id: 6` o agendamento nasce no particular cheio — ou seja, cobra preço cheio
  de quem tem desconto. **NÃO medido** (seriam 538 chamadas). Item próprio, e é dinheiro.

---

## ESTADO ATUAL

- v0.4.0, bump nos três lugares. `tsc --noEmit` limpo.
- `src/lib/idade.ts` validado por **34 casos executados**, incluindo d-m-Y rejeitado,
  sentinela rejeitada, véspera vs dia do aniversário, e dependente sem data recebendo `null`.
- Banco: migração e backfill aplicados em PRODUÇÃO e conferidos por query.
- ⚠️ **Nada validado em device.** Nenhuma tela mudou, então não há o que ver além da versão.
- ⚠️ O passo 3 (captura no cadastro) **NÃO foi feito** — é erp-dimplus, outro repo. Sem ele o
  buraco volta a crescer a partir do próximo cadastro.

---

## PRÓXIMOS PASSOS

- [ ] **Passo 3, no erp-dimplus:** nascimento obrigatório no cadastro do balcão e em
      `/api/public/app-cadastro`, com `fonte='cadastro'`. É o único caminho que cobre
      dependente e cliente novo. Sessão própria, outro repo.
- [ ] Decisão **1b** — `feegow_paciente_id` de teste (criar paciente sintético = escrita em
      produção, autorização à parte). Ainda aberta.
- [ ] Decisão **1c** — status das parcerias da Rede. Ainda aberta.
- [ ] S2 · tela de agendamento, consumindo `src/lib/idade.ts` e a §8 do FEEGOW-LEITURA.
- [ ] Medir `tabela_id` nos 538 antes de qualquer escrita (S4). É preço cobrado errado.
- [ ] S3 termo de aceite (bloqueio jurídico) · S5 build/submit.
- [ ] Dívidas adiadas: SOS, CNPJ.

## FORA DE ESCOPO
Tela do S2 · escrita na Feegow · WhatsApp · push · realtime · mock da Rede.

---

## PROMPT DE RETOMADA

```
v0.4.0 · repo dmgocupacional/dimplus-app · branch main
(NÃO confie em hash escrito aqui — rode `git log --oneline -5`.)

Leia primeiro:
- docs/FEEGOW-LEITURA.md                                   (§6.2-bis: idade RESOLVIDA)
- docs/sessions/2026-08-17-nascimento-coluna-e-backfill.md  (última sessão)
- docs/sessions/2026-08-17-s1-e-recon-feegow.md
- docs/sessions/2026-08-17-s0-contas-teste.md               (contas de teste)

CONTEXTO: app com auth por CPF (email sintético), máquina de sessão de 4 estados, 4 abas com
dado REAL do Supabase — exceto a Rede, que é mock declarado. O padrão de todo bug encontrado
até aqui é o MESMO: A TELA ASSUME UMA FORMA QUE O DADO NÃO GARANTE. Procure por isso.

Em 17/08 a decisão da IDADE foi FECHADA: `clientes.data_nascimento` + `data_nascimento_fonte`
criadas, e 531 dos 538 vinculados preenchidos a partir da Feegow. O consumo está pronto e
testado em `src/lib/idade.ts`. O S2 não depende mais disso.

🔴 MAS: os 271 sem feegow_paciente_id seguem sem idade, e os 44 DEPENDENTES estão TODOS nesse
grupo (0 com data). O público pediátrico é 100% do que ficou de fora. Logo "idade
desconhecida" NÃO é exceção rara: é o caminho normal da criança, e a tela tem que mostrar o
profissional com a faixa ROTULADA, nunca esconder nem empty state.

CONTA PARA TESTAR: CPF 55566677720 / senha DimPlus@2026 (única com histórico coerente).
Vence em 2028-07-29. Conta de teste NÃO é amostra da base: prova o fluxo, não o dado.

ESCOPO, em ordem:
1. DECISÕES ainda abertas do Henrique:
   a) feegow_paciente_id de teste — as 3 contas liberadas têm NULL, então o S2 nasce em empty
      state em 100% delas. Vincular exige criar paciente na Feegow = ESCRITA EM PRODUÇÃO,
      autorização à parte. NUNCA a paciente real (exporia agenda de terceiro).
   b) Rede — os 5 parceiros do mock são empresas reais NOMEADAS. Sem parceria assinada,
      ocultar via app_features.rede. Aguarda status.
2. S2 · Agendamento Feegow READ-ONLY. Leitura já validada por chamada real; a flag
   `agendamento` já existe em app_features, desligada — é ligar, não criar. A tela já nasce
   tendo que ter a forma da §8 do FEEGOW-LEITURA: especialidade ANTES do horário (payload sem
   filtro é inviável no device), horários por UNIDADE e não por sala, salas 26/27
   ("importado") fora, [] = sem vaga e não erro, age_restriction lido nas DUAS grafias,
   sentinelas 0/127 não exibidas, caminho tratado para os 271 sem vínculo.
   USAR src/lib/idade.ts — NÃO reimplementar cálculo de idade nem leitura de faixa.
3. PASSO 3 (outro repo, erp-dimplus): nascimento obrigatório no cadastro do balcão e em
   /api/public/app-cadastro, fonte='cadastro'. Único caminho que cobre dependente e cliente
   novo. Sem isso o buraco volta a crescer.
4. Medir tabela_id nos 538 ANTES de qualquer escrita: um paciente vinculado veio com
   tabela_id 0 / matricula PARTICULAR, e sem tabela_id 6 o agendamento cobra preço cheio de
   quem tem desconto. É dinheiro.
5. S3 termo de aceite — BLOQUEIO JURÍDICO: contrato_termos vazia, texto é decisão de
   advogado. Não redigir cláusula por conta própria.
6. S4 escrita na Feegow (só depois do S2 em device) · S5 build/submit.

DÍVIDAS ADIADAS (decisão do Henrique, registradas inline):
- SOS é TOQUE MORTO: flag ativa + rota null. Comentário em src/app/(tabs)/index.tsx.
- CNPJ/documento vazio em formatCPF/maskCPF. Comentário em src/lib/format.ts.

NÃO MEXER:
- `atendeFaixa` devolve null para idade desconhecida — NÃO colapsar em false nem true.
- `idadeEm` recebe a data de referência de fora — NÃO trocar por new Date() interno.
- Só ISO entra em idadeEm. A conversão d-m-Y da Feegow é do backfill, não de runtime.
- PagamentoStatus é união ABERTA de propósito (| (string & {})). NÃO FECHAR.
- O `default` do rotuloStatus é intocável, mesmo parecendo exaustivo.
- O `.trim() ||` do data.ts: NÃO voltar para `??` — 147 registros têm string vazia.
- DELETED permanece visível como "cancelada".
- SDK 54 é teto; runtimeVersion.policy = "sdkVersion" intocável.
- Sem realtime e sem push. Aprovação de contrato e RBAC ficam no erp-dimplus.

REGRAS:
- Nada de código sem "vai" explícito.
- Schema-first via Supabase MCP (bhrxfudnhxqntnnbgyjg) antes de código de dados.
- Ler o arquivo inteiro antes de afirmar qualquer coisa sobre ele.
- "Funcionou"/"quebrou" NÃO valem sem a versão junto — conferir a aba Perfil primeiro.
- Bug de dado se acha por contagem no banco, não por varredura em device.
- Bump em TRÊS lugares no mesmo commit: src/lib/version.ts + package.json + app.json.
- Sentinelas da Feegow: `30-11--0001` em nascimento, `0`/`127` em age_restriction. Nenhuma
  dá erro se ignorada — todas dão dado errado em silêncio.
- Rate limit do MCP Feegow vem em JSON puro sem envelope SSE. Lotes de ~110.
- `nohup`/`&` NÃO sobrevive entre chamadas de tool no container: rodar em foreground com
  checkpoint. `pgrep -f <script>` dá falso positivo com o próprio shell.
- feegow_agendamentos/historico SEM paciente_id devolve dado de paciente REAL.
- feegow_criar_agendamento escreve na agenda de PRODUÇÃO que a recepção vê.
```
