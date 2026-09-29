# Robô do tutorial Vigent

Grava o **app real** (versão web, `dimplus-web.vercel.app`) logado na conta de demonstração da
Vigent e gera os vídeos (1080x1920, esperas da Feegow cortadas) e as fotos usados em
`bemvindo.vigent.dimeg.com.br` (`erp-dimplus/public/vigent/midia` e `/telas`).

Conta: "Colaborador Demonstração Vigent" (CPF de teste 138.868.289-30) + "Filha Demonstração
Vigent", na entidade `vigent`, com cobrança só a partir de 2099 (nunca entra em fatura).
Credenciais: segredos `DEMO_VIGENT_CPF` / `DEMO_VIGENT_SENHA`.

```
pip install playwright && python -m playwright install chromium
export DEMO_VIGENT_CPF=... DEMO_VIGENT_SENHA=... SAIDA=/tmp/tutorial
python cap_ativar.py            # ⚠️ só funciona uma vez: aceita o termo e gera o cartão
python cap_agendar.py           # vai até o horário; NÃO confirma (não cria consulta)
python cap_farmacia.py
python cap_cartoes_unidades.py cartoes   |  unidades
python cap_familia_ajuda.py familia | ajuda | clube
```
Regravar o "ativar": zerar `aceite_em` e `consentimento_saude_em` do contrato da conta demo.
Na web não há alerta nativo ("Confirmar agendamento?") nem GPS: o tutorial explica esses passos.
