# 02/10/2026 — Play em produção, chave recadastrada e ícone claro

## Feito
- **v4.34.5 no ar na Play (produção, 100%).** O `promover-android.yml` tinha promovido o 10013 em
  30/09, mas a publicação gerenciada segurou até o Henrique clicar Publicar hoje.
- **Chave de upload recadastrada no EAS.** O identificador `com.javenessi.dimmsaude` foi apagado no
  Expo por engano; o `dimplus-upload.jks` foi subido de novo (SHA1 `FC:27…30:C3:0D`, confere com o
  Play Console). Nada mudou no Google.
- **Ícone claro** com o logo oficial SELO, extraído em vetor do brand book (v4.34.6, `3f50f1f`):
  `icon.png` 1024, adaptativo com fundo `#FFFFFF` e `icon.png` 512 da ficha da Play.
- **Publicação 4.34.6 nas duas lojas disparada** (run 37003683491, ficha Android ligada, revisão Apple
  ligada). Ícone e recurso gráfico 1024×500 também subidos à mão na ficha da Play.
- **Textos das lojas alinhados** (`ea13a38`): nome `DIM+ Saúde` nas duas; breve descrição da Play
  igual ao subtítulo da Apple. Descrição completa já era idêntica.

## Decisões
- Ícone do app = versão CLARA (fundo branco) do logo SELO.
- Senhas e `.jks` ficam fora do repositório (cofre / segredos do GitHub).

## Pegadinhas
- Pacote ≠ chave: `com.javenessi.dimmsaude` é o nome do app e não muda; a chave é da DIMEG.
- No Expo, **não apagar** identificadores em Project credentials: leva o keystore junto.
- Promover no workflow não basta com publicação gerenciada ligada: precisa clicar Publicar.
- Ícone do celular é mudança nativa: só troca com build de loja, nunca por OTA.

## Próximos passos
1. Quando o build Android da 4.34.6 cair no teste interno: `promover-android.yml` com o
   versionCode novo → clicar Publicar no Play Console.
2. Acompanhar a revisão da Apple da 4.34.6.
3. Avaliar desligar a publicação gerenciada na Play.
4. Guardar `.jks` + `CREDENCIAIS-LEIA.txt` no cofre de senhas da DIMEG (hoje só no Downloads).

---

# Segunda parte do dia — publicação automática, cadastro e clube

## Feito
- **Publicação 100% automática** (`8be84ca`, `32fa260`): `publicar-lojas.yml` promove sozinho o Android do teste
  interno para produção (input `promover_producao`, padrão ligado) e, no iOS, reenvia para revisão pela API se a
  Apple ainda estiver processando o build. Publicação gerenciada **desligada** na Play pelo Henrique.
- **Workflow "Apple - diagnóstico de envio"** (`929fff0`): mostra o estado da versão e, com `enviar=sim`, manda
  para revisão. Foi assim que a 4.34.6 entrou em "Aguardando revisão" (a falha era só timing do processamento).
- **Chave Android nos segredos do GitHub** (`1e02a79`): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` (SHA1 conferido `FC:27…30:C3:0D`).
- **Ficha da Play**: ícone 512 e recurso gráfico 1024×500 subidos; nome `DIM+ Saúde` igual nas duas lojas (`ea13a38`).
- **v4.36.0/4.36.1 por OTA** (`287a362`, `30aa211`): cadastro pede sexo, cidade de nascimento e e-mail
  (obrigatórios); clube só confirma a data de nascimento; `exames.tsx` passou a abrir o navegador por
  `abrirUrl` de `lib/clube` (import no topo barrava o OTA). Resultados de exames (4.35.0) foram junto — aprovado.

## Estado das lojas (fim do dia)
- Play: 4.34.6 (10014) promovida e publicada pelo Henrique.
- Apple: 4.34.6 (6) em "Aguardando revisão" desde 12:47 UTC.

## Pegadinhas
- Ícone e qualquer módulo nativo novo: só build de loja. Lógica JS: OTA (`runtimeVersion` = sdkVersion).
- A trava do OTA barra `expo-web-browser`/`react-native-webview`/`expo-location` importados no topo.

## Próximos passos
1. Acompanhar a aprovação da Apple da 4.34.6.
2. Na próxima publicação de loja, conferir no log a promoção automática do Android (primeira rodada real).
3. Texto do cadastro ainda diz "Nossa equipe libera o acesso" — trocar para o fluxo atual (pagou, entrou).
