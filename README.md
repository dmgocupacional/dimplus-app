# DIM+ Saúde — App

App mobile de cartão de benefícios (Android + iOS). Expo / React Native.

**v0.1.0 · FASE 1c — telas do MVP, sem auth.**

## Rodar

```bash
npm install
npx expo start
```

Leia o QR code com o **Expo Go** (loja de apps). Não precisa de conta, build ou Vercel.

## Estado

| | |
|---|---|
| Auth | ❌ **FASE 1b, bloqueada** — decisão pendente do canal de OTP (Twilio SMS × WhatsApp) |
| Dados | 🟡 **100% mock** (`src/lib/data.ts`). Zero chamada ao Supabase |
| Gate | 🟡 stub de UI (`src/lib/gate.ts`). O gate real é `fn_cliente_pode` no banco, via RLS |
| Telas | ✅ Início (cartão) · Rede · Financeiro · Perfil · Ajuda |

## Onde mexer

- `src/lib/data.ts` — **o contrato**. A FASE 1b troca o corpo destas funções por queries
  no Supabase. As assinaturas não mudam, e nenhuma tela muda junto.
- `src/lib/gate.ts` — cópia da álgebra de `fn_cliente_pode`. Se a função mudar no banco,
  este arquivo muda junto.
- `src/theme/tokens.ts` — paleta oficial (brand book de Luís Fonseca).
- `src/app/dev.tsx` — painel para exercitar o gate no celular. **Morre na 1b.**

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
