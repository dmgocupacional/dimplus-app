# Publicar nas lojas — manual de bolso

> **Caminho normal: automático.** Workflow `.github/workflows/publicar-lojas.yml` (disparado pela
> API do GitHub). Este arquivo é a RESERVA, para quando o automático falhar ou para conferir à mão.
> Textos das lojas: `fastlane/metadata`. Capturas: `scripts/capturas_lojas.py`.

## Antes de qualquer publicação
1. Versão nova nos três lugares: `app.json`, `package.json`, `src/lib/version.ts`.
2. Build de loja sempre das **duas plataformas juntas**, do mesmo commit.
3. Mudança só de JavaScript não precisa de loja: vai por OTA.

## App Store (manual)
1. **TestFlight**: o build novo tem de aparecer pronto (não "Processando").
2. **Distribuição → "+" ao lado de App para iOS** → número da versão igual ao do build.
3. **Capturas**: iPhone 6,9" (1320×2868) e **iPad 13" (2064×2752) obrigatórias** — o app declara iPad.
4. **O que há de novo** e, se mudou, descrição e texto promocional (este muda sem revisão).
5. **Build → Adicionar build**.
6. **Informações de revisão**: login demo `559.082.672-10` / senha nos segredos (`DEMO_SENHA`);
   nas notas, deixar claro que o SOS só abre a discagem 192/193 e não aciona o socorro.
7. **Privacidade do app**: conferir com a política (`https://erp-dimplus.vercel.app/privacidade`).
8. **Adicionar para revisão → Enviar**. Lançamento: automático depois de aprovado.

## Play Store (manual)
- App: `com.javenessi.dimmsaude`, conta de organização "Dimeg".
- **Testar e lançar → Produção → Criar nova versão** → subir o `.aab` → notas → revisar → lançar.
- versionCode do build tem de ser maior que o publicado.
- Capturas: **proporção até 2:1** — o formato do iPhone 6,9" é recusado; usar 1080×1920.

## Credenciais (cofre da DIMEG, nunca no repositório)
- Chave de upload Android: `dimplus-upload.jks`, alias `dimeg-upload`.
- Chave de API da App Store Connect: "Automacao DIM+ GitHub", Key ID `G54TZ2S6BJ` (`.p8` só baixa uma vez).
- Conta de serviço do Google Play: pendente (segredo `GOOGLE_SA_JSON`).
