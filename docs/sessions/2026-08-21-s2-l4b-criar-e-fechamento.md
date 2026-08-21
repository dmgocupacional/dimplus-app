# Sessão 21/08/2026 — S2-L4b (criar agendamento) e fechamento do S2

App: **v0.8.0 → v0.13.3**. ERP na mesma sessão: **v0.257.0 → v0.261.0**.

> ⚠️ Esta sessão quebrou a regra "1 conversa = 1 repo" **a pedido do Henrique**, para
> não fatiar um trabalho que atravessa os dois lados. Deu certo: metade dos bugs só
> apareceu porque dava para corrigir erp e app na mesma linha de raciocínio.

## O que foi feito

Criar agendamento pelo app estava bloqueado desde 19/08. Foi desbloqueado e, na prática,
o S2 inteiro fechou.

- **Criar agendamento** — rota de catálogo de procedimentos no erp + `tabela_id` na
  criação. Validado no device contra a clínica real.
- **Menu de entrada** (`/agendar`) com Novo agendamento / Meus agendamentos / Histórico.
- **Calendário** substituindo a lista corrida de horários, nas DUAS telas (criar e
  remarcar). Escrito à mão, sem lib.
- **Histórico** como tela própria, somente leitura.
- **31 especialidades destravadas** (eram 6).
- Cancelar, remarcar, criar e listar: **todos testados de ponta a ponta no aparelho.**

## Estado atual

Tudo o que o S2 previa funciona. As pendências abertas estão em `docs/ROADMAP.md`,
seção "Próximas frentes" — a mais importante é **confirmar com a recepção se o caixa
cobra o preço DIM+**, que é a única coisa desta sessão que mexe em dinheiro e não foi
provada.

## Decisões tomadas (e por quê)

- **Calendário à mão, sem biblioteca.** O caso é uma grade 7×N; uma lib traria estilo
  próprio brigando com os tokens da marca e dependência nova para pouca coisa.
- **Datas comparadas como string ISO, nunca `new Date(string)`.** `new Date('2026-08-25')`
  é UTC e, em UTC-3, volta 24/08 às 21h. O único `Date` construído usa o construtor
  numérico, que é local.
- **Vínculo especialidade → procedimento numa tabela conferida à mão**, não heurística.
  Casar por pedaço de nome mandou Urologia para "Consulta Neurologista" (`urologia` casa
  dentro de `neurologia`). Erro desse tipo grava procedimento errado no prontuário.
- **Esconder especialidade não agendável** em vez de marcá-la (decisão do Henrique).
  Rodapé avisa que as demais são pela central, para a tela não sugerir que a clínica só
  atende as listadas.
- **Buscar a agenda POR PROFISSIONAL** ao escolher o médico, em vez de reaproveitar a
  lista da especialidade: mata a lista velha e é o que permite ao servidor podar os
  horários impossíveis.
- **Falhas degradam, não quebram.** Catálogo que não carrega → mostra todas as
  especialidades. Poda que falha → devolve sem podar. Nomes que faltam → lista aparece
  sem eles. Nunca tela vazia por causa de uma chamada secundária.

## Pegadinhas descobertas

**As doze da Feegow estão tabeladas em `docs/ROADMAP.md`** — não duplico aqui. Leia
aquela tabela antes de tocar em agendamento. As três que mais custaram:

1. **Data em d-m-Y.** Causou três sintomas que pareciam bugs diferentes: agendamento
   ativo sumindo, histórico vazio, data invertida. Uma causa só.
2. **Disponibilidade que não cruza tipo de procedimento.** A Feegow oferecia horário que
   ela mesma recusava na criação, com 409. Passamos horas achando que era corrida por
   slot.
3. **Checagem de posse fail-closed com janela errada.** O erro não aparecia como erro:
   virava "você não é dono deste agendamento" e bloqueava cancelar de cliente legítimo.

### Do lado do app, não da Feegow

- **`useFocusEffect`, não `useEffect`,** em tela que fica na pilha. Com `useEffect` a
  lista não recarregava ao voltar e o agendamento recém-criado não aparecia — parecia
  que nada tinha sido feito.
- **`router.replace` após criar**, não `push`: com `push` o "voltar" devolvia o cliente
  para a tela de escolher horário do agendamento que ele acabara de criar.
- **Bundle velho do Expo enganou duas vezes.** Correção subia, sintoma continuava.
  `npx expo start -c` e conferir a versão no Perfil ANTES de investigar.
- **Erro de escrita não pode limpar a lista.** Zerar os slots no caminho de falha fazia
  a tela dizer "nenhum horário disponível" quando o que falhou foi a criação.
- **Nunca exibir texto cru do servidor.** O JSON escapado da Feegow chegou à tela do
  cliente. Hoje só passa mensagem curta e sem chave/aspas.

## Método que funcionou

Quando o 409 se repetiu quatro vezes e a leitura de código não explicava, o que resolveu
foi **instrumentar a rota em produção** (log do payload + resposta crua), reproduzir uma
vez e ler o log. A causa apareceu na primeira tentativa. O log foi removido depois
(`c2b043f`).

Vale repetir: contra a Feegow, medir bate ler código.

## Ambiente de teste

Paciente de teste na Feegow: **`499191`** — CPF `55566677720`, "ZZ TESTE DESENVOLVIMENTO
APP DIM+ NAO COBRAR", nascimento 01/01/1990. Criado nesta sessão porque o CPF não tinha
cadastro na clínica, e o 404 disso **mascarava** os erros reais que vieram depois.
`clientes.feegow_paciente_id` e `data_nascimento` preenchidos no ERP.

Agendamentos de teste ficaram na agenda real — cancelar quando não precisar mais.
