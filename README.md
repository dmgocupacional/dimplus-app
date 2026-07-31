# DIM+ Saúde — App

App mobile de cartão de benefícios (Android + iOS). Expo / React Native.

**v0.3.1 · FASE 1b (provisória) — auth por CPF + senha, dados reais do Supabase.**

## Rodar

```bash
npm install
npx expo start
```

Leia o QR code com o **Expo Go** (loja de apps). Não precisa de conta, build ou Vercel.

## Estado

| | |
|---|---|
| Auth | ✅ **CPF + senha, sem OTP.** A identidade real é um email sintético do CPF, montado no ERP (o phone provider do Supabase está desligado — ver `erp-dimplus/src/lib/app-identidade.ts`) |
| Dados | ✅ **Supabase real**, exceto a rede parceira (ver abaixo) |
| Gate | 🟡 stub de UI (`src/lib/gate.ts`). O gate real é `fn_cliente_pode` no banco, via RLS |
| Telas | ✅ Login · Cadastro · Aguardando aprovação · Início (cartão) · Rede · Financeiro · Perfil · Ajuda |
| Rede parceira | 🟡 **ainda mock** — não existe tabela de parceiros no banco. Ver `src/lib/data.ts` |
| Reset de senha | ❌ sem caminho automático (não há canal de mensagem). Cai na fila do ERP |

### Como a sessão decide a tela

`src/state/session.tsx` tem QUATRO estados e o `src/app/_layout.tsx` é o **único** lugar que
navega a partir deles:

- `carregando` → splash
- `deslogado` → `(auth)/login`
- `aguardando` → `(auth)/aguardando`
- `pronto` → `(tabs)`

⚠️ **`aguardando` não é erro.** A conta nasce inerte de propósito: loga, mas `clientes.user_id`
segue NULL e `app_acesso` segue `bloqueado`, então o RLS não devolve nada. Quem torna a conta
funcional é a aprovação do staff em `/dashboard/app` → Solicitações.

⚠️ **As mensagens de erro do login e do cadastro são vagas de propósito.** Detalhar ("CPF não
encontrado", "telefone já cadastrado") reconstruiria o oráculo de enumeração de CPF que as
rotas públicas foram desenhadas para não ser.

## Onde mexer

- `src/lib/data.ts` — **o contrato**. Já são queries reais; as assinaturas continuam as
  mesmas da fase mock, que é por isso que nenhuma tela precisou mudar junto.
- `src/lib/gate.ts` — cópia da álgebra de `fn_cliente_pode`. Se a função mudar no banco,
  este arquivo muda junto.
- `src/theme/tokens.ts` — paleta oficial (brand book de Luís Fonseca).
- `src/lib/auth.ts` — cadastro, login e logout. Fala com `/api/public/app-cadastro` e
  `/api/public/app-login` no erp-dimplus.
- `src/lib/supabase.ts` — cliente único. Não criar um segundo: dois clientes brigam pelo
  refresh do token.

## Antes de tocar em qualquer policy do Supabase

O app divide o banco `bhrxfudnhxqntnnbgyjg` com o **erp-dimplus**. Leia a seção
**⚔️ Fronteira ERP × App** do
[ROADMAP-APP](https://github.com/dmgocupacional/erp-dimplus/blob/main/docs/ROADMAP-APP.md).
Uma policy `authenticated USING(true)` deixou de ser inofensiva — vira vazamento.

## Marca

Logos em `assets/brand/`, extraídos do **vetor** do brand book (não recriados).
O SVG nativo ainda deve vir do Luís. Fonte: Nunito (fallback livre da Congenial,
que é comercial).

## Versão

Bump em toda entrega, nos **três** lugares, no mesmo commit:
`src/lib/version.ts` + `package.json` + `app.json`.

## Preview web (só para aprovar o visual)

`npm run build:web` gera `dist/` estático, publicado na Vercel via `vercel.json`.

⚠️ **A web NÃO prova que o app funciona.** É o React Native renderizado como HTML:
cor, tipografia, layout e navegação são fiéis; toque, gesto, splash e comportamento
nativo, não. Serve para aprovar o visual. A validação de verdade é APK (EAS) ou Expo Go.

## Abrir o app no celular (sem instalar nada)

1. Instale o **Expo Go** (App Store / Play Store)
2. Abra este link no celular:

```
exp://u.expo.dev/2147d4ae-6bfc-4c81-b582-1b115af6b830?channel-name=preview&runtime-version=exposdk:54.0.0
```

Todo push na `main` republica o app via GitHub Actions (`.github/workflows/expo-update.yml`).
Feche e reabra o Expo Go para pegar a versão nova.

**Cuidado:** `runtimeVersion.policy` está como `"sdkVersion"` de propósito — é o que torna o
update legível pelo Expo Go. Trocar para `"appVersion"` faz o Expo Go parar de abrir o
projeto, e o erro é silencioso.
