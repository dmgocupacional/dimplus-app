# S2-L3 — Agendamento, leitura (19/08/2026)

## O que foi feito

- **`src/lib/types.ts`**: `Especialidade`, `Unidade`, `LocalAgenda`, `Profissional`,
  `SlotDisponibilidade`, `MeuAgendamento`.
- **`src/lib/agendamento.ts`** (novo, mesmo padrão de `exames.ts`): `getOpcoes()`,
  `getDisponibilidade()`, `getMeusAgendamentos()`.
- **`src/app/agendar.tsx`** (novo): escolhe especialidade → mostra horários dos próximos
  `JANELA_DISPONIBILIDADE_DIAS=21` dias, agrupados por UNIDADE (nunca sala) e por
  profissional, com a faixa etária tratada via `idade.ts` já existente.
- **`src/app/meus-agendamentos.tsx`** (novo): lista de agendamentos, com extração
  defensiva de campo (shape não confirmado — ver abaixo).
- **`(tabs)/index.tsx`**: tile "Agendar" passou a ter `rota: '/agendar'` (mesmo achado do
  L2 — estava `null` com a flag já `ativo=true`, mesmo bug de "toque morto" do `sos`).
  Comentário do `sos` atualizado pra não citar mais `agendamento` como pendente.

## 🔴 Dois bugs reais achados e corrigidos SÓ porque testei contra dado real, não só tsc

Isso é exatamente o "verde de tsc/build não prova comportamento" do protocolo — os dois
bugs abaixo compilavam limpo e só apareceram rodando contra a API de verdade:

1. **`age_restriction` do catálogo (`opcoes.profissionais[]`) vem ANINHADO**:
   `{ age_restriction: { idade_minima, idade_maxima } }`, não como campos soltos no
   objeto do profissional. Minha primeira versão lia `item.idade_minima` direto → 0 de
   100 profissionais tinham faixa lida. Corrigido: agora lê `item.age_restriction.*`.
2. **O nível de topo de `disponibilidade` é literalmente `{"profissional_id": {...}}`** —
   a chave do objeto de fora é o texto fixo `"profissional_id"`, e os ids de profissional
   de verdade ficam UM nível dentro disso. Minha primeira versão tratava o objeto de fora
   como se já fosse `{<id>: {...}}` → 0 slots achatados sempre. Corrigido: agora desembrulha
   `cru.profissional_id` primeiro. Isso bate com o que o §3 do `FEEGOW-LEITURA.md` já
   descrevia — eu tinha lido a doc mas escorregado na implementação; só o teste contra
   dado real pegou.

Depois da correção, provado com **14.503 slots achatados** pra "Alergologia e
Imunologia" numa janela de 21 dias, **58 de 100 profissionais com faixa etária lida
corretamente**, e confirmado que nenhum slot em sala 26/27 vaza (`localId === 26 || 27`
checado explicitamente no teste, zero ocorrências).

## Estado atual — provado ao vivo vs. não provado

✅ **Provado ao vivo** (conta de teste, script em `/tmp/test_agendamento2.mjs`, não
versionado):
- `opcoes`: 38 de 39 especialidades exibíveis (`exibir_agendamento_online=1`), 51 de 53
  locais válidos (26/27 filtrados corretamente), 6 unidades, 100 profissionais, faixa
  etária lida certo em 58 deles.
- `disponibilidade` pra Alergologia: 14.503 slots reais, agrupados em 77 profissionais
  com horário, distribuídos em 5 unidades distintas nos slots.
- Agrupamento por profissional/unidade replicado em Node com a mesma lógica de
  `agendar.tsx` — funciona com o volume real.

✅ **Provado em Node** (não device): `tipoPorStatus`/normalização básica seguem os
mesmos padrões já testados no L1/L2.

❌ **NÃO provado**: `GET /api/feegow/agendamento` (meus agendamentos) segue dando `404`
"CPF sem cadastro na clínica" pra conta de teste — **mesmo shape não confirmado do L2**,
`MeuAgendamento` usa extração defensiva de campo (`agendamento_id`/`id_agendamento`/
`id`/`appoint_id`, e o mesmo padrão pra data/horário/status/nomes), espelhando a
incerteza que o próprio `app-feegow-guard.ts` do erp já assume. **Fica dívida** até
algum cliente real ter agendamento pra ver o shape de verdade.

❌ **NÃO provado**: a tela `agendar.tsx` nunca rodou no device/simulador, só tsc +
`expo export --platform web` (verde, rotas `/agendar` e `/meus-agendamentos` geradas).
O cálculo de idade (`idadeEm`/`atendeFaixa`) usa `cliente.data_nascimento` da sessão —
como a conta de teste não tem cadastro na Feegow, não há como ver o efeito real do
filtro de faixa etária escondendo/mostrando profissionais nessa conta.

tsc --noEmit: verde. `expo export --platform web`: verde, 21 rotas.

## Decisões tomadas

- Janela de disponibilidade: 21 dias (fixo em `JANELA_DISPONIBILIDADE_DIAS`,
  `agendamento.ts`) — trade-off entre payload grande (§2 do doc) e mostrar "sem horário"
  com frequência. Ajustável, não é contrato da API.
- Idade calculada na data de CADA slot (`idadeEm(nascimento, dataUtc(slot.data))`), não
  "hoje" — segue a regra do `idade.ts` de que quem faz aniversário na janela muda de
  faixa.
- `atendeFaixa === false` esconde o profissional de verdade; `null` (idade desconhecida)
  MOSTRA com o rótulo da faixa — implementado exatamente como o item 5 do §8 exige.
- `agendamento.ts` separado de `exames.ts`/`data.ts` — mesmo raciocínio de fonte de dado.

## Próximos passos

- S2-L4 — agendamento, ESCRITA (criar/cancelar/reagendar). Primeira escrita em sistema
  de terceiro; a recepção vê. Precisa confirmar o campo de id de `appoints/search` antes
  de construir a tela de cancelar (mesmo aviso do ROADMAP-APP) — e agora sei, por
  experiência própria nesta sessão, que **não posso confiar em nome de campo sem testar
  contra dado real**, mesmo quando a doc parece clara.
- Quando existir CPF de teste com cadastro real: validar visualmente `agendar.tsx` no
  device, ver o shape real de "meus agendamentos", e simplificar a extração defensiva de
  `MeuAgendamento` para os campos certos.

## Pegadinhas descobertas (novas, além das já documentadas no FEEGOW-LEITURA.md)

- `opcoes.profissionais[].age_restriction` é objeto aninhado, não campos soltos —
  registrado agora porque a doc do erp não deixava isso claro na descrição do endpoint
  `opcoes` (só descrevia o formato geral do endpoint `disponibilidade`).
- `disponibilidade` tem uma camada de envelope a mais do que uma leitura rápida do §3
  sugere: `{"profissional_id": {...}}` no topo, não os ids direto. Vale reler o §3 com
  atenção redobrada da próxima vez.
