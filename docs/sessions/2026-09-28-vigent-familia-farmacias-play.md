# Sessão 28–29/09/2026 — app: farmácias com mapa, inclusos, Família, Vigent, admins, Google Play

Versões: **v4.26.0 → v4.33.1** (canal de TESTE). O OTA de PRODUÇÃO ainda NÃO foi disparado.
ERP correspondente: v0.388.0 — ver `erp-dimplus/docs/sessions/2026-09-28-vigent-beneficios-farmacias.md`.

## Entregue
- **Farmácias**: tela nossa (`/farmacias`) com dados do erp, perto de mim (GPS com limite de 8 s),
  distância por coordenada, filtros; **mapa** (`src/components/MapaFarmacias.tsx`, Leaflet/OSM no
  WebView como o SOS, pins + ponto azul, card ao tocar). Plano B: `/farmacias-vidalink` (WebView
  do localizador deles).
- **Seus inclusos** (`src/components/InclusosCard.tsx`) na home; **faixa amarela** em Meus
  agendamentos com prazo das 24h; aviso antes de cancelar/remarcar em cima da hora.
  Dados: `src/lib/beneficios.ts` → `/api/app/beneficios`.
- **Família** como ABA (`(tabs)/familia.tsx` reexporta `dependentes.tsx`): carteirinha do titular
  no topo e dos dependentes; "acesso até" no plano empresarial; inclusão pelo RH.
- **Aceite**: "Custeado por <empresa>" sem vencimento/forma no plano faturado; caixa separada de
  consentimento de saúde quando o termo exige.
- **Plano faturado (Vigent)**: sem aba/atalho Financeiro. Clube: segue `plano.inclui_clube`.
- **Admins** (Henrique, Thiago, Pedro): sem travas; "Ver como plano…" no Perfil com faixa na home.
- **Clube**: formulário pede CELULAR COM DDD quando falta (o Gestor exige para criar o usuário).
- Tokens: `color.warningBg`.

## Google Play
- Chave de upload `dimeg-upload` aprovada (SHA-1 FC:27…C3:0D bate Play × EAS).
- Conta de serviço `dimplus-publicacao@dimplus-play.iam.gserviceaccount.com`; segredo
  `GOOGLE_SA_JSON` no GitHub (permissão conferida pela API).
- versionCode é REMOTE no EAS e estava em 3 (a Play tem 10010): `eas-versao-android.yml` gravou
  10011; o build 4.32.1 saiu com **10012** e está na faixa **internal** (lista "Admin DIM+").
- `eas.json` envia para `internal`; `publicar-lojas.yml` só sobe a ficha pública com
  `ficha_android: true`.
- Próximo: testar pela Play → OTA de produção → promover a 10012 para produção (sair da 1.0.1).

## Pegadinhas
- Mensagem do update vai no link do dev build: commit com `+`/`|` quebrou no iPhone. O preview
  agora usa só a 1ª linha limpa.
- `(tabs)/_layout.tsx` usa `useSession` para esconder o Financeiro; a Família é aba para todos.
- Admin "vê como" o plano, mas as ações continuam autorizadas pelo erp com o cadastro REAL.
