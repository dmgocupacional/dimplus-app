# ROADMAP do dimplus-app — PONTEIRO, não fila

> ⚠️ **Este arquivo existe porque prompts de retomada mandavam "ler `docs/ROADMAP.md` (fila)"
> e ele NÃO EXISTIA neste repo.** Quem seguisse a instrução não achava nada e improvisava.
>
> 🔴 **A fila do app NÃO vive aqui. Vive em `erp-dimplus/docs/ROADMAP-APP.md`** — não existe
> cópia neste repo, de propósito: duas cópias divergem, e já divergiram (o §8 do
> `FEEGOW-LEITURA.md` desenhou a tela como se ela falasse com a Feegow direto, contra o que o
> `ROADMAP-APP` já decidira). **Se os dois divergirem, `ROADMAP-APP.md` manda.**

## Onde está cada coisa

| assunto | arquivo |
|---|---|
| **Fila e lotes do S2** | `erp-dimplus/docs/ROADMAP-APP.md` → seção FASE 2, bloco "FILA DO S2" |
| Fronteira ERP × App | `erp-dimplus/docs/ROADMAP-APP.md` → "Fronteira ERP × App" |
| Forma da tela de agendamento (itens 1–7) | `docs/FEEGOW-LEITURA.md` §8 **neste repo** |
| De onde vem o dado + lacuna do token | `docs/FEEGOW-LEITURA.md` §9 **neste repo** |
| Dependentes (titular ↔ dependente) | `docs/ROADMAP-DEPENDENTES.md` neste repo |
| Ordem geral das frentes do ERP | `erp-dimplus/docs/PLANO-MESTRE.md` |

## Resumo da fila do S2 — S2 FECHADO em 21/08/2026

1. ✅ **S2-L1 — helper HTTP autenticado.** (`b9e71c0`, v0.5.2) `chamarFeegow()` em
   `src/lib/feegowApi.ts`, token via `getSession()` na hora da chamada.
2. ✅ **S2-L2 — exames.** (`ed65d45`, v0.6.0) Leitura pura, 404 "CPF sem cadastro"
   tratado como estado próprio.
3. ✅ **S2-L3 — agendamento, leitura.** (`3e5e005`, v0.7.0) Itens 1-7 do §8 respeitados.
4. ✅ **S2-L4 — cancelar e remarcar.** (`364d044`, v0.8.0)
5. ✅ **S2-L4b — criar agendamento.** (`3ccf648`, v0.9.0 + correções até v0.13.3)
   Desbloqueado pelo `erp-dimplus` v0.258.0. **Validado em produção contra a Feegow
   real**, não só `tsc`.
6. ✅ **S2-L5 — layout e fechamento.** (v0.10.0 → v0.13.3) Menu de entrada, calendário,
   histórico, grade de especialidades, 31 especialidades destravadas.

**Estado em 21/08/2026: criar, cancelar, remarcar, listar ativos e histórico funcionam
de ponta a ponta pelo app, testados no device contra a clínica real.**

## 🔴 O que a Feegow faz e ninguém documentou — leia ANTES de tocar em agendamento

Doze descobertas de 20-21/08/2026. **Nenhuma apareceu em `tsc`, build ou lint.** Todas
custaram horas e só apareceram batendo contra a API real. Se você for mexer aqui, este
bloco é o que economiza o seu dia.

| o que | sintoma | onde está tratado |
|---|---|---|
| `especialidade_id` é IGNORADO em `procedures/list` | catálogo inteiro volta | filtro no erp (`catalogoAgenda`) |
| `especialidade_id` é IGNORADO em `available-schedule` | todos os médicos aparecem | filtro no app por `especialidadeIds` |
| `available-schedule?tipo=A` não enxerga agendamento de OUTRO procedimento | oferece horário que a criação recusa com 409 | poda no erp (`disponibilidade/route.ts`) |
| `appoints/search` recusa janela >= 6 meses | 409 "Intervalo de data deve ser menor que 6 meses" | janelas no erp |
| `get-laudos-list` recusa janela > 1 ano | 422 "período não pode ser superior a um ano" | janelas no erp |
| checagem de posse é fail-closed | janela errada virava "não é seu" e bloqueava cancelar | `app-feegow-guard.ts` |
| `obs` VAZIA é recusada no cancelar | 422 | default no `cancelar/route.ts` |
| **data volta em d-m-Y, não ISO** | ativo lido como passado e SUMIA da tela | `paraIso()` na fronteira |
| `consulta_id` da especialidade não é confiável | 30 de 39 apontam para "Consulta Infectologista"; e erra fora do default (Geriatria) | tabela conferida à mão no erp |
| não devolve nome do profissional, só o id | "Profissional a confirmar" | cruzamento com `opcoes` |
| appoints/search traz cancelado junto | cancelado ocupando lista de ativos | `separarPorData` por status |
| slot some entre listar e confirmar | 409 legítimo | mensagem própria + recarga |

**Regra que sai disso: filtro e limite da Feegow não se confia, se verifica.**

## 🔜 Próximas frentes (definidas 21/08/2026)

Nada disto está começado. Em ordem de valor:

1. **Confirmar o preço com a recepção.** `tabela_id: 6` grava no agendamento — provado.
   Se o CAIXA aplica os R$ 210 da tabela DIM+ (e não o particular) NÃO foi provado: o
   campo `valor` do agendamento volta R$ 0,00 e o preço parece ser resolvido no
   faturamento. É pergunta para o balcão, não para o código. **Mexe em dinheiro — é o
   item mais importante da lista.**
2. **Agenda publicada é o gargalo real.** Das 10 cardiologistas, só uma tem horário
   aberto no período. O app vai parecer vazio em várias especialidades novas, e isso
   não é bug: é cadastro de agenda na clínica.
3. **Especialidade exibida no agendamento pode estar errada.** Quando o profissional
   atende mais de uma, mostramos a PRIMEIRA dele — a Feegow não devolve a especialidade
   do agendamento. Pode exibir "Cardiologia" numa consulta de Geriatria.
4. **Layout com 31 especialidades.** A grade de dois por linha foi desenhada para 6
   itens. Com 31 vira rolagem longa; a busca já aparece sozinha acima de 6. Reavaliar
   lista + busca.
5. **Psicologia fora do app.** Não existe "Consulta Psicólogo" no catálogo da Feegow.
   Quando a clínica criar o procedimento, é só acrescentar na tabela do erp.
6. **Ginecologia × Ginecologia e Obstetrícia** aparecem duplicadas (mesmo procedimento).
   Decidido em 21/08 deixar como está.

**Fora do S2:** S-F (depende do backfill dos 256 no ERP, que ainda não rodou — a S-B entregue
não move esse número), telemedicina (flag `false`), visão gestor (permissão, não tela).

## Estado das dependências no ERP (conferido no banco em 18/08)

- ✅ Pré-lote Bearer entregue (`erp-dimplus` v0.257.0) — rotas aceitam `Authorization: Bearer`
- ✅ Flags `agendamento` e `exames` = `ativo=true`, não revertidas
- ✅ Conta de teste válida (`app_acesso='liberado'`, `user_id` presente)
- ❌ Backfill dos 256 sem nascimento — **não rodou**; 46/46 dependentes seguem sem data
