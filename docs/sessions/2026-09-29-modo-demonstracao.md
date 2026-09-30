# Sessão 29/09/2026 — app: modo demonstração (web), mapa na web e robô do tutorial

Versões: **v4.33.1 → v4.34.5** (tudo no canal de TESTE e na versão web; o app das lojas não muda).
ERP correspondente: v0.389.0 → v0.394.1 — ver `erp-dimplus/docs/sessions/2026-09-29-bemvindo-vigent-demonstracao.md`.

## Entregue
- **Modo demonstração** (`src/lib/demonstracao.ts`), só na WEB com `?demo=<slug>`:
  entra sozinho na conta de demonstração da empresa (`entrarDemonstracao` em `src/lib/auth.ts` →
  `/api/public/app-demo-login`); guarda o slug em `sessionStorage` (a URL perde o `?demo=`);
  faixa "Modo demonstração" com seta **Voltar** (`FaixaDemo` em `_layout.tsx`); aceita do site
  (`bemvindo.<slug>.dimeg.com.br`, ou localhost) o pedido de tela `dimplus:ir` de uma lista
  fechada (`ROTAS_DEMO`); fecha a pilha antes de abrir, troca de aba sem empilhar, ignora a tela
  em que já está e avisa o site `dimplus:pronto`. Trava do clube desligada em demonstração.
- Escrita recusada pelo ERP vira `FeegowErroTipo 'demonstracao'` com a mensagem pronta; avisos de
  agendar/cancelar/remarcar com título "Modo demonstração".
- **`Alert.alert` na web** vira `alert`/`confirm` do navegador (`instalarAlertaWeb`): antes o
  "Confirmar agendamento?" e os avisos não apareciam no navegador.
- **Mapa das farmácias na web** (`<iframe srcDoc>`, toque no pin por postMessage) — 4.33.2.
- **Robô do tutorial** `scripts/tutorial_vigent/` (LEIA-ME): grava os capítulos e as telas do app
  real logado na conta de demonstração (Playwright, grava no tamanho da tela e amplia no ffmpeg,
  corta esperas). `cap_prototipo.py` ficou de referência (o protótipo de imagens saiu do site).

## Pegadinhas
- Na web as abas deixam telas antigas no DOM e recarregar desconecta.
- Pedido de tela repetido pelo site reabria a mesma tela e deixava uma cópia invisível por cima
  bloqueando toques — por isso o `dimplus:pronto` e o "já está nessa tela".

## Pendente
- 🔴 OTA de PRODUÇÃO ainda não disparado (Henrique segurou) — leva farmácias, Vigent, Família,
  admins, mapa e o que mais estiver no canal de teste.
- Play: 4.32.1 (10012) no teste interno; promover para produção depois do OTA.
