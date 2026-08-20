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

## Resumo da fila do S2 (19/08/2026) — detalhe no ROADMAP-APP

1. ✅ **S2-L1 — helper HTTP autenticado.** Entregue (`b9e71c0`, v0.5.2). `chamarFeegow()`
   em `src/lib/feegowApi.ts`, token via `getSession()` na hora da chamada.
2. ✅ **S2-L2 — exames.** Entregue (`ed65d45`, v0.6.0). Leitura pura, 404 "CPF sem
   cadastro" tratado como estado próprio.
3. ✅ **S2-L3 — agendamento, leitura.** Entregue (`3e5e005`, v0.7.0). Itens 1-7 do §8
   respeitados. Dois bugs reais achados e corrigidos só por testar contra dado real (não
   só tsc): `age_restriction` aninhado em `opcoes.profissionais`, e envelope extra
   `{"profissional_id": {...}}` no topo de `disponibilidade` — ver handoff da sessão.
4. 🟡 **S2-L4 — agendamento, escrita.** PARCIAL (`364d044`, v0.8.0). Cancelar e Remarcar
   entregues. **Criar agendamento BLOQUEADO** — ver seção nova abaixo.
5. **S2-L5 — fechamento.** Ainda não rodado; depende de decidir se o S2 fecha "parcial"
   (sem criar) ou espera o desbloqueio do ERP.

## 🔴 Bloqueio para "criar agendamento" — depende do `erp-dimplus`, NÃO deste repo

Achado em 19/08 ao planejar o S2-L4, confirmado por leitura direta do código do erp
(`find` em `src/app/api/feegow/`, não suposição):

1. **Falta rota de catálogo de procedimentos pro app.** `POST /api/feegow/agendamento`
   exige `procedimento_id` no corpo, mas não existe nenhuma rota
   `/api/feegow/*procedimento*` exposta — só `opcoes`, `disponibilidade`, `agendamento`
   (GET/POST), `cancelar`, `reagendar`, `exames/*`, `conciliacao/*`.
2. **`POST /agendamento` do erp não passa `tabela_id`** pra `criarAgendamentoFeegow`.
   O próprio comentário do `catalogo.ts` do erp avisa: sem `tabela_id`, o agendamento
   nasce no PARTICULAR CHEIO — cobraria de um cliente com desconto DIM+ o preço de quem
   não tem.

Nenhum dos dois é contornável do lado do app sem inventar dado de negócio (proibido).
**Trabalho de desbloqueio é no `erp-dimplus`, em conversa própria** (regra "1 conversa =
1 repo"). Brief para essa conversa: ver handoff `docs/sessions/2026-08-19-s2-l4-cancelar-remarcar.md`
neste repo, seção "Próximos passos".

**Fora do S2:** S-F (depende do backfill dos 256 no ERP, que ainda não rodou — a S-B entregue
não move esse número), telemedicina (flag `false`), visão gestor (permissão, não tela).

## Estado das dependências no ERP (conferido no banco em 18/08)

- ✅ Pré-lote Bearer entregue (`erp-dimplus` v0.257.0) — rotas aceitam `Authorization: Bearer`
- ✅ Flags `agendamento` e `exames` = `ativo=true`, não revertidas
- ✅ Conta de teste válida (`app_acesso='liberado'`, `user_id` presente)
- ❌ Backfill dos 256 sem nascimento — **não rodou**; 46/46 dependentes seguem sem data
