# 2026-09-10 — Esqueci minha senha e e-mail no cadastro (v4.1.0)

**Repo:** `dimplus-app` v4.0.1 → **v4.2.0**.

> **✅ ENVIADO PARA REVISÃO na App Store em 10/09.** O bloqueio de produto que abriu a sessão
> ("não existe esqueci minha senha") foi resolvido e submetido no mesmo dia. Contraparte no `erp-dimplus` v0.298.0 → v0.302.0
(handoff detalhado lá em `docs/sessions/2026-09-10-recuperacao-acesso-adesao-convite-mcp-vercel.md`).

---

## O que mudou aqui

- **`src/app/(auth)/recuperar.tsx`** (nova). A pessoa informa o CPF; o ERP emite um token e
  envia por e-mail um link que abre uma página web onde ela define a senha nova.
- **`login.tsx`** — o rodapé que dizia *"fale com a central pelo telefone da sua unidade"* virou
  link real para a tela nova. Essa frase era a dívida datada de 28/08 impressa na interface.
- **`cadastro.tsx`** — campo de **e-mail**, opcional.
- **`lib/auth.ts`** — `recuperarAcesso()` e `emailValido()`.

Bump nos três lugares de sempre: `package.json`, `app.json`, `src/lib/version.ts`.

---

## Decisões que a próxima sessão precisa respeitar

**A tela nunca diz se o CPF existe.** Mesma mensagem havendo conta ou não, tendo e-mail
cadastrado ou não. E **não mascarar o destino** (`j***@gmail.com`): é padrão comum em outros
apps e é exatamente o vazamento que o desenho evita — confirma que o CPF existe e entrega o
formato do endereço de outra pessoa.

**O e-mail é opcional, e não por descuido.** Há builds antigos instalados na rua que não enviam
o campo; obrigatório faria todos receberem 400 no cadastro — quebra silenciosa que, do lado do
usuário, parece app quebrado. Vazio vai como `undefined`, **nunca string vazia**: `''` falharia
o `z.string().email()` da rota e derrubaria o cadastro inteiro.

**`emailValido()` é frouxo de propósito.** A validação que vale é a do Zod na rota; regex
apertada aqui recusaria endereços válidos (TLD longo, `+` no local part) antes de o servidor
ver.

**O canal é e-mail, não WhatsApp.** Contraria o que este roadmap vinha assumindo desde 28/08. O
WhatsApp entra depois como segundo transporte, **sem mexer nesta tela** — o app só chama
`/api/public/app-recuperar` e não sabe por onde a mensagem sai.

---

## Correções e adições do mesmo dia

**v4.1.1 — a tela `recuperar` era INALCANÇÁVEL.** Abria e voltava sozinha para o login, sem
erro nenhum. O roteador do `_layout` raiz tem uma **lista fechada** de telas alcançáveis por
quem está deslogado, e só `login` e `cadastro` estavam nela.
🔴 **Mesmo modo de falha já documentado em 26/08**, quando `aceite-termo` existia e não era
alcançável por rota nenhuma. A lição estava escrita e não tinha virado guarda. Agora o
comentário avisa: **toda tela nova em `(auth)` que deva abrir sem sessão precisa entrar ali.**

**v4.2.0 — bloco "não tenho e-mail cadastrado".** Recolhido por padrão (a maioria só precisa do
CPF). Aberto, exige os **três juntos**: e-mail, nascimento e telefone. Mandar só o e-mail não
adianta — o servidor descarta sem a segunda prova — e permitir isso produziria a mesma mensagem
de sucesso sem nada acontecer, que é a pior confusão possível.
Quem **já tem** e-mail recebe no endereço antigo e o informado é ignorado pelo servidor.

---

## O que ainda não funciona

**O botão só aparece depois de um build novo** (ou update OTA no canal `preview`).

**Nada emite token de `primeiro_acesso`.** Isso é do webhook do Asaas, na confirmação do
pagamento (Fase 3, no ERP). Hoje só a recuperação fecha ponta a ponta.

---

## Próximos passos no app

1. **Acompanhar a revisão da App Store.** Se vier rejeição, o caminho mais provável agora é
   metadados/ficha — o fluxo de acesso deixou de ser o ponto fraco.
2. Testar a recuperação num aparelho de verdade, incluindo o caminho de quem **não tem** e-mail
   cadastrado. O teste que mais importa: CPF inexistente e CPF existente com dados errados têm
   que devolver resposta **idêntica**.
3. **Play Store: nada existe ainda.** Nenhum build Android jamais rodou neste projeto. Falta
   conta no Play Console (US$ 25, verificação com dias de espera), `applicationId` novo
   (sugerido `br.com.dimeg.dimplus` — o bundle iOS `com.javenessi.dimmaissaude` não serve),
   keystore e Data Safety.
