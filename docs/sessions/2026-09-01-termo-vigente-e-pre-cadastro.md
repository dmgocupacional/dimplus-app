# Sessão 01/09/2026 — o que mudou no ERP e afeta este app

> ⚠️ **Nenhuma linha deste repo foi alterada nesta sessão.** Mas o comportamento do backend
> mudou e há **uma decisão de produto pendente que é deste app**. Trabalho no
> `dmgocupacional/erp-dimplus`, handoff em
> `docs/sessions/2026-09-01-pre-cadastro-autocadastro-e-termo-vigente.md` de lá.
>
> ERP em **v0.287.1** (`41c1e8d`).

---

## 1. 🔴 O termo voltou a existir — e este app estava cadastrando SEM aceite

`GET /api/public/app-termo-cadastro` estava devolvendo `{"disponivel":false}` **em produção
desde 28/08**, por um bug no ERP (a rota resolvia a versão vigente por `publicado_em` em vez
de `substituido_em`; publicar o Termo PF v2 criou a segunda linha publicada e o `maybeSingle()`
passou a dar erro não conferido). Corrigido em v0.287.1 e verificado ao vivo.

**O que isso significou aqui.** `src/app/(auth)/cadastro.tsx` trata `disponivel:false` assim:

```ts
// Sem termo publicado (ou sem rede para buscá-lo) envia direto e cai na fila.
// Travar aqui deixaria a pessoa sem caminho por uma falha que não é dela.
if (termo?.disponivel && termo.termo) setPasso(3);
else void onEnviar();
```

Ou seja: **o app pula o passo do aceite e envia o cadastro sem `termo_versao_id` nem
`aceite`.** O ERP tem fail-closed; este app tem fail-**open**. A decisão foi deliberada e o
motivo escrito é bom (não travar a pessoa por falha que não é dela) — mas ela pressupunha que
`disponivel:false` significa "ainda não publicamos os textos", e por 4 dias ele significou
"a consulta quebrou".

✅ **Ninguém passou sem aceite.** Conferido no banco: **zero** linhas em
`app_acesso_solicitacoes` criadas entre 28/08 e 01/09.

🔴 **Mas o risco cresceu.** Com o lote 1 do ERP (abaixo), CPF desconhecido não cai mais numa
fila — ele vira cliente, com contrato e cobrança no Asaas. Um `disponivel:false` agora produz
**contrato sem aceite registrado e pessoa cobrada**, não uma linha parada numa fila que um
humano revisa.

**Decisão pendente, deste repo:** manter o fail-open, ou travar quando o termo não vier?
Sugestão para levar ao Henrique: distinguir os dois casos que hoje colapsam num só —
*sem rede* (pode seguir, cai na fila como antes) × *servidor respondeu `disponivel:false`*
(não seguir, porque agora isso gera cobrança sem aceite).

---

## 2. Auto-cadastro: CPF desconhecido virou pré-cadastro, não fila

`POST /api/public/app-cadastro` passou a separar dois caminhos que antes iam para a mesma fila:

- **CPF já na base** → continua indo para a fila, para vinculação com prova de identidade.
- **CPF desconhecido** → vira **pré-cadastro**: linha em `clientes` com
  `status='aguardando_pagamento'`, `app_acesso='bloqueado'`, contrato e cobrança no Asaas.
  Sem fila.

**A conta de acesso só passa a enxergar alguma coisa depois do pagamento confirmado** (o
webhook do Asaas promove para `ativo` + `liberado`). Decisão do Henrique: acesso só depois do
pagamento.

### O que NÃO muda neste app

**A resposta HTTP continua a mesma `NEUTRA` de sempre**, para todos os casos. Isso é
deliberado e não deve ser "melhorado": resposta diferente para CPF novo × CPF conhecido é o
oráculo que revela quem está na base de clientes. O `invoiceUrl` da cobrança **existe** no
servidor e **não** é devolvido de propósito.

⚠️ **Consequência para a UX, e isto é dívida aberta:** o texto que a pessoa vê hoje diz
*"assim que ela for aprovada pela nossa equipe, você já pode entrar"*. Para quem acabou de
virar pré-cadastro isso está **errado** — não há aprovação de equipe; há um boleto/PIX a
pagar, que o próprio Asaas envia por WhatsApp/e-mail.

**Combinado com o Henrique (01/09):** a tela deve mostrar que a cobrança foi gerada e enviada,
com o **número mascarado que a própria pessoa acabou de digitar** ("enviamos para o número
terminado em ••••-45"). Isso não revela nada que ela não tenha escrito, e ela percebe na hora
se errou o telefone. **Não implementado.**

### Novo filtro no cadastro

O ERP passou a validar **dígito verificador** de CPF na rota pública (antes só contava 11
dígitos). CPF mal formado agora volta `400` com "CPF ou telefone em formato inválido" — vale
conferir se a tela trata esse 400 de forma legível.

---

## 3. Termo empresarial não existe — quem vem de empresa parceira aceita o termo errado

`/api/public/app-termo-cadastro` entrega **só** a natureza `consumidor` (o auto-cadastro é
sempre DIM+ Básico Plus). Mas o vínculo com empresa parceira é descoberto **depois**, dentro
do `app-cadastro`: se o CPF está na lista de uma empresa ativa, o plano vira **DIM+
Empresarial**, de natureza `empresarial` — e **não existe termo dessa natureza publicado**.

Decisão de desenho pendente, que envolve este app: entregar o termo certo antes do cadastro
exigiria a rota pública saber o CPF, e aí ela vira o oráculo de quem é associado do sindicato.
A alternativa é mover o aceite para **depois** do login, em `/api/app/contrato/pendente` (rota
que já existe e já sabe o plano real) — mas isso contraria a decisão de 26/08, de coletar o
aceite antes de enviar a solicitação. **Pergunta aberta para o Henrique.**

---

## 4. Pendências deste repo que continuam abertas

- **Testar a tela de aceite com o Termo PF v2.** Pendente desde 28/08 e até agora
  *impossível*, porque a rota devolvia `disponivel:false`. Agora dá. As **2 contas com aceite
  limpo** em 28/08 são o teste.
- **Texto pós-cadastro** para o caminho de pré-cadastro (item 2).
- **Decisão do fail-open** quando o termo não vem (item 1).
- Continua valendo: não existe "esqueci minha senha" (dívida datada de 28/08 — identidade é
  e-mail sintético e o phone provider do Supabase está desligado).
