# Sessão 24–25/09/2026 — rede real, SOS com mapa e cartão farmácia automático

Continuação de `2026-09-23-clube-sos-e-publicacao-automatica.md`. App v4.24.0 → **v4.26.0**.
Lado do ERP: `erp-dimplus/docs/sessions/2026-09-25-reconciliacao-e-vidalink.md`.

## Estado nas lojas (25/09)
- **App Store:** 4.23.0 **aprovada e publicada** (lançamento automático). Recebe o JavaScript novo pelo
  canal `production`.
- **Play Store:** app publicado como `com.javenessi.dimmsaude`; esperando o Google aprovar a
  redefinição da chave de upload. A chave `dimeg-upload` (SHA-256 `B9:78:37…`) **já está cadastrada no
  EAS como padrão do pacote** — o build de loja já sai com ela.

## O que entrou
- 🔴 **Fim dos parceiros fictícios na Rede** — mostrava Drogaria São Paulo, Droga Raia, Delboni e
  OdontoCare escritos à mão. Agora: 6 unidades DIMEG reais (tabela `unidades`), localizador oficial
  Vidalink (convênio `CT000560`) e o clube. v4.24.0
- **SOS com mapa** (Leaflet + OpenStreetMap no WebView já existente) e "Abrir no mapa". v4.24.0
- **Cartão Vidalink oficial em imagem** na tela do clube. v4.25.0
- **Sincroniza com o parceiro ao abrir o clube.** v4.25.1
- **Saída do clube depois de ativar o cartão** (pessoa ficava presa: tela aberta pela trava sem
  histórico e sem botão; trava não liberava `clube-web`). v4.25.2
- **Cartão farmácia ativado sozinho**: sai a tela "gere no site" e a reserva manual; o ERP ativa e a
  tela "Ativando seu cartão de farmácia" só espera. A saída dispensa a trava na sessão. v4.26.0

## OTA para os clientes
Workflow manual **`ota-producao.yml`** (canal `production`), disparado pela API do GitHub. A 4.0.1 e
a 4.23.0 usam o mesmo runtime; o workflow **barra módulo nativo importado no topo**. Usado em cada
correção desta sessão.

## Aparelhos de teste
- iPhone do Pedro cadastrado; dev build iOS `c6f5b824` (Henrique + Pedro).
- Android do Thiago: dev build `8e1314dc` (assinado com `dimeg-upload`). Conectar em
  `https://u.expo.dev/2147d4ae-6bfc-4c81-b582-1b115af6b830?channel-name=preview`.

## Pegadinhas
- 🔴 Toda tela aberta pela trava (router.replace) precisa de **saída explícita**.
- 🔴 Não listar empresa na Rede sem parceria real.
- Cópia local do Henrique precisa de `git pull` **e** `npm install` antes de `eas credentials`
  (sem isso lê o pacote antigo e o `expo config` quebra).
- Modo Desenvolvedor do iOS só aparece depois de instalar o app de teste.

## Aberto
- Tela **nativa de farmácias** — depende da documentação do José.
- Build Android de loja depois da aprovação da chave pelo Google (+ conta de serviço para envio automático).
- Layout de iPad; SOS fora das capturas.
