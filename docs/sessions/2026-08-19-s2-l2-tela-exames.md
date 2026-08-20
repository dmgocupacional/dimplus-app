# S2-L2 — Tela de exames (19/08/2026)

## O que foi feito

Primeiro consumidor real do helper `chamarFeegow` (S2-L1). Leitura pura, sem escrita, sem
`age_restriction`.

- **`src/lib/types.ts`**: tipos `PedidoExame` e `Laudo`.
- **`src/lib/exames.ts`** (novo, separado de `data.ts` de propósito — este fala HTTP com o
  erp, `data.ts` fala Supabase direto): `getPedidosExame()`, `getLaudos()`, `getUrlLaudo()`.
  Normalização defensiva: item sem `PedidoExameID`/`lab_report_id` numérico é descartado
  (não quebra a lista); `ObservacaoPedido` tem as tags HTML removidas antes de exibir.
- **`src/app/exames.tsx`** (novo): 4 estados — carregando, erro (com mensagem por tipo,
  nunca genérica), laudos prontos (toca pra abrir PDF via `Linking.openURL`), pedidos
  solicitados.
- **`src/app/(tabs)/index.tsx`**: tile "Exames" passou a ter `rota: '/exames'` (antes era
  `null` porque a tela não existia — achado durante o plano: o comentário dizia que a flag
  `exames` estava `ativo=false`, o que ficou desatualizado desde 18/08, e o tile já estava
  caindo no mesmo bug de "toque morto" documentado no `sos`).

## Lacuna real, registrada e não inventada

**Não existe campo de nome do exame confirmado** em `PedidoExameID`/`ExameID`/etc. — nem
no `docs/FEEGOW-API.md` do erp (usa reticências), nem em nenhuma sessão anterior (grep
feito no repo do erp antes de codar). `extrairNomeExame()` em `exames.ts` tenta 5 nomes de
campo candidatos (mesmo padrão defensivo de `extrairIdsAgendamento` no
`app-feegow-guard.ts` do erp) e cai para `null` → a tela mostra "Exame #{id}". Quando
algum lote futuro conseguir ver um `pedido` real, confirmar o campo certo e simplificar
`extrairNomeExame` para um único acesso direto — a lista de candidatos é dívida assumida,
não solução definitiva.

## Estado atual — o que foi provado ao vivo, e o que não foi

✅ **Provado ao vivo** (conta de teste, CPF 55566677720, mesma sessão): `GET
.../exames/pedidos` e `GET .../exames/laudos` → ambos `404`
`{"error":"CPF sem cadastro na clínica."}`. Isso significa que **hoje, com a conta de
teste, abrir `/exames` mostra direto o card de erro "Não encontramos seu cadastro na
clínica..."** — comportamento correto, não é bug, é o mesmo caso do L1.

✅ **Provado em Node** (não no device): as funções puras de normalização
(`extrairNomeExame`, `normalizarPedido`) não quebram com o shape confirmado da doc
(campos PascalCase, `ObservacaoPedido` com HTML) nem com item malformado (sem id vira
`null` e é filtrado da lista).

❌ **NÃO provado**: o caminho de SUCESSO da tela (laudos/pedidos aparecendo de fato) —
não existe hoje um CPF de teste com cadastro real na Feegow. `getUrlLaudo` e o fluxo de
abrir PDF (`Linking.openURL`) também não foram exercitados com URL real. Fica como
**dívida explícita**: primeiro cliente real que abrir `/exames` é quem vai provar esse
caminho pela primeira vez.

tsc --noEmit: verde. `expo export --platform web`: verde, rota `/exames` aparece nas 19
rotas estáticas geradas.

## Decisões tomadas

- `exames.ts` separado de `data.ts` — fonte de dado diferente (HTTP autenticado vs.
  Supabase+RLS), não misturar no mesmo arquivo.
- Nome do exame: fallback defensivo, nunca inventar um campo como certo.
- Tile da Home corrigida para apontar pra tela nova — sem isso, a tela ficaria
  inalcançável pela navegação normal (só por link direto).

## Próximos passos

- S2-L3 — agendamento, leitura (`opcoes` + `disponibilidade` + "meus agendamentos"). Aqui
  entram os itens 1–7 do §8 do `FEEGOW-LEITURA.md`: sentinelas, as duas grafias de
  `age_restriction`, salas 26/27 fora, e o caminho de "idade desconhecida" como NORMAL
  (46/46 dependentes sem nascimento).
- Quando houver CPF de teste com cadastro real: validar visualmente pedidos/laudos reais
  e confirmar o campo de nome do exame.

## Pegadinhas descobertas

- Conta de teste (CPF 55566677720) não tem `feegow_paciente_id`/cadastro na clínica —
  qualquer rota pessoal de exame/agendamento vai dar 404 com ela. Não é regressão se um
  lote futuro rodar smoke test e ver 404 de novo; é o estado real dessa conta.
