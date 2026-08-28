# 2026-08-28 — Preview web do app na Vercel

## O que foi feito

Colocamos o `dimplus-app` rodando no navegador, hospedado, para poder mostrar o app
sem instalar nada no aparelho de quem assiste.

- Projeto Vercel **`dimplus-web`** (`prj_ID3vTW9OGLQJQwR4jU7rIIOvvLHi`), conectado ao
  repo `dmgocupacional/dimplus-app`, branch de produção `main`.
- URL: **https://dimplus-web.vercel.app**
- O `vercel.json` que já existia no repo é o que a Vercel usa:
  `npx expo export --platform web --output-dir dist`.
- No `erp-dimplus`, **v0.278.0** (commit `7a2dfbe`) liberou CORS em
  `/api/public/app-login` para essa origem — sem isso o login não passa do preflight.

## Estado atual

Preview web funcional: as telas carregam e o login completa.

## Decisões tomadas (e porquê)

**CORS com allowlist de UMA origem, nunca `*`.** Em rota de login, `*` deixaria qualquer
site da internet disparar tentativas de senha usando o IP de quem visita — o rate-limit
por IP passaria a punir a vítima, não o atacante. Origem desconhecida sai sem o header.

**Os headers entram também no 401 e no 429.** Sem eles o navegador esconde o corpo da
resposta de erro, e o app mostra "falha de rede" em vez de "CPF ou senha inválidos".

**Deploy pelo repo, não pela `dist`.** Ver pegadinha abaixo.

## Pegadinhas descobertas

**🔴 Subir a pasta `dist` pronta NÃO funciona.** A Vercel descarta tudo que está dentro
de pasta chamada `node_modules` ao receber arquivos por CLI. O Expo põe as fontes em
`dist/assets/node_modules/@expo-google-fonts/nunito/` — então as cinco Nunito davam 404,
`useFonts` nunca resolvia, e `_layout.tsx` (`if (!fontesProntas) return <Splash/>`)
segurava o app no splash para sempre. Sintoma: tela azul girando, sem nenhum erro de JS.
Solução: deixar a Vercel buildar do repo, onde não há envio de arquivo e portanto não há
filtro.

**`expo export` recria a `dist` do zero** e leva junto o `.vercel/` — o vínculo do projeto
se perde a cada build.

**O CLI sugere "Link existing project" por padrão.** Com `erp-dimplus` na lista, um deploy
distraído com `--prod` publicaria o app por cima do ERP em produção. Conferir sempre a
linha `Linked` antes de seguir.

**Credenciais do app vivem em `app.json` → `extra`**, versionadas. Não há `.env` — não
procurar por um.

## Limites do preview web

Serve para aprovar visual e navegar telas. **Não** serve para validar comportamento:
o storage do Supabase no web é em memória (sessão não persiste entre reloads) e
componentes nativos renderizam de forma aproximada.

## Próximos passos

- Os demais endpoints públicos (`app-cadastro`, `app-termo-cadastro`, `cep`) seguem
  **sem CORS** — o fluxo de cadastro quebra no preview web. Liberar se necessário.
- `package-lock.json` do erp-dimplus está dessincronizado (marca `0.255.0` com o
  `package.json` em `0.278.0`) — pendente um `chore` para alinhar.
- **Reset de senha continua não existindo** no app. Não é esquecimento: a identidade é
  email sintético (`{cpf}@app.dimeg.com.br`, que não recebe nada) e o phone provider do
  Supabase está desligado. Hoje o caminho é refazer o cadastro → cai em `conta_existente`
  → staff resolve à mão. Decisão desta sessão: **esperar para fazer via WhatsApp**.
