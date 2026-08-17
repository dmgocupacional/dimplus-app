# Feegow — caminho de LEITURA (recon executado em 17/08/2026)

Base factual para o S2 (agendamento read-only). **Tudo aqui veio de chamada real**, não de
leitura de documentação. O que não foi executado está marcado como NÃO VERIFICADO.

Ferramentas usadas: MCP `Feegow DIMEG` (`feegow_disponibilidade`, `feegow_locais`).

---

## 1. O caminho de leitura RESPONDE

`feegow_disponibilidade(tipo="A", 2026-08-18 → 2026-08-21)` devolveu payload válido.
Isso estava em aberto até esta sessão — o S2 não depende mais de descobrir se a leitura
funciona. Depende das duas dependências de DADO da seção 6.

## 2. O payload é grande demais para o device

Uma janela de **4 dias**, `tipo=A`, **sem nenhum filtro**, devolveu:

- ~45 profissionais
- até 4 datas por profissional, por local
- até **57 horários** por data

Milhares de entradas numa resposta só. Puxar isso no celular e filtrar no cliente é erro
de arquitetura: baixa a agenda inteira da clínica para mostrar meia dúzia de horários.

**Consequência de PRODUTO, não só de performance:** o filtro tem que ir no PARÂMETRO
(`especialidade_id` / `unidade_id` / `profissional_id`), então o usuário escolhe a
especialidade **ANTES** de ver horário. A tela não pode ser "lista tudo e filtra em cima".

## 3. Forma da resposta — três níveis, e uma pegadinha de nível

```
{ "profissional_id": {
    "<id>": {
      "local_id": { "<local>": { "AAAA-MM-DD": ["HH:MM:SS", ...] } },
      "age_restriction": {...} | null      ← IRMÃO de local_id, não filho
    } } }
```

- Chaves numéricas vêm como **STRING**.
- 🔴 `age_restriction` fica no nível do PROFISSIONAL, **ao lado** de `local_id` — não dentro
  do local nem dentro da data. É onde a intuição não procura.
- ⚠️ Dia sem vaga vem como **array VAZIO**, não ausente: `"2026-08-19": []`. Confirmado em
  vários profissionais. Tratar `[]` como "sem horário", nunca como erro de carregamento.
- ⚠️ Janela máxima de 6 meses (>= 6 devolve 409).
- A resposta **NÃO traz nome de especialidade** — só `profissional_id`. Rotular exige
  cruzar com `feegow_profissionais_por_especialidade`.

## 4. 🔴 `age_restriction` tem QUATRO formatos, vistos na MESMA resposta

| forma observada | significado real |
|---|---|
| `null` | sem restrição |
| `{age_from: 0, age_to: 127}` | sem restrição — escrito como se FOSSE restrição |
| `{age_from: null, age_to: 16}` | **só pediatria** (profissionais 268, 457) |
| `{age_from: 18, age_to: null}` | só adulto (326, 331, 358, 367, 416, 434) |
| `{age_from: 15, age_to: 65}` | faixa nas duas pontas (390, 465, 466, 467) |

Os DOIS campos podem ser `null` de forma independente. `0`/`127` são sentinelas de
"sem limite" e não devem ser exibidos como faixa real.

🔴 **A grafia MUDA entre endpoints:** aqui é `{age_from, age_to}`; em
`feegow_profissionais_por_especialidade` a MESMA coisa é `{idade_minima, idade_maxima}`.
Ler só uma das grafias faz o filtro passar batido **sem erro nenhum** — e a Feegow recusa
o agendamento apenas na confirmação. Ler as duas, sempre.

## 5. `local_id` é SALA, não unidade

`feegow_locais` devolveu 53 salas em 6 unidades:

| `unidade_id` | unidade |
|---|---|
| **0** | Osasco (matriz) — **zero é VÁLIDO**, não "ausente" |
| 1 | Itapevi |
| 2 | (só Sala Endoscopia) |
| 3 | Cajamar |
| 4 | Osasco Filial |
| 5 | Carapicuíba |

- O cliente NÃO pode ver `"Consultório 7 (Itapevi)"`. Agrupar por `unidade_id` e mostrar a
  unidade. O mapeamento sala→unidade vem pronto de `feegow_locais`.
- ⚠️ **Salas de lixo:** ids **26 e 27** se chamam literalmente `"importado"`. Não podem
  vazar para a tela do cliente. Filtrar por nome não é robusto — considerar allowlist.
- Há salas de exame/procedimento (Raio X, Tomografia, Ultrassom, Endoscopia, Enfermagem)
  misturadas com consultório. `tipo=A` vs `E` vs `P` importa.

## 6. 🔴 DUAS dependências de DADO bloqueiam o S2

### 6.1 `feegow_paciente_id` ausente nas contas de teste

```
clientes ..................................... 809
com feegow_paciente_id ....................... 538 (66%)
liberados no app ............................. 3
liberados COM feegow_paciente_id ............. 0
```

100% das contas que existem no app hoje nasceriam em **estado vazio**. Dá para construir e
demonstrar o empty state; NÃO dá para validar o caminho feliz em device.

Os 271 sem vínculo precisam de caminho tratado, não erro seco.

### 6.2 🔴 NÃO EXISTE DATA DE NASCIMENTO EM `clientes` — descoberto em 17/08/2026

Verificado em `information_schema.columns`: nenhuma coluna de nascimento, aniversário ou
idade na tabela `clientes`. Só apareceram `unidade_id` e `endereco_cidade`.

**Sem idade não há como aplicar `age_restriction`.** Efeito em cascata:

- **S2 (leitura):** a tela oferece pediatra (`age_to: 16`) para adulto de 40 anos.
- **S4 (escrita):** a Feegow aceita na tela e **recusa só na confirmação** — o modo de
  falha exato que a descrição da tool avisa.

Não se resolve vinculando conta de teste: é coluna ausente para 809 clientes.

**DECISÃO ABERTA DO HENRIQUE** — três caminhos, nenhum grátis:

1. **Puxar da Feegow** — o paciente lá provavelmente tem nascimento (NÃO VERIFICADO).
   Cobre só os 538 vinculados, e ironicamente não cobre as contas de teste.
2. **Criar coluna e preencher** — migração no erp-dimplus + origem para 809 registros.
3. **Não filtrar por idade no S2** — barato, mas entrega tela que oferece horário
   inservível. Se for esta, que seja escolha REGISTRADA, não descuido herdado.

Em 17/08 o Henrique sinalizou que o caminho já estava bom; o item continua aberto aqui
porque a ausência da coluna é fato de schema, e a decisão sobre conviver com ela ainda
não foi tomada explicitamente.

## 7. O que NÃO foi executado (e por quê)

- **`feegow_agendamentos` SEM `paciente_id`** — sem filtro devolve a agenda de pacientes
  REAIS, dado de saúde de terceiro. Não puxado ao contexto por decisão de privacidade.
  Chamar só filtrado por um `feegow_paciente_id` de teste.
- **`feegow_historico_paciente`** — mesma razão. Quando for usado, atenção: as datas de
  SAÍDA vêm em `d-m-Y` (`"17-04-2026"`), **não** `Y-m-d` — `new Date()` nelas é
  `Invalid Date` SILENCIOSO. E `primeiro_agendamento` vem `0` em todos os registros,
  inclusive no mais antigo: flag inútil, calcular primeira visita por `min(data)`.
- **Qualquer escrita.** `feegow_criar_agendamento` escreve na agenda de PRODUÇÃO que a
  recepção vê. Sem `tabela_id: 6` ("Cartão DIM+ Básico Plus") o agendamento nasce no
  PARTICULAR CHEIO — cobra preço cheio de quem tem desconto. `procedimento_id` é
  OBRIGATÓRIO (não dá para agendar só com especialidade) e o `consulta_id` de
  `feegow_especialidades` NÃO é confiável na DIMEG.

## 8. Forma que a tela do S2 já nasce tendo que ter

Consequência direta das seções 2–5, para não redescobrir:

1. Especialidade escolhida **antes** da consulta de horários (seção 2).
2. Horários agrupados por **unidade**, não por sala (seção 5).
3. Salas `26`/`27` (`"importado"`) fora (seção 5).
4. `[]` = "sem horário nesse dia", não erro (seção 3).
5. `age_restriction` lido nas **duas** grafias (seção 4).
6. Sentinelas `0`/`127` não exibidas como faixa (seção 4).
7. Caminho explícito para cliente sem `feegow_paciente_id` (seção 6.1).
