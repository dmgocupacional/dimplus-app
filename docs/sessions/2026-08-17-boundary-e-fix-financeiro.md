# 2026-08-17 — Boundary + fix do Financeiro (v0.3.2 → v0.3.3)

**Versão final:** v0.3.3 · **Commits:** `eb76b5d` (boundary) · `c09cc79` (fix)
**Sessão anterior:** `2026-08-17-s0-contas-teste.md` — contas de teste liberadas.

---

## O QUE FOI FEITO

Dois bugs corrigidos, sendo que **um deles ninguém sabia que existia** e teria atingido
a maioria dos clientes.

### v0.3.2 — Error boundary global (`src/components/ErroBoundary.tsx`)

Qualquer crash de render virava tela preta silenciosa. O app roda direto no Expo Go do
celular, sem terminal aberto — não havia onde ler o stack. Bug irreproduzível por falta de
visibilidade, não por falta de causa.

Boundary de classe envolvendo o `Roteador` **dentro** dos providers (precisa dos tokens de
tema e da versão). Mostra `erro.name: erro.message` + 8 linhas do component stack, com texto
selecionável para copiar no próprio device.

**Não é ferramenta temporária de debug.** É requisito de produto: crash silencioso na review
da Apple é rejeição sem explicação, e "ficou preto" vindo de cliente não é diagnosticável.

### v0.3.3 — `rotuloStatus` derrubava a tela em 807 pagamentos

```
TypeError: Cannot read property 'texto' of undefined
    at Financeiro
```

`switch` sem `default` cobrindo 5 status, enquanto `pagamentos.status` (`text`, SEM CHECK,
cru do Asaas) tem **9 valores** em produção:

| status | qtd | tratado antes? |
|---|---|---|
| RECEIVED | 3.012 | sim |
| OVERDUE | 1.701 | sim |
| PENDING | 511 | sim |
| **RECEIVED_IN_CASH** | **487** | **NÃO** |
| **DELETED** | **291** | **NÃO** |
| CONFIRMED | 230 | sim |
| DUNNING_REQUESTED | 77 | sim |
| **REFUNDED** | **28** | **NÃO** |
| **DUNNING_RECEIVED** | **1** | **NÃO** |

`RECEIVED_IN_CASH` é **pagamento presencial na clínica** — rotina. Se o app tivesse sido
liberado para cliente, a maioria cairia em tela preta na aba de faturas.

O comentário do `data.ts` **já avisava** que a tela precisava tolerar status desconhecido.
Não tolerava. Aviso em comentário não é proteção; `default` é.

---

## DECISÕES TOMADAS

1. **`PagamentoStatus` é união ABERTA** (`| (string & {})`). A coluna não tem constraint e
   status novo do Asaas entra sem aviso — o TS precisa obrigar o consumidor a ter fallback.
   **NÃO FECHAR ESTA UNIÃO.** Fechá-la reintroduz exatamente este bug.
2. **`DELETED` permanece VISÍVEL** como "cancelada" (tom neutro) — decisão do Henrique.
   A lista não esconde dado do cliente. Foi considerado filtrar e recusado.
3. **`default` no `rotuloStatus` é intocável**, mesmo que o switch pareça exaustivo.

---

## MÉTODO — o erro que quase passou

A hipótese do `rotuloStatus` foi levantada cedo e parecia confirmada quando o Henrique disse
"agora funcionou". **Estava errada naquele momento** — o celular rodava um bundle de julho
(v0.2.0), e o código analisado nunca havia sido executado no aparelho.

O que salvou o diagnóstico foi **perguntar a versão na aba Perfil**. Um número numa tela.

Regra derivada: **"funcionou" e "quebrou" não valem nada sem a versão junto.** Antes de
concluir qualquer coisa sobre comportamento em device, confirmar qual bundle está rodando.

Só depois do bundle correto (0.3.2) o erro real apareceu — e aí sim confirmou a hipótese.

---

## PEGADINHAS DESCOBERTAS

- **DOIS caminhos de código até o celular, e eles não se misturam:**
  `npx expo start` no PC serve da pasta LOCAL (exige `git pull`); EAS Update serve do que
  foi commitado (exige matar e reabrir o app). Confundir os dois gera debate sobre código
  que não está rodando.
- **Update publicado que não aparece = CACHE do Expo Go**, não incompatibilidade de runtime.
  Verificado via `eas branch:list`: todos os updates estão em `exposdk:54.0.0`, coerentes
  com o repo. Matar e reabrir o app resolve.
- **O comentário do workflow mentia** (`exposdk:57.0.0`, sendo 54). Custou uma hipótese
  inteira. Corrigido nesta sessão. Comentário errado sobre infra é pior que comentário
  ausente — induz decisão errada.
- **Boundary NÃO captura erro assíncrono** (callback com `await` que rejeita, promise solta).
  Se um bug futuro não aparecer nele, é assíncrono — procurar em outro lugar.
- **`gate.ts` também tem `switch`**, mas com `default`. Está seguro. Verificado por grep.

---

## ESTADO ATUAL

- v0.3.3 validada EM DEVICE pelo Henrique. Financeiro abre e lista faturas.
- Contas de teste (sessão anterior) funcionando: `55566677720` / `DimPlus@2026`.
- `EXPO_TOKEN` disponível — dá para consultar EAS do container
  (`eas branch:list`, `update:list`, e futuramente `build`/`submit`).
- Rede continua mock declarado (`REDE_E_MOCK`). Visão gestor segue sem código.

## PRÓXIMOS PASSOS

- [ ] S1 · Varrer as demais telas com as contas de teste, procurando o mesmo padrão de
      "dado real que a tela não previu". O boundary agora torna isso barato.
- [ ] S2 · Agendamento Feegow **read-only**. A flag `agendamento` já existe em
      `app_features`, DESLIGADA — é ligar, não criar.
- [ ] S3 · Termo de aceite. **Bloqueio jurídico, não técnico:** `contrato_termos` está
      vazia e o texto é decisão de advogado.
- [ ] S4 · Agendar de fato (escrita na Feegow). Só depois do S2 validado.
- [ ] S5 · Build/submit para as lojas.

## FORA DE ESCOPO
WhatsApp · push · remover mock da Rede · aprovação de contrato e RBAC de funcionário
no celular (permanecem no erp-dimplus).

---

## PROMPT DE RETOMADA

```
v0.3.3 · commit c09cc79 · repo dmgocupacional/dimplus-app · branch main
(NÃO confie no hash escrito aqui — rode `git log --oneline -5`.)

Leia primeiro:
- docs/sessions/2026-08-17-boundary-e-fix-financeiro.md  (esta sessão)
- docs/sessions/2026-08-17-s0-contas-teste.md            (contas de teste)
- docs/sessions/2026-08-17-diagnostico-demo-e-gestor.md  (escopo gestor)

CONTEXTO: o app tem auth por CPF (email sintético), máquina de sessão de 4 estados e
4 abas funcionando com dado REAL do Supabase — exceto a Rede, que é mock declarado.
Em 17/08 três contas de TESTE foram liberadas e o estado `pronto` foi alcançado pela
primeira vez em produção; na sequência dois bugs foram corrigidos (tela preta sem
diagnóstico, e crash do Financeiro em 807 pagamentos). Tudo validado em device.

CONTA PARA TESTAR: CPF 55566677720 / senha DimPlus@2026 (a única com histórico de
pagamento coerente: anuidade paga + próxima vencendo em 2027).

ESCOPO, em ordem:
1. S1 · Varrer as demais telas (Início, Rede, Perfil, Ajuda, carteirinha) com as contas
   de teste, procurando o mesmo padrão do bug do Financeiro: dado real que a tela não
   previu. O error boundary já mostra o erro na tela, então isso é barato agora.
2. S2 · Agendamento Feegow READ-ONLY (meus agendamentos + horários livres). A flag
   `agendamento` JÁ EXISTE em app_features, desligada. 538 dos 809 clientes têm
   feegow_paciente_id (66%) — os outros 271 precisam de caminho tratado, não erro seco.
   As 3 contas de teste têm feegow_paciente_id NULL: nascerá em estado vazio nelas.
3. S3 · Termo de aceite no app — BLOQUEIO JURÍDICO: contrato_termos está vazia e o texto
   é decisão de advogado. Não redigir cláusula por conta própria.
4. S4 · Escrita na Feegow. Só depois do S2 validado em device.
5. S5 · Build e submit para as lojas.

DECISÕES PENDENTES DO HENRIQUE:
- aba Rede fica com mock declarado ou é ocultada na demo?
- vincular feegow_paciente_id de teste nas 3 contas? NUNCA a paciente real (exporia
  agenda de terceiro).

NÃO MEXER:
- PagamentoStatus é união ABERTA de propósito (| (string & {})). NÃO FECHAR.
- O `default` do rotuloStatus é intocável, mesmo parecendo exaustivo.
- DELETED permanece visível como "cancelada" — decisão do Henrique, não reverter.
- SDK 54 é teto; runtimeVersion.policy = "sdkVersion" intocável.
- Sem realtime e sem push (decisão de projeto).
- Aprovação de contrato e RBAC de funcionário ficam no erp-dimplus.

REGRAS:
- Nada de código sem "vai" explícito.
- Schema-first via Supabase MCP (projeto bhrxfudnhxqntnnbgyjg) antes de código de dados.
- Ler o arquivo inteiro antes de afirmar qualquer coisa sobre ele.
- "Funcionou"/"quebrou" NÃO valem sem a versão junto — conferir a aba Perfil antes de
  concluir qualquer coisa sobre comportamento em device.
- Bump em TRÊS lugares no mesmo commit: src/lib/version.ts + package.json + app.json.
- feegow_criar_agendamento escreve na agenda de PRODUÇÃO que a recepção vê. Leitura
  antes de escrita, sem atalho.
```
