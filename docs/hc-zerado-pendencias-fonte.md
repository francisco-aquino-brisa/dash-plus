# HC Zerado — pontos para o time de dados

Levantado durante a migração do Brisa Radar (`dashboard_zero_venda`) para o Brisa
Dash, em setembro de 2026. Tudo abaixo foi **medido no warehouse**, não inferido
do código.

As telas novas **replicam o comportamento atual**, inclusive onde ele parece
errado — o objetivo da migração é que os números batam com a tela que as pessoas
já usam. Os itens 1 e 2 mudam número em tela e por isso precisam de uma decisão
de quem é dono do indicador antes de qualquer correção.

---

## 1. A produção e o HC vêm de duas populações diferentes (afeta a PDU)

A tabela carrega dois grupos de gente que não se sobrepõem:

| Grupo                        | Pessoas | Vendas no mês     | Canais                                                                                              |
| ---------------------------- | ------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `situacao = 'ATIVO'` (folha) | 1.025   | 77.066 (30%)      | 1.020 deles em PAP                                                                                  |
| `situacao` vazia             | 3.452   | **182.878 (70%)** | ONLINE, AGENTE PARCEIROS, DONO CIDADE, LOJA, EMBAIXADORES, VAREJO REDES, INDICA BRISA, B2B, AGILITY |

Só 94 dos 3.452 documentos do segundo grupo aparecem também como ATIVO. O segundo
grupo não tem situação porque não é folha de pagamento — são canais indiretos.

**O efeito:** o card "Totalizadores de Produção" soma a venda dos dois grupos,
enquanto "Total HC Ativo" conta só a folha. A PDU divide um pelo outro, então ela
sai **cerca de 3,4× maior** do que seria a produção da folha dividida pela folha.

**A pergunta:** a PDU deve medir só a folha (numerador e denominador na mesma
população), ou os totalizadores são de propósito a visão da empresa inteira?

## 2. O serviço RENOVAÇÃO não existe na fonte

A coluna `servico` só tem `INTERNET`, `5G` e `FWA`. O card "Renovações" e a linha
`RENOVAÇÃO` das matrizes são estruturalmente vazios — não é filtro mal aplicado.

Na tela nova isso aparece como **"sem dado na fonte"**, nunca como zero, porque um
zero mudo é lido como "ninguém renovou".

A definição da view tem um trecho que lê `adm_comercial_view.vw_renovacao`, mas
nenhuma linha dele chega com `servico = 'RENOVAÇÃO'`. Além disso, a tabela de
regras (`regras_justificativa_hc.servicos_obrigatorios`) ainda lista `RENOVACAO`
como serviço cobrado.

**A pergunta:** renovação deveria estar chegando? Se não, tiramos da regra também.

## 3. `situacao` grava o mesmo estado de duas formas

`FERIAS` e `FÉRIAS`, `AF.PREVIDENCIA` e `AF.PREVIDÊNCIA`, `LICENCA MATER.` e
`LICENÇA MATER.` convivem na mesma coluna. Como o bloco "Total Quadro de HC" cria
um tile por valor distinto, a tela antiga mostra **"Férias" duas vezes, cada uma
com metade da contagem**.

A tela nova soma as duas grafias. De agosto/2026 em diante a fonte só grava as
acentuadas, então o problema é de período histórico — mas seria bom normalizar na
origem.

## 4. `matricula` vem nula em cerca de 35% das linhas

Em **janeiro e fevereiro de 2026 ela é nula em 100% das linhas**. Consequência
direta: a PDU mensal desses dois meses aparece como zero, porque não há HC ativo
identificável.

Onde importa a coluna está sã: entre as linhas `ATIVO`, `matricula` nunca é nula e
`COUNT(DISTINCT documento_hc)` = `COUNT(DISTINCT matricula)` = 1.051, um para um.

## 5. Trilha de autoria das justificativas

`justificativas_hc_zerado` registra a matrícula de quem zerou, o status e o
parecer do líder — mas **não registra quem escreveu a justificativa nem quem a
aprovou ou rejeitou**. No app antigo isso não pesava, porque o usuário era fixo no
código; no Brisa Dash existe identidade real.

Já está acordado adicionar `autor_id`, `avaliador_id` (apontando para
`tb_usuarios.id`) e `avaliado_em`. As 9 linhas existentes ficam com nulo, e a tela
mostra "autoria não registrada" nelas.

## 6. A tabela atrasa um ciclo em relação à view

O módulo lê `tb_producao_hc_zero_venda` porque a view de mesmo nome recalcula uma
cadeia longa de CTEs a cada consulta — 8s contra praticamente zero, o que levava a
tela inteira de 45s para 6s. Os números são os mesmos; a tabela só chega mais
tarde (2026-09-03 contra 2026-09-05 no dia da medição).

**A pergunta:** qual é a cadência de carga da tabela? Se ela puder acompanhar o
dia corrente, a tela passa a mostrar o dia de hoje sem custo nenhum.
