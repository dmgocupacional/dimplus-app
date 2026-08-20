# S2-L4 — Agendamento, escrita: cancelar e remarcar (19/08/2026)

## Escopo entregue (e o que ficou de FORA, deliberadamente)

Primeira ESCRITA do app em sistema de terceiro. **Criar agendamento NÃO está neste
lote** — bloqueado por dois problemas do lado do `erp-dimplus` (fora deste repo,
`1 conversa = 1 repo`):

1. `POST /api/feegow/agendamento` exige `procedimento_id`, mas **não existe nenhuma
   rota `/api/feegow/*procedimento*` exposta pro app** — confirmado por `find` completo
   em `src/app/api/feegow/` do erp antes de codar: só existem `opcoes`, `disponibilidade`,
   `agendamento` (GET/POST), `cancelar`, `reagendar`, `exames/*`, `conciliacao/*`.
2. Mesmo se o app tivesse o `procedimento_id`, a rota `POST /agendamento` do erp
   **não passa `tabela_id`** pra `criarAgendamentoFeegow` — o próprio comentário do
   `catalogo.ts` do erp avisa que sem isso o agendamento nasce no PARTICULAR CHEIO,
   cobrando de quem tem desconto DIM+ o preço de quem não tem.

Construir "criar" hoje seria ou inventar um `procedimento_id` (proibido — nunca chuto
valor de negócio) ou entregar uma tela que cobra errado de cliente real. Nenhum dos dois
é aceitável. Fica registrado aqui pra quando o `erp-dimplus` resolver os dois pontos
(rota de procedimentos pro app + `tabela_id` no POST).

## O que foi feito

- **`src/lib/agendamento.ts`**:
  - `getDisponibilidade` refatorada pra aceitar filtros (`especialidadeId` e/ou
    `profissionalId`) em vez de só especialidade — necessário pra remarcar buscar só os
    horários de UM profissional específico, sem baixar o payload gigante da agenda toda.
  - `cancelarAgendamento(agendamentoId, obs?)` e `reagendarAgendamento(agendamentoId,
    data, horario)` — chamam `POST /api/feegow/agendamento/cancelar` e `/reagendar`.
  - `MeuAgendamento` ganhou `profissionalId` (extração defensiva, mesmos candidatos de
    campo do padrão já usado pro `id`).
- **`src/app/meus-agendamentos.tsx`** (reescrita): cada agendamento com status "ativo"
  (1=não confirmado, 7=confirmado) ganha botões Cancelar e, quando `profissionalId` foi
  extraído com sucesso, Remarcar. Sub-fluxo de remarcação vive dentro da mesma tela
  (não é navegação): busca horários do MESMO profissional, lista, confirma, chama a API.
- **`src/app/agendar.tsx`**: só ajuste de assinatura pra acompanhar o `getDisponibilidade`
  refatorado (`{ especialidadeId }` em vez do argumento posicional).

## Decisões de segurança/produto tomadas

- **Confirmação obrigatória** antes de cancelar ou remarcar (`Alert.alert`, nativo do
  RN — sem dependência nova). Cancelar usa `style: 'destructive'`.
- **Sem checagem de posse redundante no app.** A posse é verificada no SERVIDOR
  (`pacientePossuiAgendamento`, fail-closed) — o app só repassa o `agendamento_id` que
  já veio filtrado pra este cliente. Reimplementar a checagem no cliente seria
  redundante e daria falsa sensação de segurança (o app não vê a lista "crua"
  suficiente pra validar isso de verdade).
- **Ações só aparecem pra status "ativo" conhecido** (1 ou 7) — se `statusId` vier
  `null` (campo não confirmado) ou for um status já terminal (cancelado, atendido,
  etc.), os botões não aparecem. Preferi esconder a ação a arriscar oferecer cancelar
  algo que já não pode ser cancelado.
- **Remarcar sem `profissionalId`**: botão não aparece. Caminho alternativo é cancelar
  e marcar de novo por `/agendar` — não tentei contornar a ausência do campo.

## Estado — provado ao vivo vs. dívida

✅ **Provado ao vivo** (conta de teste, sem tocar em nenhum agendamento real):
`POST cancelar` e `POST reagendar` com `agendamento_id` inexistente (999999) → ambos
`404 "CPF sem cadastro na clínica."`, EXATAMENTE o mesmo padrão de erro dos outros
endpoints pessoais (L1-L3) — confirma que o guard falha na resolução do paciente antes
até de chegar na checagem de posse. Prova que o helper transmite `Authorization` +
`Content-Type: application/json` + corpo corretamente (a rota processou a requisição
e respondeu com o erro esperado, não com 400 de payload inválido).

❌ **NÃO provado, e não dá pra provar com segurança**: o caminho de SUCESSO — cancelar
ou remarcar um agendamento real. Isso exigiria ter um agendamento de teste de verdade na
agenda da clínica, e criar um só pra isso mexeria na agenda de produção sem necessidade
de negócio. Fica como dívida explícita: o primeiro cancelamento/remarcação reais vão ser
a primeira prova de comportamento desse caminho.

❌ **NÃO provado**: a tela nunca rodou em device/simulador, só tsc + `expo export
--platform web` (verde, `/meus-agendamentos` gerada). O fluxo de `Alert.alert` e a
navegação interna de remarcação (sem `expo-router`, só estado local) não foram vistas
rodando de verdade.

tsc --noEmit: verde. `expo export --platform web`: verde, 21 rotas.

## Próximos passos

- **Fora deste repo**: no `erp-dimplus`, criar rota de catálogo de procedimentos pro app
  + corrigir `POST /agendamento` pra passar `tabela_id` (provavelmente 6, "DIM+ Básico
  Plus" — confirmar). Só depois disso faz sentido voltar pro S2 e construir "criar
  agendamento".
- Quando existir agendamento de teste real: validar cancelar/remarcar de ponta a ponta,
  inclusive o efeito na disponibilidade (a doc confirma que cancelamento libera o slot).
- S2 está, na prática, no limite do que dá pra fazer sem apoio do lado do erp. O próximo
  trabalho de agendamento depende de decisão e código lá, não aqui.
