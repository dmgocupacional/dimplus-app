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

## Resumo da fila do S2 (18/08/2026) — detalhe no ROADMAP-APP

1. **S2-L1 — helper HTTP autenticado.** NÃO é tela. O app nunca fez chamada autenticada ao
   ERP (grep de `Bearer`/`Authorization` em `src/`: zero). Decidir de onde vem o token —
   `session.tsx` **não guarda** o `access_token`; recomendado `getSession()` no helper.
2. **S2-L2 — exames.** Leitura pura, sem escrita, sem `age_restriction`. Exercita o helper com
   risco mínimo. O 404 "CPF sem cadastro na clínica" é caso REAL e precisa de UI própria.
3. **S2-L3 — agendamento, leitura.** Itens 1–7 do §8 valem inteiros. 46/46 dependentes sem
   nascimento: "idade desconhecida" é o caminho NORMAL, desenhar primeiro.
4. **S2-L4 — agendamento, escrita.** Primeira escrita em sistema de terceiro; a recepção vê.
   Confirmar o campo de id de `appoints/search` antes, ou a posse nega o dono legítimo.
5. **S2-L5 — fechamento:** handoff + bump + o que ficou.

**Fora do S2:** S-F (depende do backfill dos 256 no ERP, que ainda não rodou — a S-B entregue
não move esse número), telemedicina (flag `false`), visão gestor (permissão, não tela).

## Estado das dependências no ERP (conferido no banco em 18/08)

- ✅ Pré-lote Bearer entregue (`erp-dimplus` v0.257.0) — rotas aceitam `Authorization: Bearer`
- ✅ Flags `agendamento` e `exames` = `ativo=true`, não revertidas
- ✅ Conta de teste válida (`app_acesso='liberado'`, `user_id` presente)
- ❌ Backfill dos 256 sem nascimento — **não rodou**; 46/46 dependentes seguem sem data
