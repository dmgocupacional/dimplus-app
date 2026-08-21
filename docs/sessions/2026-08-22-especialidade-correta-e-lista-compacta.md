# 22/08/2026 — Especialidade correta no histórico/lista + lista compacta de especialidades

## O que foi feito

Sessão trabalhando os dois repos juntos (erp-dimplus + dimplus-app). Ver
`erp-dimplus/docs/sessions/2026-08-22-lote-5-frentes-poda-em-lote.md` para o
lote completo (5 frentes + bug reproduzido ao vivo). Este handoff cobre só a
parte do dimplus-app.

**Fix — especialidade exibida errada.** `commit a418ec5`, v0.13.3 → v0.13.4.
A Feegow envia `especialidade_id` em todo agendamento (`appoints/search`),
mas `normalizarMeuAgendamento` (`src/lib/agendamento.ts`) não capturava esse
campo — só tentava ler um nome de texto que a Feegow nunca manda. As duas
telas (`meus-agendamentos.tsx`, `historico-agendamentos.tsx`, código
duplicado) caíam sempre no fallback: primeira especialidade do profissional
na lista, que pode estar errada quando ele atende mais de uma (ex.: exibir
"Cardiologia" numa consulta de Geriatria).

Corrigido: `MeuAgendamento` ganhou o campo `especialidadeId`; as duas telas
cruzam esse id com o catálogo de especialidades **primeiro**; só caem no
palpite por profissional se a Feegow não mandar nem o id (rede de segurança,
mantida, não removida).

**Feature — lista compacta acima de 6 especialidades.** `commit 349975d`,
v0.13.4 → v0.14.0. `novo-agendamento.tsx`. A grade de blocos de dois por
linha foi desenhada para poucas especialidades; com as 31 destravadas na
sessão anterior (v0.260.0 do erp), virava ~16 linhas de blocos grandes pra
rolar. Acima de 6 (mesmo limiar que já ligava a busca), a tela agora mostra
lista compacta (ícone + nome + chevron). ≤6 continua na grade de blocos
(evita tela vazia, bom alvo de toque).

## Estado atual

- v0.14.0, commits `a418ec5` + `349975d`, push em `main`.
- `tsc` limpo nos dois commits. `expo lint` limpo (só um warning pré-existente
  não relacionado em `dependentes.tsx`).
- Testado isoladamente (fora do device): caso do bug de especialidade
  (profissional com Cardiologia primeiro na lista, agendamento de Geriatria
  — resolve pra Geriatria) passou nos 3 cenários (id do agendamento, sem id
  com fallback, nome direto da Feegow se um dia vier).
- **Não testado no device real ainda** — só validação de lógica isolada e
  tsc/lint. Point de atenção pro próximo ciclo: confirmar visualmente no
  aparelho que a especialidade certa aparece em "Meus agendamentos" e no
  histórico, e que a lista compacta renderiza bem nas 31 especialidades.

## Decisões tomadas

- Precedência da fonte de verdade: `especialidadeId` do próprio agendamento
  > nome direto da Feegow (se um dia vier) > palpite pela lista do
  profissional. Ordem escolhida porque o id do agendamento é o dado mais
  específico e confiável hoje.
- Mesmo limiar (`length > 6`) rege tanto a busca quanto o layout — evita
  dois números mágicos divergentes na mesma tela.

## Pegadinhas descobertas

- Nenhuma nova neste lado do app — as pegadinhas da sessão vieram do lado
  erp (ver handoff do erp-dimplus).

## Próximos passos

Ver `erp-dimplus/docs/sessions/2026-08-22-proxima-sprint.md`.
