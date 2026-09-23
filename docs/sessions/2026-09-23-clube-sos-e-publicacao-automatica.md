# Sessão 16–23/09/2026 — clube, SOS e publicação automática nas lojas

App v4.12.1 → **v4.23.0**. Lado do ERP (elegibilidade, rotas do Dr. Achei, privacidade):
`erp-dimplus/docs/sessions/2026-09-23-elegibilidade-drachei-lojas.md`.

## Estado nas lojas (23/09, fim da sessão)

| Loja | Situação |
|---|---|
| **App Store** | **4.23.0 (build 4) aguardando revisão**, lançamento **automático** depois de aprovada. Na loja segue a 4.0.1 até lá |
| **Play Store** | App **já publicado desde 19/01/2026** como `com.javenessi.dimmsaude`, ~100 instalações, conta de organização "Dimeg". **Aguardando o Google aprovar a redefinição da chave de upload** (pedida em 23/09) |

## O que entrou

- **Régua única** de elegibilidade nas telas (`fn_minha_elegibilidade`); cancelado aparece como
  "inativo"; FAQ de cancelamento aponta para o WhatsApp (sem botão de cancelar — decisão do Henrique).
- **Clube de descontos** abre **dentro do app em WebView** (`/clube-web`), já autenticado pelo link do
  `/auth/clube`, com o cabeçalho do DIM+. Navegação presa ao clube; iframes (reCAPTCHA) carregam.
- **Cartão Vidalink**: o botão vai direto a `cartaodedescontos.com.br/cartao-farmacia`; o número do
  cartão **é o CPF do titular** e entra no app sozinho — a tela escuta o `POST vidalink/active` e lê
  `vidalink_expire_date` das respostas do site. Carrossel mostra validade e "vencido".
- **Telemedicina** ligada, no navegador embutido (vídeo em WebView falha em Android), com confirmação
  antes, porque cada toque cria um atendimento real.
- **SOS**: ligar 192/193, endereço aproximado pela localização, compartilhar o link do mapa.
  **Isento das travas de termo e clube.** O app **não aciona** o socorro, e a tela diz isso.
- Dependências nativas novas: `expo-web-browser`, `react-native-webview`, `expo-location` — **todas
  carregadas de forma tardia**, com checagem de presença no binário.

## Publicação automática

- Workflow **`.github/workflows/publicar-lojas.yml`**, disparável pela API do GitHub: capturas →
  build EAS com `--auto-submit` → textos e capturas pelo fastlane → no iOS, espera o processamento e
  envia para revisão. **Lançamento automático nas duas lojas** (decisão do Henrique).
- **Fonte única dos textos:** `fastlane/metadata` (puxados da App Store Connect em 23/09).
- **Robô de capturas:** `scripts/capturas_lojas.py` — entra com a conta demo na versão web e fotografa
  iPhone 6,9", iPad 13" e Android 1080×1920. Testado no próprio GitHub (12 capturas).
- Segredos no GitHub: `EXPO_TOKEN`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `DEMO_CPF`,
  `DEMO_SENHA`. **Falta `GOOGLE_SA_JSON`** — o job Android pula até existir.
- Workflows do EAS `enviar-ios.yml` / `enviar-android.yml` (envio do último build de produção).
  🔴 Não rodar o `enviar-android` com o build `d34426a9`: ele saiu com o pacote errado.

## Pegadinhas descobertas

- 🔴 **Eu consultei o pacote errado em 16/09** (`com.javenessi.dimmaissaude`, que é o bundle iOS) e
  concluí que o app não existia na Play Store. Ele existia como `com.javenessi.dimmsaude`, com usuários.
  Daí a troca para `br.com.dimmsaude.app`, revertida em 23/09. **Conferir a loja pelo console, nunca
  por dedução a partir do código.**
- 🔴 **Módulo nativo importado no topo derruba o app inteiro em binário antigo** — a `runtimeVersion`
  (`sdkVersion`) não distingue binários com módulos diferentes. Sempre carregar tarde.
- **O workflow de OTA exporta `--platform all`, inclusive web.** No react-native-web o
  `TurboModuleRegistry` não existe; a v4.19.0 caiu no export por isso. Validar com
  `expo export --platform all`, não só Android e iOS.
- **Script injetado no WebView vive dentro de template string do TS**: nada de barra invertida
  (regex) nele — reescrito com `indexOf`.
- **O conector do Expo não consegue enviar à Apple** ("conflict between exclusive peers"), mesmo sem
  senha de app cadastrada. O caminho é o workflow — que funcionou e foi recusado só por build
  duplicado, provando o envio feito pelo terminal.
- **Play Store recusa captura com proporção maior que 2:1** — o formato do iPhone 6,9" não serve lá.
- No plano gratuito do EAS, build Android e envio iOS ficaram presos na fila de baixa prioridade.
  O Henrique assinou o **Starter** em 23/09. Política de builds combinada: build só para mudança
  nativa ou versão de loja; o resto é OTA.

## Credenciais geradas nesta sessão (fora do repositório — cofre da DIMEG)

- **Chave de upload Android** `dimplus-upload.jks`, alias `dimeg-upload`, SHA-256 `B9:78:37:C6…`.
  Pedido de redefinição feito no Play Console com o `upload_certificate.pem`.
- **Chave de API da App Store Connect** "Automacao DIM+ GitHub", Key ID `G54TZ2S6BJ`, papel Gerente
  de apps. O `.p8` só baixa uma vez.

## O que ficou aberto

1. **Google aprovar a chave de upload** → Henrique roda `eas credentials -p android` e sobe o `.jks`
   → build Android com versionCode acima do publicado (**pedir o número ao Henrique**) → envio.
2. **Conta de serviço do Google** → segredo `GOOGLE_SA_JSON` → Android no fluxo automático.
3. Layout de iPad (hoje é o de celular esticado) · SOS fora das capturas (web não tem GPS).
4. O fluxo automático só rodou em teste, sem tocar nas lojas. A **primeira publicação real** por ele
   será a próxima versão — acompanhar de perto.
