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
