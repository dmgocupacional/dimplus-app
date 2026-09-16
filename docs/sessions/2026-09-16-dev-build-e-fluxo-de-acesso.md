# Sessão 11–16/09/2026 — dev build e fluxo de acesso

`v4.2.0` → **`v4.12.1`**

O handoff completo, com os números e o lado do servidor, vive no ERP:
`erp-dimplus/docs/sessions/2026-09-16-fluxo-de-acesso-ponta-a-ponta.md`. Aqui fica o que é
específico do app.

---

## Saímos do Expo Go

O Expo Go se atualiza sozinho pela App Store e derruba o projeto sem aviso. Em 04/09 o
cliente pulou para o SDK 57 com o projeto na 54 e a aba Projects nunca mais listou o
projeto — nem depois da migração. Isso não era cosmético: era o Henrique testando um
bundle que ele não controlava.

**Agora é development build.**

- `expo-dev-client` + perfil `development` no `eas.json`
  (`developmentClient: true`, `distribution: internal`, `channel: preview`, **sem**
  `autoIncrement` — para não mexer no `buildNumber` remoto)
- iPhone registrado com `eas device:create`, provisioning profile ad hoc criado
- Distribution certificate **reusado** (`CZ6Q7B8392`) — a Apple limita a dois

**A etapa interativa foi uma vez só.** Build novo agora sai por MCP: `Expo:build_run`,
`appId 2147d4ae-6bfc-4c81-b582-1b115af6b830`, perfil `development`.

**Gotchas do caminho:**
- Distribuição interna **não funciona** com as credenciais de App Store. O primeiro build
  morreu em *"couldn't find any credentials suitable for internal distribution"* — é o
  provisioning ad hoc com UDID que falta, e criá-lo exige 2FA da Apple
- iOS 16+ exige **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor**, com reinício
- No launcher, a aba **Home** procura servidor local; para carregar o que subiu é a aba
  **Updates**

---

## Telas do fluxo de acesso

### `login.tsx` — duas portas separadas
O link "Primeiro acesso?" mandava para `/cadastro`, que é a tela de quem **não** é cliente:
o cliente que já paga se cadastrava de novo e caía em `conta_existente`. Agora:

    Já é cliente e nunca entrou?  → /primeiro-acesso   (nova)
    Ainda não é cliente?          → /cadastro          (como era)

### `primeiro-acesso.tsx` — nova
CPF + e-mail + nascimento + telefone (**todos obrigatórios**: não há canal cadastrado a
provar, então a segunda prova é a única barreira), termo vigente exibido, aceite coletado.

O aceite **viaja no token** e só vira assinatura quando o link do e-mail é clicado.

### `recuperar.tsx` — reescrita em duas etapas
Etapa 1 manda só o CPF para a triagem. Conforme o desfecho:

| desfecho | tela |
|---|---|
| `bloqueado` | modal **Cadastro bloqueado** + telefone + WhatsApp |
| `sem_plano` | modal **Cadastro incompleto** + telefone + WhatsApp |
| `sem_conta` | "ainda não criou o acesso" → leva ao primeiro acesso |
| `nao_cliente` | "não encontramos esse CPF" + convite |
| `tem_email` | mostra `****ludo@gmail.com`, pede o e-mail **completo** |
| `sem_email` | pede e-mail + nascimento + telefone, obrigatórios |

### `Campo.tsx` — duas props novas
- `editable` — trava o CPF depois da consulta
- `invalido` — borda vermelha **sem** texto próprio embaixo, para quando vários campos são
  apontados com uma mensagem única

---

## Pegadinhas descobertas

**🔴 `open(f,'w').write(open(f).read()...)` TRUNCA O ARQUIVO.** O Python avalia
`open(f,'w')` primeiro. Zerou o `version.ts` para 0 bytes; `APP_VERSION` deixou de ser
exportado e **duas publicações do EAS Update falharam**. O `tsc` local passou porque rodou
antes do bump. **Ler para uma variável antes de abrir para escrita.**

**Aspas duplas em mensagem de commit quebram o `eas update`.** O workflow passa a mensagem
como `--message`; `"Esqueci minha senha"` virou argumento solto e o CLI recusou com
*"Unexpected arguments: minha, senha"*. **Sem aspas duplas em commit neste repo.**

**O telefone do DIM+ estava errado.** `ajuda.tsx` tinha `5511995192094`; o correto é
`5511995193094` — **(11) 99519-3094**, que o ERP já tinha certo no balcão. Quem procurou a
central pelo app até 16/09 caiu num número que não é da DIMEG. Corrigido nos três arquivos,
mas o valor segue **duplicado**: vale uma fonte única.

---

## Alarme novo

`expo-update.yml` ganhou um passo `if: failure()` que **abre issue no GitHub** quando a
publicação falha, avisando que o bundle no aparelho é o da publicação **anterior**.

Nasceu de um dia perdido: o workflow falhou calado quatro vezes esta semana e o Henrique
seguiu testando código velho achando que olhava o atual. Precisa de
`permissions: issues: write` — sem isso o próprio alarme falharia em silêncio.

---

## Aberto

Ver o handoff do ERP para a lista completa. Do lado do app, o que impede republicar na loja
é a **elegibilidade** (cancelado mantém acesso; dependente não deriva do titular) e o
**termo por natureza**. Decisão do Henrique em 15/09: não republicar com melhoria
identificada em aberto.

Na App Store está a **v4.0.1 (build 3)**. Tudo daqui em diante ficou em dev build e OTA.
