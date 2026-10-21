# 2026-10-21 — Agendamento: pré-agendamento, unidade visível e pagamento pendente

App v4.41.0 (OTA no canal `preview`). Depende do erp-dimplus v0.467.0 (rota
`/api/feegow/agendamento/cobertura`, nota de pré-agendamento, `motivo` no 403). O pente fino completo,
com as medições ao vivo, está em `erp-dimplus/docs/sessions/2026-10-21-agendamento-pre-pagamento.md`.

## Registro corrente

### Decisões do Henrique
- Agendar pelo app é **PRÉ-AGENDAMENTO**: sem consulta inclusa, o paciente paga na recepção, no dia.
  Isso precisa ficar claro no app e no sistema (houve ruído na clínica).
- Com consulta inclusa: o app sinaliza na hora de agendar e dentro do app.

### Feito
- `novo-agendamento.tsx`
  - grupo = médico + UNIDADE (prof 44 atende em Osasco, Itapevi e Carapicuíba; antes tudo caía na
    unidade do primeiro horário e o cliente marcava na cidade errada);
  - a agenda é filtrada pela unidade escolhida;
  - 📍 unidade no calendário, nos horários e na confirmação;
  - aviso fixo de pré-agendamento na escolha da especialidade;
  - "Confirmar pré-agendamento?" com inclusa/valor DIM+; botão "Pré-agendar";
  - aviso de sucesso usa a cobertura devolvida pelo erp (fonte da verdade).
- `meus-agendamentos.tsx` — 📍 unidade em cada item; faixa "Pré-agendado pelo app · pagamento
  pendente" (ou "Pagamento pendente") quando o agendamento não usa inclusa; remarcação oferece só a
  MESMA unidade (agendamento sem unidade conhecida mostra tudo).
- `feegowApi.ts` — novo tipo `pagamento_pendente` (403 com `motivo`): mensagem com o WhatsApp oficial
  no lugar de "disponível em breve".
- `agendamento.ts` / `types.ts` — `getCobertura`, `textoCobertura`, `veioDoApp`; `MeuAgendamento` ganha
  `unidadeNome`, `unidadeId`, `notas`.

### Validação
- `tsc --noEmit` limpo; `expo export --platform web` ok; lint igual ao de antes (13 erros
  pré-existentes, nenhum novo).

### Pendências
- Telefone do WhatsApp segue duplicado (agora também em `feegowApi.ts`) — vale uma fonte única.
- A cobertura não é recalculada se o cliente fica muito tempo na confirmação; o erp recalcula na
  criação, e o aviso de sucesso mostra o que valeu.

### 🔴 Pegadinha (custou um OTA falho)
- `npx expo lint` sem eslint instalado INSTALA `eslint` + `eslint-config-expo` e os escreve no
  `package.json` (e cria `eslint.config.js`). Isso entrou no commit d0f9965 sem lockfile e o
  `npm ci` do workflow `Publicar no Expo Go` quebrou ("Missing … from lock file"). Revertido no commit
  seguinte. Para validar lint aqui: não rodar `expo lint` solto, ou descartar `package.json`/lock/config
  antes do `git add`.
