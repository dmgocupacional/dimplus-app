# 2026-08-17 — S-C dependentes + fix de segurança (v0.5.0 → v0.5.1)

**Sessão anterior:** `2026-08-17-nascimento-coluna-e-backfill.md`
**Fecha:** decisão 1a (idade, na sessão anterior) e a sprint S-C.

---

## 🔴 O MAIS IMPORTANTE: FIX DE SEGURANÇA (P0, já aplicado)

Ao ir consumir `fn_dependentes_situacao` para a S-C, descobri que ela,
`fn_dependentes_qtd` e `fn_cliente_titular` são `SECURITY DEFINER`, **recebem o titular como
PARÂMETRO** e estavam com `EXECUTE` concedido a **`public`, `anon` e `authenticated`**.

Impacto: com a chave pública do app — **inclusive sem estar logado** (`anon`) — bastava
passar um uuid arbitrário para ler `plano_nome`, `limite`, `usados`, `politica` e
`valor_excedente` de **outro titular**. Função `SECURITY DEFINER` ignora RLS: quem chama
escolhe de quem quer ler.

É a mesma classe do fix já feito em `fn_mover_estagio_lead`, e a regra do projeto já dizia:
**toda `SECURITY DEFINER` exige REVOKE explícito de public/anon/authenticated.**

Antes de aplicar, verifiquei quem chamava: só
`erp-dimplus/src/app/api/clientes/[id]/dependentes/route.ts`, via `createAdminClient`
(**service role**, que ignora grants). Por isso o REVOKE **não derruba o ERP** — confirmado
por query depois: `service_role` = true, o resto = false.

---

## O QUE FOI ENTREGUE

### Banco (produção, `bhrxfudnhxqntnnbgyjg`)

1. `revoke_execute_dependentes_secdef` — REVOKE nas três funções acima.
2. `rpc_app_meus_dependentes` — `fn_app_meus_dependentes()`.

**A RPC é SEM PARÂMETRO de propósito.** O titular sai do `auth.uid()` DENTRO da função (e
sobe para o titular se quem loga for dependente). É o parâmetro que era o furo; a função nova
não o recria. REVOKE de public/anon, GRANT só para `authenticated`.
Devolve **apenas dado cadastral** — nunca exame, agenda ou financeiro.

**Canária em transação REVERTIDA contra produção** (não simulação):
- sem sessão → **0 linhas, sem erro** (é o estado correto, não falha)
- com sessão de titular real → **5 dependentes, limite 5, usados 5, `pode_adicionar` true**,
  política `cobrar`, `com_data` 0, `liberados` 0
- rollback conferido: titular de volta a `user_id` null, dono original intacto, 3 logins como
  antes. Zero resíduo.

`user_id` tem FK para `auth.users` — não dá para inventar uuid na canária; emprestei um real
dentro da transação.

### App
- `types.ts`: `Dependente`, `DependentesSituacao`.
- `data.ts`: `getMeusDependentes()`. Devolve `{lista: [], situacao: null}` em vez de lançar —
  sessão sem cliente e titular sem dependente são estados legítimos.
  ⚠️ `numeric` do Postgres chega como **string** no supabase-js; `Number()` na fronteira evita
  `"29.90"` concatenar em vez de somar.
- `src/app/dependentes.tsx`: tela de leitura. **Rota EMPILHADA, não aba** — qualquer arquivo
  em `(tabs)/` viraria uma quinta aba automaticamente, e o número de abas é decisão de
  produto. Entrada pelo Perfil, padrão de `/ajuda`.
- Registro da rota em `src/app/_layout.tsx`.

Sem botão de adicionar: a inclusão é a S-D. Tile que parece aberto e não faz nada é a dívida
do SOS — melhor dizer o caminho real (central).

---

## ACHADOS

- 🔴 **Nenhum dos 18 titulares com dependentes tem `user_id`.** A tela abre vazia em **100%
  dos casos reais**. O estado vazio é o caminho PRINCIPAL, não a exceção — tratá-lo como erro
  repetiria a tela preta da v0.3.3.
- **Zero dos 44 dependentes tem nascimento** (herdado da sessão anterior): a classificação
  menor/maior é hoje inverificável.
- **6 titulares exatamente no limite** (3 SAG/`barrar`, 3 PLUS/`cobrar`).
- `pode_adicionar` vem **`true` no limite** quando a política é `cobrar` — e aí o próximo
  custa R$ 29,90/mês. A tela diz o valor ANTES de qualquer ação.
- `size.md` **não existe** nos tokens (escala é `xs/sm/base/lg/xl/xxl`). Pego pelo `tsc`.

---

## VALIDAÇÃO

- `tsc --noEmit` limpo.
- 14 casos de lógica de exibição executados: moeda, idade nula (caso normal), plural/singular,
  subtítulo que SOME em vez de virar `— · —`, limite que não fica negativo, e SAG no limite
  que **não** cobra.
- Canária de banco acima.
- ⚠️ **Nada validado em device.**

---

## ESTADO

- **v0.5.1**, bump nos três lugares. Commits: `57f53b4` (v0.5.0, banco + dados) e `b5c7ed6`
  (v0.5.1, tela).
- `erp-dimplus` também recebeu commit nesta sessão: **`8cd6412`**, docs-only, registrando que
  a decisão de 20/07 sobre assinatura Asaas foi contestada.

---

## PRÓXIMOS PASSOS

- [ ] **S2 · agendamento Feegow** — desbloqueado desde que a idade foi resolvida. É a maior
      tela do app; merece sessão limpa.
- [ ] **Decisão do Henrique sobre a S-A** (ver `docs/ROADMAP-DEPENDENTES.md`): não existe
      sandbox do Asaas, e a decisão de 17/08 conflita com a de 20/07. Proposta pendente: a
      aprovação do staff vira o "gatilho manual com preview".
- [ ] **S-B** (nascimento obrigatório no cadastro) — `erp-dimplus`, lidera a fila.
- [ ] Decisões ainda abertas: `feegow_paciente_id` de teste (escrita em produção) e status das
      parcerias da Rede.
- [ ] Medir `tabela_id` nos 538 antes de qualquer escrita no S4 — é preço cheio cobrado de
      quem tem desconto.
- [ ] Migrar o `ROADMAP-APP.md` do erp para este repo (4 pontos do código apontam para um
      arquivo que não existe aqui). Lote próprio.

## FORA DE ESCOPO
Inclusão de dependente (S-D) · aprovação (S-E) · login do dependente (S-F) · cobrança do
excedente (S-A, bloqueada) · escrita na Feegow · push · realtime.

---

## PROMPT DE RETOMADA

```
v0.5.1 · repo dmgocupacional/dimplus-app · branch main
(NÃO confie em hash escrito aqui — rode `git log --oneline -5`.)

Leia primeiro:
- docs/ROADMAP-DEPENDENTES.md                              (sprints S-A..S-F + conflito aberto)
- docs/FEEGOW-LEITURA.md                                   (§6.2-bis: idade RESOLVIDA · §8: forma do S2)
- docs/sessions/2026-08-17-sc-dependentes-e-fix-seguranca.md  (última sessão)
- docs/sessions/2026-08-17-nascimento-coluna-e-backfill.md
- docs/sessions/2026-08-17-s1-e-recon-feegow.md

CONTEXTO: app com auth por CPF (email sintético), máquina de sessão de 4 estados, 4 abas com
dado REAL do Supabase — exceto a Rede, que é mock declarado. O padrão de TODO bug encontrado
até aqui é o mesmo: A TELA ASSUME UMA FORMA QUE O DADO NÃO GARANTE. Procure por isso.

Em 17/08 foram fechados: a idade (clientes.data_nascimento + backfill de 531/538, consumo em
src/lib/idade.ts) e a S-C (leitura de dependentes, com fix de segurança P0 em três funções
SECURITY DEFINER que estavam abertas para anon).

CONTA PARA TESTAR: CPF 55566677720 / senha DimPlus@2026. Vence em 2028-07-29.
Conta de teste NÃO é amostra da base: prova o fluxo, não o dado. Bug de dado se acha por
contagem no banco, não por varredura em device.

ESCOPO, em ordem:
1. S2 · Agendamento Feegow READ-ONLY (maior item aberto). Leitura já validada por chamada
   real; a flag `agendamento` já existe em app_features, desligada — é ligar, não criar.
   A tela já nasce tendo que ter a forma da §8 do FEEGOW-LEITURA: especialidade ANTES do
   horário (payload sem filtro é inviável no device), horários por UNIDADE e não por sala,
   salas 26/27 ("importado") fora, [] = sem vaga e não erro, age_restriction lido nas DUAS
   grafias, sentinelas 0/127 não exibidas, caminho tratado para os 271 sem vínculo.
   USAR src/lib/idade.ts — NÃO reimplementar cálculo de idade nem leitura de faixa.
   ⚠️ As 3 contas de teste têm feegow_paciente_id NULL → o S2 nasce em empty state em 100%
   delas. Vincular exige criar paciente na Feegow = ESCRITA EM PRODUÇÃO, autorização à parte.
2. DECISÕES abertas do Henrique:
   a) S-A (cobrança do excedente) está BLOQUEADA: não existe sandbox do Asaas e a decisão de
      17/08 conflita com a de 20/07 (gatilho manual, nunca automático). Proposta pendente no
      ROADMAP-DEPENDENTES.
   b) feegow_paciente_id de teste.
   c) Rede — os 5 parceiros do mock são empresas reais NOMEADAS. Sem parceria assinada,
      ocultar via app_features.rede.
3. S-B (nascimento obrigatório no cadastro) — outro repo (erp-dimplus), lidera a fila de lá.
4. Medir tabela_id nos 538 ANTES de qualquer escrita: um vinculado veio tabela_id 0 /
   matricula PARTICULAR, e sem tabela_id 6 o agendamento cobra preço cheio de quem tem
   desconto. É dinheiro.
5. S3 termo de aceite — BLOQUEIO JURÍDICO: contrato_termos vazia, texto é de advogado.
6. S4 escrita na Feegow (só depois do S2 em device) · S5 build/submit.

DÍVIDAS ADIADAS (decisão do Henrique, registradas inline):
- SOS é TOQUE MORTO: flag ativa + rota null. Comentário em src/app/(tabs)/index.tsx.
- CNPJ/documento vazio em formatCPF/maskCPF. Comentário em src/lib/format.ts.

NÃO MEXER:
- fn_app_meus_dependentes() é SEM PARÂMETRO de propósito. NÃO "simplificar" chamando
  fn_dependentes_situacao direto do app — o parâmetro é o furo que foi fechado.
- Toda SECURITY DEFINER nova exige REVOKE de public/anon/authenticated no MESMO commit.
- `atendeFaixa` devolve null para idade desconhecida — NÃO colapsar em false nem true.
- `idadeEm` recebe a data de referência de fora — NÃO trocar por new Date() interno.
- Só ISO entra em idadeEm; a conversão d-m-Y da Feegow é do backfill, não de runtime.
- Tela de dependentes é rota EMPILHADA. NÃO mover para (tabs)/ — viraria uma quinta aba.
- Dependente NÃO tem financeiro (asaas_id NULL por CHECK): lista vazia ali é CORRETA.
- PagamentoStatus é união ABERTA de propósito (| (string & {})). NÃO FECHAR.
- O `default` do rotuloStatus é intocável, mesmo parecendo exaustivo.
- O `.trim() ||` do data.ts: NÃO voltar para `??` — 147 registros têm string vazia.
- DELETED permanece visível como "cancelada".
- SDK 54 é teto; runtimeVersion.policy = "sdkVersion" intocável.
- Sem realtime e sem push. Aprovação de contrato e RBAC ficam no erp-dimplus.
- NUNCA recalcular limite/valor de dependente no app: vem de fn_dependentes_situacao, e os
  números são editáveis em /dashboard/planos do ERP.

REGRAS:
- Nada de código sem "vai" explícito.
- Schema-first via Supabase MCP (bhrxfudnhxqntnnbgyjg) antes de código de dados.
- Ler o arquivo inteiro antes de afirmar qualquer coisa sobre ele.
- "Funcionou"/"quebrou" NÃO valem sem a versão junto — conferir a aba Perfil primeiro.
- Bump em TRÊS lugares no mesmo commit: src/lib/version.ts + package.json + app.json.
- 1 conversa = 1 repo. erp-dimplus pede sessão própria.
- Sentinelas da Feegow: `30-11--0001` em nascimento, `0`/`127` em age_restriction. Nenhuma
  dá erro se ignorada — todas dão dado errado em silêncio.
- Rate limit do MCP Feegow vem em JSON puro sem envelope SSE. Lotes de ~110.
- `nohup`/`&` NÃO sobrevive entre chamadas de tool no container: foreground + checkpoint.
  `pgrep -f <script>` dá falso positivo com o próprio shell.
- Canária = transação com ROLLBACK contra produção, e conferir o resíduo depois.
- feegow_agendamentos/historico SEM paciente_id devolve dado de paciente REAL.
- feegow_criar_agendamento escreve na agenda de PRODUÇÃO que a recepção vê.
```
