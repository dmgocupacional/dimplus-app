# Validação em Expo Go — v0.3.1

**Data:** 05/08/2026
**Versão sob teste:** 0.3.1 (`e304840`)
**Objetivo:** provar no APARELHO o que a SPRINT B provou só pelas rotas.

> A v0.3.1 nunca rodou em device. Cadastro e login foram provados em produção via HTTP
> (`docs/sessions/2026-07-31-sprint-b-auth.md`), mas nada garante que a máquina de 4 estados,
> a navegação do `_layout` raiz e a persistência do AsyncStorage se comportem no Expo Go.
> Enquanto este documento não estiver preenchido, a v0.3.1 é **dívida aberta**.

---

## Pré-requisitos

### Entrega no aparelho

`runtimeVersion.policy = "sdkVersion"` e o projeto EAS é `2147d4ae-6bfc-4c81-b582-1b115af6b830`.
Dois caminhos:

- **`npx expo start` + QR na mesma rede** ← preferido para esta validação. Erro aparece no
  terminal na hora e não consome update.
- `eas update` no canal que o Expo Go aponta.

⚠️ SDK 54 é TETO. Não tocar em `runtimeVersion` nem na versão do SDK para "resolver" nada
que aparecer aqui — quebra o Expo Go em silêncio.

### Contas necessárias

Os quatro estados só aparecem se existir conta para cada um. A conta *TESTE CLAUDE B* NÃO
serve (é phone-based, não loga) — deve ser recusada.

| Estado | Condição no banco |
|---|---|
| `deslogado` | nenhuma conta — é o boot limpo |
| `aguardando` | conta criada, `clientes.user_id` NULL, `app_acesso` = `bloqueado` |
| `pronto` (liberado) | `user_id` preenchido, `app_acesso` = `liberado`, sem fatura `OVERDUE` |
| `pronto` (inadimplente) | igual, mas com fatura `OVERDUE` ou `DUNNING_REQUESTED` |
| dependente | `titular_id` preenchido, `asaas_id` NULL |

**Ordem obrigatória:** executar o passo 3 ANTES de aprovar qualquer conta. Uma vez aprovada,
o estado `aguardando` só volta desfazendo no banco — e ele é o mais frágil dos quatro.

---

## Roteiro

Marcar cada passo: ✅ passou · ❌ falhou (descrever) · ⏭️ não testado

### 1. Boot limpo → `deslogado`
App fechado, sem sessão. Deve cair em `/login`.
Splash navy com spinner verde por um instante antes = correto (estado `carregando`).

- [ ] Resultado:

### 2. Cadastro
CPF, telefone, nome, senha (mín. 8, máx. 72).

🔒 A resposta é **deliberadamente vaga**. Mensagem específica ("CPF já cadastrado",
"telefone em uso", "conta não aprovada") é **BUG**, não melhoria — reabre enumeração de CPF.

Caminho torto: senha com 7 caracteres e telefone mal formatado devem ser barrados ANTES do POST
(`cpfValido` / `paraE164` em `src/lib/auth.ts`).

- [ ] Resposta genérica:
- [ ] Validação local barra formato inválido:

### 3. Login da conta nova → `aguardando`
**Teste mais importante do roteiro** — é o mais fácil de confundir com falha.

Esperado: entra e cai na tela "Quase lá" (selo de relógio).
**NÃO PODE:** spinner eterno · "erro ao carregar" · logout automático.

*Verificar de novo* → chama `recarregar()`, mostra `ActivityIndicator`, volta à mesma tela.
Isso é ACERTO. `aguardando` é estado normal do produto, nunca erro.

- [ ] Cai em "Quase lá":
- [ ] Botão verificar não quebra nem desloga:

### 4. Aprovação com o app aberto
Deixar o app parado em "Quase lá" → liberar a conta no ERP (`user_id` + `app_acesso`) →
voltar e tocar *Verificar de novo*. Deve atravessar direto para as tabs.

Sem realtime nem push nesta fase: esperar sem tocar no botão não faz nada. Projetado.

- [ ] Transição `aguardando` → `pronto`:

### 5. Tabs com conta liberada → `pronto`

- [ ] **Início / carteirinha** — nome e plano corretos.
      `plano` como `[object Object]` = normalização do embed PostgREST quebrou (`getCliente`).
- [ ] **Financeiro** — faturas reais, até 24, mais recentes primeiro. Link de pagamento abre.
- [ ] **Rede** — 5 parceiros mock + rodapé "rede em expansão". NÃO é bug (`REDE_E_MOCK`).
- [ ] **Perfil** — mostra **0.3.1**. Outra coisa = os três lugares do bump divergiram.
- [ ] **Vencimento** — `subscription_next_due` NULL → campo SOME. Sem "—", sem data inventada.

### 6. Inadimplente
Com fatura `OVERDUE`: módulos com `exige_pagamento` mostram cadeado + mensagem de regularizar.
Módulos sem `exige_pagamento` seguem abertos.

- [ ] Resultado:

### 7. Dependente
`titular_id` preenchido → Financeiro vem **VAZIO por construção** (`asaas_id` NULL, nenhum
pagamento com o `cliente_id` dele). A tela precisa tratar com elegância, não com lista quebrada.

- [ ] Resultado:

### 8. Logout e persistência
- [ ] Sair pelo Perfil → volta ao login.
- [ ] Fechar o app de vez e reabrir com conta liberada → restaura direto nas tabs, sem passar
      pelo login. Prova AsyncStorage + `INITIAL_SESSION`.

---

## Observar de canto de olho

**Navegação piscando** (vai para uma tela e volta) = alguma tela está navegando por conta
própria. Só o `_layout` raiz pode decidir rota por estado de sessão. Anotar qual tela e em
que transição.

---

## Resultado

**Status:** ⏳ não executado

**Falhas encontradas:**

**Decisão:** _(liberar v0.3.1 / abrir lote de correção com bump)_
