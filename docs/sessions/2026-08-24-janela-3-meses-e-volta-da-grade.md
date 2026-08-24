# 24/08/2026 — Janela de 3 meses, busca estendida e volta da grade de cards

> Repos tocados: `dimplus-app` (v0.14.0 → **v0.15.1**) e `erp-dimplus` (v0.261.1 → **v0.262.0**).
> Handoff gêmeo no ERP: `docs/sessions/2026-08-24-janela-3-meses-disponibilidade.md`.

---

## O que foi feito

### 0. Validação de campo do lote de 22/08 — ✅ PASSOU

A sessão abriu com o item único que o `2026-08-22-proxima-sprint.md` mandava fazer: testar
no aparelho o que tinha ido para produção sem prova de campo. **Os três passaram**:

1. O agendamento de Clínico Geral que dava **409 silencioso** agora completa. A poda em
   lote (`erp-dimplus` v0.261.1) resolveu de fato.
2. Especialidade exibida bate com a real em "Meus agendamentos" e no histórico.
3. Lista compacta com as 31 especialidades apareceu no device.

Com isso o lote de 22/08 está fechado **com prova**, não só com deploy verde.

### 1. Janela de disponibilidade: 21 → 90 dias

**Pedido do Henrique:** "só consigo ver 1 mês à frente".

**Diagnóstico.** Não era limite da Feegow nem do `CalendarioMes` (que já navegava entre
meses com vaga sozinho). Era a constante `JANELA_DISPONIBILIDADE_DIAS = 21` em
`src/lib/agendamento.ts` — ponto único que alimenta as três chamadas de disponibilidade.
O comentário dela dizia que 21 foi escolha por medo de payload, não contrato de API.

**O medo foi medido antes de mexer, e não se sustentou.** Números reais de 24/08/2026:

| | 21 dias (antes) | 90 dias |
|---|---|---|
| `available-schedule` (payload) | ~130 KB | **553 KB** |
| `appoints/search` (poda) | — | **4,2 MB / 6.771 registros** |
| slots achatados no device | ~11 mil | **47.568** |

A projeção linear ingênua dava 29 MB e teria matado a ideia. Ela estava errada: **o volume
despenca com a distância.** Agendamentos por mês — ago **4.531** · set **2.145** · out
**84** · nov **11**. Quase tudo que a poda carrega já estava nos primeiros 30 dias, que a
janela de 21 já pagava. Esticar para 90 custa muito menos do que parece.

> **Lição que vale para o próximo:** não extrapole volume de agenda linearmente. A curva é
> fortemente decrescente. Meça uma semana perto E uma semana longe antes de decidir.

### 2. Busca estendida automática (o caso dos 4 meses)

**Pedido:** se a próxima vaga só existe daqui a 4 meses, mostrar essa data — não dizer
"sem horário", que é mentira.

`getDisponibilidade()` agora: busca 0→90 dias; **se voltar vazia**, busca 90→175 e marca o
resultado como `estendida: true`. A tela mostra um `<Aviso>` explicando que as datas são
distantes.

- A segunda chamada **só dispara no caso vazio**. Havendo vaga nos 90 dias ela nunca
  acontece — o caminho comum segue com uma chamada só (provado em teste, o stub explodia
  se fosse chamado).
- Custa pouco quando dispara: lá na frente a agenda é quase vazia (84 agendamentos em
  outubro inteiro).
- Falha na 2ª janela **não vira erro de tela** — a 1ª respondeu bem, só estava vazia.
  "Sem horário" é o resultado honesto aí.

🔴 **`JANELA_ESTENDIDA_DIAS = 175`, e NUNCA subir para 180.** A Feegow recusa com 409
qualquer intervalo >= 6 meses. 175 deixa margem contra virada de mês/ano.

### 3. Modo `resumo` no achatamento — o risco real dos 90 dias

O gargalo dos 90 dias **não era o payload, era o device**: 47.568 objetos criados no
achatamento, contra ~11 mil antes. Suficiente para engasgar aparelho fraco.

Descoberta que resolveu limpo: **a tela de especialidade nunca lê o campo `horario`.** Ela
só usa `profissionalId`, `unidadeId` e `data` para montar os grupos. Então
`achatarDisponibilidade(..., resumo = true)` (default) emite **um slot por
profissional+dia** em vez de um por horário.

Verificado contra o payload real de 90 dias, não no olho:

```
sem resumo : 47.568 slots
com resumo :  1.568 slots   → redução de 96,7%
dias            60 / 60      IGUAL ✅
profissionais   80 / 80      IGUAL ✅
pares prof+dia  1.557/1.557  IGUAL ✅
```

Quem **mostra horário para escolher** pede `resumo: false` explicitamente: a agenda do
profissional (`novo-agendamento`) e a remarcação (`meus-agendamentos`). Nesses casos a
janela é de um profissional só — ordens de grandeza menor.

### 4. `maxDuration` 30 → 60 no ERP

A rota `/api/feegow/agendamento/disponibilidade` faz **duas chamadas Feegow em série**
(`available-schedule` + o `appoints/search` da poda) e **cada uma** usa
`TIMEOUT_LONGO_MS = 30s`. Com `maxDuration = 30` a segunda podia ser cortada pela
plataforma no meio.

Isso não é cosmético: corte na segunda devolve `podado: false` — ou seja, **ressuscita
exatamente o 409 silencioso que a poda existe para matar.** Com 4,2 MB na janela de 90
dias, virou risco real.

> ⚠️ **Ordem de deploy importa:** o ERP tem que estar READY *antes* do app, senão o app
> pede 90 dias contra uma rota de 30s.

### 5. Grade de cards volta a ser o único layout

**Pedido do Henrique:** "mudou o layout para meio que lista, quero aquele layout de cards
um ao lado do outro".

Registro honesto: **isso não foi mudança desta sessão** — veio da lista compacta do
commit `349975d` (v0.14.0, 21/08). Conferido no diff antes de responder.

O ramo da lista e o limiar `agendaveis.length > 6` saíram do render. A grade
(`blocoEsp`, `width: '48%'`, dois por linha) passa a valer para **qualquer quantidade**.
Estilos órfãos (`listaEsp`, `linhaEsp`, `linhaEspIcone`, `linhaEspTxt`) removidos.

A **busca foi desacoplada** do mesmo limiar e agora aparece sempre. Ela estava amarrada à
lista compacta, mas resolve um problema que a grade tem ainda mais: 31 blocos em duas
colunas são ~16 linhas de rolagem.

> **Trade-off aceito conscientemente pelo Henrique:** densidade menor em troca do layout de
> cards. Foi por causa da rolagem longa que virou lista em 21/08. Se voltar a incomodar,
> as saídas **sem** voltar para lista são: bloco menor (3 por linha) ou agrupar por área
> (Clínicas / Exames / Odonto) em seção recolhível.

---

## Estado atual

| | versão | commit |
|---|---|---|
| `erp-dimplus` | **v0.262.0** | `fcb2749` |
| `dimplus-app` | **v0.15.1** | `110ea5f` + `a415f80` |

Validado no aparelho pelo Henrique: cards lado a lado de volta ✅ e janela de 3 meses ✅.

---

## 🔴 Pendências e pegadinhas

1. **A busca estendida NÃO teve prova de campo.** Ela só dispara quando os 90 dias voltam
   completamente vazios, e o teste do Henrique caiu em especialidade com agenda. **Próxima
   vez que topar com uma especialidade escassa, conferir se aparece o aviso de datas
   distantes em vez de "sem horário".** É o único caminho deste lote sem validação real.
2. **`available-schedule` ignora `especialidade_id`** (já era conhecido — está na tabela
   "A Feegow mente"). Reconfirmado ao vivo: pedindo `especialidade_id=129` vieram **80
   profissionais**. Consequência nova: a busca estendida puxa a agenda inteira da clínica
   mesmo para uma especialidade só. **Funciona, é desperdício.** Item futuro, não urgente.
3. O repo do app **não tem config de ESLint** (`eslint.config.*` ausente, ESLint 9 não lê
   `.eslintrc`). Validação foi `tsc` + testes de comportamento. Não é regressão desta
   sessão, mas é um furo de pipeline.

## Como isto foi validado

`tsc` limpo nos dois repos · build do Next passou · **e**, porque verde de compilador não
prova comportamento (regra que esta trilha já aprendeu na marra):

- modo resumo conferido contra o payload real de 90 dias (tabela acima);
- os **5 caminhos** do fallback testados: agenda cheia (não estende), escassa (estende),
  vazia total, erro na 1ª janela (propaga), erro só na 2ª (não quebra a tela);
- teto de 175 dias conferido contra o limite de 6 meses;
- 7 asserções no render: grade é ramo único, nenhum `> 6` sobrou, busca desacoplada,
  filtro por termo preservado, blocos a 48%, estado vazio preservado, zero estilo órfão.
