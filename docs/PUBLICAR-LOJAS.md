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

## Play Store
- App: `com.javenessi.dimmsaude` (o PACOTE é para sempre esse; a redefinição de 23/09 trocou só a
  CHAVE DE UPLOAD), conta de organização "Dimeg". Verificação de desenvolvedor Android: já registrado.
- Fluxo: `publicar-lojas.yml` manda o `.aab` para o **teste interno** → `promover-android.yml`
  (disparo manual, input `version_code`) leva para **produção** → 🔴 **a publicação gerenciada está
  ligada**: alguém precisa clicar **Publicar** no Play Console (Visão geral da publicação). Sem o
  clique a versão fica parada — foi o que segurou a 4.34.5 de 30/09 a 02/10/2026.
- Manual: **Testar e lançar → Produção → Criar nova versão** → `.aab` → notas → revisar → lançar.
- versionCode do build tem de ser maior que o publicado.
- Capturas: **proporção até 2:1** — o formato do iPhone 6,9" é recusado; usar 1080×1920.
- Ficha (Presença na loja → Páginas de detalhes do app → **Editar página de detalhes padrão**):
  ícone 512×512 (`fastlane/metadata/android/pt-BR/images/icon.png`) e recurso gráfico 1024×500
  obrigatório.
- O envio pelo conector do Expo falha ("conflict between exclusive peers"): usar os workflows.

## Credenciais (cofre da DIMEG, NUNCA no repositório)
- Chave de upload Android: `dimplus-upload.jks`, alias `dimeg-upload`, SHA1 `FC:27:32:C2:…:30:C3:0D`,
  SHA256 `B9:78:37:C6:…`. Senha no `CREDENCIAIS-LEIA.txt` que acompanha o `.jks` (cópia no
  computador do Henrique, Downloads). Cadastrada no EAS como padrão do pacote (recadastrada em
  02/10/2026 depois de o identificador ter sido apagado no Expo). Para recadastrar:
  `eas credentials -p android` → production → Keystore → Set up a new keystore → Generate? **NÃO**
  → caminho do `.jks` → senha → alias → senha.
- Chave de API da App Store Connect: "Automacao DIM+ GitHub", Key ID `G54TZ2S6BJ` (`.p8` só baixa uma vez).
- Conta de serviço do Google Play: `dimplus-publicacao@dimplus-play.iam.gserviceaccount.com`,
  segredo `GOOGLE_SA_JSON` no GitHub.
