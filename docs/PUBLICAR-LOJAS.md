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
- Fluxo (02/10/2026): `publicar-lojas.yml` faz build → teste interno → **promove sozinho para
  produção** (input `promover_producao`, ligado por padrão). A **publicação gerenciada foi desligada**
  no Play Console em 02/10/2026: o que o workflow manda vai direto para a revisão do Google. Se alguém
  religar, toda versão volta a esperar o clique em Publicar. `promover-android.yml` segue como reserva.
- iOS: se o fastlane falhar ao enviar para revisão (Apple ainda processando o build), o workflow
  tenta de novo pela API por até 30 min. Reserva manual: workflow "Apple - diagnóstico de envio"
  com `enviar=sim`.
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
- **Cópia de segurança no GitHub** (02/10/2026): segredos `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD` e `ANDROID_KEY_ALIAS` no dimplus-app. Segredo não se lê pela tela;
  para recuperar o `.jks`, rodar um workflow que faça
  `echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > dimplus-upload.jks` e publique como artefato.
- Chave de API da App Store Connect: "Automacao DIM+ GitHub", Key ID `G54TZ2S6BJ` (`.p8` só baixa uma vez).
- Conta de serviço do Google Play: `dimplus-publicacao@dimplus-play.iam.gserviceaccount.com`,
  segredo `GOOGLE_SA_JSON` no GitHub.
