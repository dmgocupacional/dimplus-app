# 18/08/2026 — Replanejamento das filas + sonda das rotas Feegow

Sessão de **planejamento e medição**. Zero código de feature. Um comentário e docs nos dois repos.

---

## 1. As quatro filas foram reconciliadas

Existiam quatro documentos de fila (`erp/PLANO-MESTRE`, `erp/ROADMAP-APP`, este
`ROADMAP-DEPENDENTES`, `erp/ROADMAP-CENTRAL`) e duas se contradiziam. Resolvido:

- **Bloco Z deixa de travar o app.** O Z0 — único item do Z que era risco para o app — está
  fechado. A trava já tinha sido furada sem registro: a S-C foi entregue em 17/08 com o Z aberto.
- **Garfo do S2 decidido:** o app consome as rotas REST do `erp-dimplus`, não a Feegow direto.
  Token não vai para o device; gate e posse já existem lá.

## 2. 🔴 A SONDA REFUTOU A PREMISSA DO GARFO

Afirmei que o S2 seria "validação de contrato existente, não integração nova". **Errado.**
Medido ao vivo, com token real da conta de teste (`55566677720`, login OK, `sub b7125922…`):

| chamada | resultado |
|---|---|
| `GET /api/feegow/agendamento/opcoes` + `Bearer` | **307 → `/login`** |
| `GET .../disponibilidade?tipo=A&...` + `Bearer` | **307 → `/login`** |

Duas causas **independentes**, ambas no `erp-dimplus`:

1. **`src/middleware.ts:216`** protege todo `/api` fora de `publicApiRoutes`
   (`/api/webhooks/`, `/api/auth`, `/api/public/`, `/api/cron/`, `/api/mcp/`) e redireciona
   para `/login` quando não há **cookie**. A requisição **nem chega** no `guardAppModulo`.
2. **`guardAppModulo`** usa `createClient()` de `lib/supabase/server.ts`, que monta a sessão a
   partir de `cookies()` do Next. **App React Native não tem cookie** — manda
   `Authorization: Bearer`. Mesmo passando o middleware, `getUser()` daria null → 401.

**O que NÃO está quebrado:** a lógica do gate (`fn_cliente_pode`), a derivação de `paciente_id`
pelo CPF do logado e a posse fail-closed estão escritas e corretas. Falta o **transporte da
sessão**, não a autorização. Nada lá precisa ser refeito.

**Precedente que existe no repo** (não é invenção): `/api/mcp/` fica fora do gate de cookie e
se autentica por segredo no path; o POST de `/api/webhooks/asaas` se autentica por header
próprio. O padrão "sai do gate de cookie, autentica dentro da rota" já é conhecido.

## 3. O que isso fez com a fila

O S2 ganhou um **pré-lote no `erp-dimplus`** (Bearer nas rotas `/api/feegow/*` do app), e ele
**bloqueia** o S2. É outro repo → sessão própria.

Decisão registrada: **não construir a tela do S2 antes** — seria forma contra contrato nunca
exercitado ao vivo, que é o padrão de todo bug já achado neste app.

## 4. Herança do erp absorvida nesta sessão

- **S-B entregue (v0.256.0):** cadastro novo exige nascimento nas três portas. Descoberta de
  lá: o campo **não era coletado em porta nenhuma** — não era "validação frouxa".
- 🔴 **S-B não destrava a S-F.** Medido: **46 de 46** dependentes seguem sem `data_nascimento`
  (subiu de 44 para 46 em 18/08), `data_nascimento_fonte='cadastro'` = **0**. Quem destrava é
  o **backfill dos 256 legados**, lote aberto no erp e não executado. Até lá o caminho de
  "idade desconhecida" de `src/lib/idade.ts` é **o caso normal, não a exceção**.
- ✅ **As 5 assinaturas duplicadas do Asaas foram remediadas.** O risco do cartão digital
  mostrar vencimento errado está fechado — **mas a dívida estrutural segue**: a leitura ainda
  passa pelo campo singular `clientes.asaas_subscription_id`, então cliente novo com duas
  assinaturas reproduz o cartão errado em silêncio. O app não ficou imune; só não há caso vivo.
  Comentado inline em `src/components/CartaoDigital.tsx`.
- 🔴 Regra que veio do caso ADAO: **puxar o extrato por customer antes de escolher qual
  assinatura morre** — a dívida vencida estava na invisível, e o plano original teria apagado
  a cobrança real.

## 5. Pegadinhas desta sessão

- **Bearer não vale nada contra rota protegida por cookie.** Testar com `curl` e header não
  prova acesso do app se a rota lê `cookies()`. Foi o 307 que revelou — um 401 teria dado a
  impressão errada de que era só credencial.
- **Ler o `middleware.ts` antes de afirmar que uma rota "está pronta".** A rota pode estar
  perfeita e inalcançável.
- Duas conversas paralelas empurraram para `main` durante esta sessão (5 commits). `git fetch`
  antes de qualquer push, e **ler o commit alheio antes de rebasear** — uma das vezes a
  paralela já havia registrado a S-B no mesmo trecho que eu editava, e a minha versão foi
  descartada em favor da dela para não duplicar.

## 6. O que NÃO foi feito

- Nenhum código de feature. Nenhum bump em nenhum dos dois repos.
- Nenhuma tela do S2.
- Nenhuma escrita na Feegow.
- Z1 **não** andou: segue **45**.
- Nada tocado nas 5 duplicatas (já resolvidas pela paralela).
