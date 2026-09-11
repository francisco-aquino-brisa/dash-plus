# HC Zerado — a origem mudou (`dashboard_zero_venda` → `projeto_zero_venda`)

A Tela 1 (Desempenho) foi portada a partir de `~/Documents/dev/brisa/dashboard_zero_venda`.
Em 2026-09-09 o time passou uma versão mais nova, `~/Documents/dev/brisa/projeto_zero_venda`.
Este documento registra o que difere entre as duas e o que isso implica para o
módulo já portado e para as telas 2–5, que ainda não existem aqui.

**A partir de agora a referência do port é `projeto_zero_venda`.** A fonte de
dados não mudou: as duas versões leem
`gdb_brisanet_comunidade_dev.projeto_brisa_performance.tb_producao_hc_zero_venda`,
que é a mesma que este módulo já usa.

## O que mudou por arquivo

Comparação feita com `diff -r` entre as duas árvores (ignorando `node_modules`,
`dist` e `.git`). `TelaMatrizGerencial.tsx`, `SidebarNavigation.tsx`,
`src/utils/coreLogic.ts`, `src/utils/filterEngine.ts` e toda a camada
`server/{services,controllers,routes}` estão **idênticos**.

| Arquivo                                        | Tamanho da mudança | Natureza                                          |
| ---------------------------------------------- | ------------------ | ------------------------------------------------- |
| `server.ts`                                    | +399 linhas        | Passou a ser o servidor real (ver abaixo)         |
| `src/App.tsx`                                  | ~224 linhas        | Busca por período + 3 chamadas novas de histórico |
| `src/components/TelaAnalise.tsx`               | ~501 linhas        | Nova sub-aba "Média de Zerados"                   |
| `src/components/FilterPanel.tsx`               | ~131 linhas        | Período com botão "buscar" e trava de 31 dias     |
| `src/components/TelaDesempenho.tsx`            | ~136 linhas        | PDU mensal veio do backend; alturas de gráfico    |
| `src/components/TelaJustificativaHC.tsx`       | ~60 linhas         | Estado "salvando" nos modais                      |
| `src/components/TelaLeituraJustificativas.tsx` | ~41 linhas reais   | Busca por `?from=`; resto é churn de CRLF         |
| `src/components/ActiveFiltersDisplay.tsx`      | ~19 linhas         | Texto das Regras Globais                          |

## Mudança estrutural: qual servidor roda

Este é o ponto que mais afeta a leitura do código antigo.

- **Antes** o `dev:server` apontava para `server/index.ts` — a camada organizada
  em `routes/controllers/services/actions`. E o `dados.actions.ts` dela fazia
  `SELECT * FROM tb LIMIT 100`. Ou seja: a versão em que me baseei servia **100
  linhas** ao front. A lógica de cálculo estava correta e foi ela que portei,
  mas os números daquela instância não eram os de produção.
- **Agora** o `dev:server` aponta para o `server.ts` da raiz, um servidor único
  que filtra por data no SQL, tem cache em memória e usa `compression()`. A
  camada `server/` continua no repositório, mas é código morto.

Consequência para nós: nenhum número do port precisa ser revisto por causa
disso — a validação numérica da Tela 1 foi feita contra SQL direto no
Databricks, não contra o app antigo.

## Diferenças que afetam a Tela 1 (já portada)

1. **PDU Mensal mudou de fórmula.** A versão antiga calculava no navegador:
   `(volume / hc_do_último_dia_do_mês) / dias_úteis`, contando a pessoa por
   `documento_hc`. A nova calcula no SQL como
   `volume_total / dias_trabalhados_totais`, onde `dias_trabalhados_totais` é a
   soma da coluna `dias_trabalhado` por pessoa/dia, e a pessoa é identificada por
   `hash_user`. Também passou a filtrar `flag_feriado = 'NAO'` na base.
   **Nosso port segue a fórmula antiga.** As colunas `hash_user` e
   `dias_trabalhado` existem na tabela e não são usadas por nós.
2. **Métrica nova: `media_hc_zerado_dia`** (`ocorrências_zeradas / dias_úteis`),
   devolvida junto com o histórico de 12 meses. Não existe no nosso port.
3. **Regras Globais no texto do contexto**: `FTTH + FWA + RENOVAÇÃO` virou
   `FTTH + FWA + 5G + RENOVAÇÃO`, e "Agilidade" passou a poder exibir `Todos`
   em vez de sempre cair em "Instalado m. dia".
4. **Período**: a nova UI cobra "Máx. 31 dias" no rótulo, aplica só ao clicar
   numa lupa (não a cada tecla) e arrasta a outra ponta quando a janela passa de
   31 dias. O backend recusa acima de 60 dias. Nosso `clampRange` já limita a
   31; a diferença é de interação, não de regra.
5. **Cascata dos filtros**: já existia na versão antiga e eu não a havia
   portado. Corrigido — ver a seção seguinte.

## Diferenças que afetam as telas 2–5 (a construir)

- **Tela 2 (Análise)** ganhou uma segunda aba, "Média de Zerados", com matriz
  mês a mês e **calendário de dias úteis por UF** — o vendedor usa o calendário
  do estado dele, coordenação/gerência usam o global. Também trata "grupo não
  existia no mês" como 0 dias em vez de 22, e divide a média só pelos meses em
  que a pessoa realmente esteve na empresa. Alimentada por
  `/api/dados-historico?matriz_zerados=true`.
- **Tela 2** passou a ler 12 meses agregados no SQL (`?detalhado=true`) em vez
  de recalcular do bruto no navegador.
- **Telas 4 e 5** passaram a buscar justificativas por período (`?from=`) em vez
  de trazer tudo, e ganharam estado "Salvando..." com botões desabilitados.
- **Tela 5** passou a comparar matrícula como número e a não descartar uma
  justificativa cujo dono não está na base do período (`hasMeta`).

## Correções aplicadas nesta rodada

Vindas da avaliação dos usuários:

1. **Filtros em cascata.** `getHcFilterOptions` passou a receber os filtros e a
   montar cada lista a partir das linhas que sobrevivem a todos os _outros_
   filtros — igual ao `getOptions()` da origem. Só os filtros que **derrubam**
   linha cascateiam; serviço, indicador, status da venda e agilidade zeram a
   venda sem tirar a pessoa, então não estreitam lista nenhuma (nem a própria).
   A cascata roda no Node sobre as tuplas distintas do período (~16 mil para um
   mês), cacheadas por período, então clicar num filtro não gera consulta nova.
   O dropdown **Consultor**, que existe na origem e faltava aqui, foi incluído.
2. **Scroll pulando para o topo** a cada clique de filtro: faltava
   `{ scroll: false }` nos cinco `router.push` do módulo. Todas as outras telas
   do repositório já passavam essa opção.
3. **Latência**: o watermark era consultado duas vezes por render, em série
   (uma pela view, outra pelos filtros); passou a ser memoizado por 60s. E
   `diasUteisDoMes` rodava depois do lote paralelo; entrou no lote.
4. **Clique nos cards de Totalizadores zerava os outros três.** Ver abaixo.

### O cross-filtro de serviço não filtra (comportamento da origem)

Clicar num card de "Totalizadores de Produção" **não** estreita a produção na
origem. Rastreando `crossFilters.servico` no código dela, ele aparece em três
lugares e só: destacar o card clicado, montar o chip de contexto ativo, e
compor `activeServices` — que alimenta **apenas** `isStatusLockIgnored`. A
seção de filtros de venda do `getFilteredData` zera contra `filters.servico`,
nunca contra `activeServices`. Nenhuma linha é derrubada, nenhuma venda é
zerada.

Nosso `vendasExpr` lia o cross-filtro na lista de serviços, então clicar em
FTTH zerava FWA, 5G e Renovação. Corrigido para ler `f.servico` e deixar o
cross apenas na decisão da trava de status, como a origem.

Efeito verificado em SQL para julho/2026, sem outros filtros (status padrão
`CRIADO`):

| Cenário                             | FTTH    | FWA    | 5G     | Renovação |
| ----------------------------------- | ------- | ------ | ------ | --------- |
| Sem clique, ou clique em FTTH / FWA | 55.230  | 4.596  | 87.480 | 0         |
| Clique em 5G ou Renovação           | 139.695 | 10.665 | 87.480 | 0         |

A primeira linha confere com os totalizadores já validados. A segunda merece
atenção: clicar no card de 5G faz `isStatusLockIgnored` virar verdadeiro,
a trava de status da venda deixa de valer e o card de **FTTH sobe 2,5×** — de
55.230 para 139.695, porque passa a contar orçamentos em qualquer status. É o
que a origem faz hoje; parece efeito colateral não intencional, mas replicamos
por ser um port. Vale confirmar com o time se é o desejado.

## Por que a nossa versão parecia pior — medido

Duas causas independentes. A primeira era um defeito nosso; a segunda é
arquitetura.

### 1. Uma conexão nova ao Databricks por query (corrigido)

`DatabricksDataClient.query()` abria um `DBSQLClient`, conectava, abria sessão,
rodava a query e derrubava tudo — a cada statement. Medido contra o warehouse,
com a tela filtrada por um gerente:

| Query        | connect | openSession | execute | linhas |
| ------------ | ------- | ----------- | ------- | ------ |
| watermark    | 549ms   | 190ms       | 379ms   | 1      |
| pessoaDia    | 548ms   | 527ms       | 1024ms  | 6.560  |
| servicoDia   | 548ms   | 489ms       | 777ms   | 3.983  |
| pduMes       | 548ms   | 541ms       | 1675ms  | 7      |
| diasUteisMes | 548ms   | 494ms       | 620ms   | 1      |
| tuplas       | 548ms   | 505ms       | 1111ms  | 16.386 |

**~1,05s de handshake puro por query.** As seis em paralelo: **3.119ms**.
As mesmas seis sobre uma conexão e uma sessão reutilizadas: **1.321ms** — e
individualmente bem mais rápidas (pessoaDia 745ms, pduMes 438ms), porque o
warehouse também aproveita o cache de resultado.

O cliente compartilhado passou a manter uma conexão e uma sessão por processo,
com descarte e uma nova tentativa quando a sessão morre. Vale para todas as
telas, não só HC Zerado.

Nota: `pduMes` custa 1,7s para devolver 7 linhas porque não tem limite inferior
de data (`WHERE data <= to`) — varre a história inteira. Restringir a 12 meses
não mudou o tempo, então a tabela hoje é pequena o suficiente; fica registrado
como algo a revisitar quando ela crescer.

### 2. Eles não filtram no servidor — nós sim

Esta é a resposta para "por que lá é instantâneo". A rota `/api/dados` deles,
para um mês:

|        |              |
| ------ | ------------ |
| Linhas | 355.857      |
| JSON   | 245,3 MB     |
| Tempo  | **11.209ms** |

Ou seja: a consulta **deles é ~8× mais lenta que a nossa**. A diferença é que
eles pagam isso **uma vez**, guardam 5 minutos em memória no Node, mandam tudo
comprimido para o navegador e daí em diante todo filtro é JavaScript puro sobre
um array — zero rede. Nós refazemos a agregação no Databricks a cada mudança de
filtro.

O primeiro carregamento deles é pior que o nosso. Do segundo clique em diante é
instantâneo, e é isso que o usuário está comparando.

## PDU Mês: fórmula trocada pela do app novo

A pergunta de antes ("replico a PDU nova ou mantenho?") foi respondida na
prática: os números não batiam. Trocado.

Era `(volume ÷ dias úteis) ÷ HC ativo no último dia do mês`, com a pessoa
identificada por `documento_hc`. Agora é o que `projeto_zero_venda` faz:

    pdu_mes = SUM(total_vendas) ÷ SUM(dias_trabalhado)

com a pessoa identificada por `hash_user` e a base restrita a
`flag_feriado = 'NAO'`. `dias_trabalhado` é um **peso por pessoa-dia** que a
fonte já traz: em agosto/2026 vale `1` em 283.040 linhas, `0.5` em 56.194 e `0`
em 46.216 — meio dia de sábado e ausências entram pelo peso. Então quem
trabalhou seis dias conta como seis, e não como um mês inteiro de headcount.

**Duas armadilhas** nesse backend que precisaram ser replicadas:

1. Ele aplica os filtros de venda como `AND coluna IN (...)`, ou seja
   **derrubando linha**, e não zerando a venda como o resto da tela faz. Isso
   vive em `vendasWhere`, usado só por `pduMes`, com o aviso no comentário.
2. O status da venda é aplicado **sem a fuga de 5G/Renovação**: um
   `status_venda IN ('CRIADO')` corta a venda de 5G junto, ainda que a coluna de
   status não descreva esse serviço. É por isso que a PDU Mês lê muito abaixo da
   PDU Dia.

Efeito medido (12 meses até 09/09/2026, sem filtros de hierarquia):

|                                      | jun/26 | jul/26 | ago/26 |
| ------------------------------------ | ------ | ------ | ------ |
| PDU sem o corte de status            | 3,51   | 4,64   | 4,73   |
| PDU com `status_venda IN ('CRIADO')` | 1,24   | 1,84   | 1,67   |

O segundo é o que o app novo mostra, e é o que passamos a mostrar. Mantivemos a
quebra por serviço (FTTH/FWA/5G/Renovação) no tooltip, que o app novo perdeu ao
mover o cálculo para o backend.

### Por que janeiro e fevereiro liam 0

A fórmula antiga dividia por `HC ativo`, e **a fonte só passou a preencher
`situacao` em março de 2026**: em janeiro e fevereiro a coluna é `NULL` para
todas as ~3 mil pessoas do mês. Com nenhuma linha lendo como ativa, o divisor
era zero, a guarda devolvia `0` e os dois primeiros pontos do gráfico ficavam no
chão.

A fórmula nova não depende de `situacao` — divide por `SUM(dias_trabalhado)` —
e devolve os valores certos:

|                                          | jan/26     | fev/26     |
| ---------------------------------------- | ---------- | ---------- |
| Fórmula antiga (`total ÷ dias ÷ HC`)     | 0 (HC = 0) | 0 (HC = 0) |
| Fórmula nova (`total ÷ dias_trabalhado`) | **3,51**   | **3,38**   |

Os dois valores da linha de baixo são exatamente os que o app novo mostra.

Resta que o tooltip desses meses não tem HC para exibir. Passou a mostrar `—` em
vez de `0`, porque a informação está ausente, não é zero.

## Bloco 5: ordenação e estado da pessoa

Dois desvios meus, os dois visíveis num período curto.

1. **Estado do último dia, não do primeiro.** Eu lia identidade e situação do
   dia mais recente da pessoa no período. A origem monta a lista percorrendo as
   linhas ordenadas por data e guardando **a primeira** que encontra de cada
   matrícula — então quem estava ativo no dia 1 e entrou de férias depois
   continua na lista. Lendo o último dia, essa pessoa sumia do bloco.
2. **Eu ordenava, a origem não.** Eu ordenava por dias sem venda, decrescente.
   Num filtro de 01 a 09/09 são 7 dias úteis, então todo mundo que não vendeu
   empata em "7 de 7" e ocupa a primeira página inteira — foi o que apareceu.
   A origem não ordena: lista na ordem em que a pessoa aparece nas linhas
   ordenadas por data.

Passamos a ordenar por **primeiro dia no período, depois matrícula**. É a regra
da origem tornada determinística: a ordem dela depende da ordem física de
varredura do warehouse, que não é reproduzível. A Matriz (Bloco 6) usa a mesma
chave, então os dois blocos listam as pessoas na mesma sequência — o que a
ordenação alfabética anterior quebrava.

Divergência de população que **não** mexemos: a Matriz da origem lista todo
mundo do headcount, inclusive quem não produziu nada (quatro linhas vazias). A
nossa lista só quem teve alguma produção no período. Juntar as duas exigiria
cruzar a matriz com o headcount e acrescentaria ~2 mil sujeitos totalmente
vazios à grade.

## Cache: lembrar de subir a versão

`MatrizRow.quebra`, `MatrizRow.totalSujeito` e `PduMes.renovacoes` foram
adicionados sem subir `HC_CACHE_VERSION`. O cache em memória sobrevive ao
hot-reload, então entradas antigas continuavam sendo servidas ao código novo:
a matriz quebrava com `Cannot read properties of undefined` e a Renovação da PDU
aparecia como `NaN`. Subido para `v2`. **Toda mudança na forma de um valor
cacheado precisa de um bump.**

## Bloco 6 e Bloco 7 — divergências corrigidas

### Matriz de Vendas: estrutura das colunas

A origem tem **três colunas congeladas** à esquerda — Consultor, Canal e Serviço
— e usa `rowSpan` para que Consultor e Canal ocupem as quatro linhas de serviço
do mesmo sujeito. Sob o nome ela imprime `Total período: N`, que é a produção do
sujeito somando **todos** os serviços, não a da linha.

Nosso port usava uma linha-cabeçalho de largura total (`colSpan`) com nome e
canal juntos, e só o Serviço como coluna congelada. Refeito para o formato da
origem, incluindo o `Total período` (`MatrizRow.totalSujeito`) e o Canal só na
visão por Consultor — nas visões agrupadas a origem esconde essa coluna.

As quatro linhas de serviço (FTTH, FWA, 5G, Renovação) agora aparecem sempre,
mesmo vazias, como na origem. Antes só apareciam os serviços com venda, o que
fazia a altura de cada bloco variar de pessoa para pessoa.

Nota de dados: a fonte grava o serviço como `RENOVACAO`, sem cedilha nem acento.

### Matriz de Vendas: quebra por indicador no hover

Faltava por completo. A origem, ao passar o mouse numa célula com valor, abre um
card com o dia, o serviço, a **quebra por indicador** e o total consolidado — é
como se descobre que os 5 chips do dia são `CHIP PAGO`, por exemplo.

Para isso `fetchServicoDia` passou a agrupar também por `indicador`, e cada
`MatrizRow` carrega `quebra`: um objeto esparso indexado pelo índice do dia, com
os indicadores daquele dia ordenados por volume. Só dias com produção entram,
que é a minoria das células numa grade de um mês.

Custo medido do grão extra em julho/2026: 151.701 → 163.258 combinações
distintas antes do corte de `v <> 0`, ou seja **+7,6%**. A fonte tem 6
indicadores no período.

O card é um só, posicionado por eventos de mouse, e não um tooltip do Radix por
célula: a grade tem ~15 mil células num mês cheio, e montar essa quantidade de
raízes de tooltip custa em todo render para algo que no máximo uma célula mostra
por vez.

### PDU (HC Ativo): tooltip do modo Mês

A origem lista o detalhamento por serviço — FTTH, FWA, 5G e **Renovação** —
escondendo as linhas dos serviços que o filtro tirou. O nosso mostrava FTTH, FWA
e 5G e nunca Renovação, porque `PduMes` não trazia esse campo. Adicionado no SQL
(`renov`) e no tipo, e o tooltip agora respeita `filters.servico`.

O tooltip do modo Dia já batia com a origem (PDU acumulada + produção do dia).

Ressalva sobre a origem nova: como o `pduMensalFechadoData` de
`projeto_zero_venda` passou a vir agregado do backend, ele **perdeu** os campos
`FTTH`/`FWA`/`5G`/`RENOVAÇÃO` que o tooltip dela ainda tenta ler — lá essas
linhas renderizam vazias hoje. Nós calculamos os quatro no SQL, então o nosso
mostra os valores.

## A hierarquia muda com o período — a fonte trocou a convenção de nome

Pedido: "mostrar os dados do filtro de acordo com a data selecionada". Investigando
por que a hierarquia muda, o motivo não é rotatividade — é uma mudança de
convenção na própria fonte.

Contando valores distintos por mês em `tb_producao_hc_zero_venda`:

| Mês     | Gerentes | Coordenações | Supervisões | Líderes | Pessoas |
| ------- | -------- | ------------ | ----------- | ------- | ------- |
| 2026-07 | 13       | 29           | 211         | 217     | 1.015   |
| 2026-08 | 13       | 34           | 227         | 249     | 1.158   |
| 2026-09 | 12       | 27           | 184         | 217     | 981     |

Treze gerentes em julho, doze em setembro — mas **27 nomes** diferem entre os
dois meses. Comparando as listas:

| Julho (e antes)    | Agosto em diante                   |
| ------------------ | ---------------------------------- |
| `ANDRE JEFTE`      | `ANDRE JEFTE BEZERRA RODRIGUES`    |
| `ALAN D.`          | `ALAN DELANO DE ALBUQUERQUE GOMES` |
| `F. HAYSLAN`       | `FRANCISCO HAYSLAN DA COSTA`       |
| `ROMULO FERRALME`  | `ROMULO FERREIRA DE ALMEIDA`       |
| `TIAGO BRASILEIRO` | `TIAGO HENRIQUE SOUZA BRASILEIRO`  |

São as mesmas pessoas. Julho usava apelido; a partir de agosto passou a usar o
nome completo. O corte é limpo: os nomes curtos terminam em **31/07/2026** e os
completos começam em **01/08/2026**. Julho também tem entradas que não são
pessoas (`EXECUTIVA`, `GENECI`, `AIRTON SILVA`) e linhas com `gerente` nulo.

Consequências:

1. **A lista de filtros precisa ser do período** — uma lista global mistura as
   duas grafias e oferece nomes que não existem na data escolhida. Já corrigido:
   as opções vêm de `WHERE data BETWEEN from AND to` (antes eram os últimos dois
   meses corridos, independentemente do filtro).
2. **Um intervalo que cruza 31/07→01/08 mostra a mesma pessoa duas vezes**, e
   cada grafia cobre só metade do período. Não há como resolver isso na
   aplicação; é a fonte que precisa de um identificador estável (matrícula ou
   `documento_hc`) em vez do nome. A origem tem exatamente o mesmo problema.
3. **Uma seleção feita num período e mantida ao trocar de período não casa com
   nada** — o chip continua marcado e a tela esvazia sem explicar. A origem tem
   o mesmo comportamento (ela persiste os filtros em `localStorage`). Não
   mexemos; se quisermos, o caminho é descartar da URL os valores que não
   existem nas opções do novo período.

## Trava de 31 dias visível no calendário

A regra já era a mesma da origem — `MAX_RANGE_DAYS = 31`, contando os dois
extremos, que equivale ao `dataInicial + 30 dias` da trava dela. O que faltava
era **mostrar** isso: antes o usuário escolhia livremente e o `clampRange`
puxava a data depois, sem aviso.

Agora o `DateFilter` aceita `maxRangeDays` e `maxDate` (ambos opcionais, só o HC
Zerado usa). Escolhido o primeiro dia do intervalo, tudo fora da janela fica
apagado nos dois sentidos; dias e meses futuros ficam apagados sempre; e a dica
do rodapé passa a dizer o limite. O `clampRange` continua no servidor como
defesa para URLs montadas à mão.

## Pendência conhecida de performance

Continua valendo a diferença de arquitetura descrita na ADR 0006. A origem
busca as linhas cruas do período uma vez (355.857 linhas em julho/2026),
guarda 5 minutos em memória no Node e recalcula tudo no navegador — então
qualquer clique depois do primeiro é instantâneo. Aqui cada combinação de
filtros é uma agregação nova no Databricks (~1,5s de consulta mais latência),
cacheada por combinação, então um clique inédito sempre paga a ida.

Medições (julho/2026, um mês):

|                                |         |
| ------------------------------ | ------- |
| Linhas cruas no período        | 355.857 |
| Grão pessoa × dia × hierarquia | 59.995  |
| Grão com as dimensões de venda | 299.929 |
| Tuplas distintas p/ os filtros | 16.386  |
| Consulta do scan pessoa×dia    | ~1,5s   |

Com a conexão reutilizada, um clique inédito passou de ~3,1s para ~1,3s de
camada de dados. Para chegar ao "instantâneo" da origem falta parar de ir ao
Databricks a cada clique.

O caminho, sem repetir os 245 MB deles: buscar o período **sem filtro de
hierarquia**, cachear por (período × filtros de venda) e aplicar hierarquia,
cidade, canal, nicho e os cross-filtros em Node. Medido sem filtro:

| Consulta              | Tempo   | Linhas | JSON    |
| --------------------- | ------- | ------ | ------- |
| pessoaDia sem filtro  | 1.649ms | 62.006 | 14,0 MB |
| servicoDia sem filtro | 742ms   | 57.253 | 5,2 MB  |

Ficariam ~19 MB por combinação de (período × filtros de venda) na memória do
processo, e clicar em gerência/coordenação/supervisão/líder/cidade/consultor/
canal/nicho ou numa linha de tabela custaria **zero consulta**. Só período e os
filtros de venda (serviço, indicador, status, agilidade) pagariam ida.

Dois cuidados antes de fazer: o cache do processo (`lib/data/cache.ts`) não tem
despejo, então várias combinações somariam; e boa parte dos 14 MB é string
repetida — separar uma dimensão de pessoas (~2,5 mil) da série pessoa×dia (62
mil) derrubaria isso bastante. Mexe na decisão registrada na ADR 0006, por isso
está aqui em vez de aplicado.

## Tela 2 — Análise de Produtividade (portada)

Duas abas sobre a **janela de 12 meses que termina no mês do `até` filtrado** —
o período do filtro só move o fim da janela, não recorta as colunas. A origem
baixava os 12 meses (`/api/dados-historico?detalhado=true` e `?matriz_zerados=true`)
e pivotava no browser; aqui cada aba é uma agregação em SQL, cacheada por
(filtros × hierarquia). Cada aba tem sua própria hierarquia na URL (`ap` e `az`),
então trocar a de uma não recalcula a outra.

### Divergência deliberada: os filtros de venda zeram, não descartam

O backend da origem aplica serviço/indicador/status/agilidade como
`AND col IN (...)` nas duas abas. Como **5G só existe com `status_venda = '5G ATIVO'`
e Renovação só com `'RENOVACAO EFETIVADA'`**, e o status padrão da tela é
`CRIADO`, na origem:

- a matriz de Produtividade mostra **FTTH e FWA apenas** — as linhas de 5G e
  Renovação ficam permanentemente vazias, apesar de 5G ser o maior serviço da
  base (668.404 unidades em 12 meses);
- na Média de Zerados, quem vendeu **só 5G** no dia conta como **zerado**.

Aqui as duas abas usam a regra do módulo (`vendasExpr`: zera a venda, mantém a
linha, com o escape de 5G/Renovação já documentado na Tela 1). Consequência:
FTTH e FWA batem com a origem; 5G aparece; e um dia com venda de 5G não conta
como zerado — igual à Tela 1 desta aplicação. Consistência interna venceu
paridade com uma inconsistência da origem.

Conferido em 01–09/09/2026, com as três hierarquias somando o mesmo total:

| Serviço | Tela 2 (SET-2026) | Regra da Tela 1 | Origem (status CRIADO) |
| ------- | ----------------- | --------------- | ---------------------- |
| FTTH    | 14.836            | 14.836          | 14.836                 |
| FWA     | 1.354             | 1.354           | 1.354                  |
| 5G      | 24.288            | 24.288          | 0                      |

### Produção sem dono: são integrações, não pessoas

`documento_hc` e `matrícula` são ambos nulos em ~23% da produção FTTH. Essas
linhas **não são vendedores**: são canais de integração
(`INTEGRACAO - SITE -> NOVOREVAN`, `INTEGRACAO - MUNDIALE2 -> NOVOREVAN`), com
`situacao` nula. Chaveá-las só por `HC_KEY` faria a aba por vendedor somar
36.691 enquanto a por gerência somava 40.478 — 3.787 vendas somem sem aviso.

A chave da aba por vendedor é `COALESCE(HC_KEY, 'SEM-HC:' || consultor)`, então
a integração aparece como uma linha nomeada e os totais das quatro hierarquias
fecham. A aba Média de Zerados não as inclui: filtra `situacao = ATIVO`, e elas
não têm situação.

### Calendário de dias úteis por UF — e o defeito de `uf_cidade_vendedor`

Dia útil = todo dia presente na fonte com `flag_feriado = 'NAO'`. Isso **inclui
sábado** e exclui domingo (que vem marcado). Contado por UF e global, **antes**
dos filtros: filtrar por um gerente não pode encurtar o mês. Vendedor e cidade
leem o calendário do estado; gerência e coordenação, o global — eles atravessam
estados.

`uf_cidade_vendedor` é derivada dos **dois últimos caracteres de
`cidade_vendedor`**. Funciona quando a cidade vem como `FORTALEZA/CE`; quando
vem sem a UF, produz lixo: `GROSSOS → OS`, `MADALENA → NA`, `FORQUILHA → HA`.
São 46 "UFs" distintas em agosto/2026, mais 1.061 pessoas com UF vazia.

Impacto medido em agosto/2026: **28 de 4.324 pessoas** (0,6%) caem num
calendário curto (mínimo 2 dias) — os buckets de lixo juntam gente suficiente
para quase sempre render o mês inteiro. Portado como está, com uma proteção que
a origem não tem: sem linha de calendário para a UF, cai no calendário global
(a origem caía num `|| 22` fixo). **A correção pertence à fonte**, não a nós.

### `cidade_vendedor` sem o nome da cidade vira "Sem Cidade"

Além da UF derivada errada, parte das linhas perdeu a metade da cidade e guarda
só `/CE`, `//GO`, `/RN`, `/PI` ou `/`. Cada uma abria a própria linha na visão
por cidade. A normalização (`CIDADE`, em `source.ts`) trata como desconhecida
qualquer cidade em branco ou começada por barra, e **vale para as duas telas** —
a Tela 1 tinha o mesmo defeito. Na janela de 12 meses são 7 buckets a menos
(669 → 662 cidades) e menos de dez pessoas envolvidas; os totais não mudam.

### Janeiro e fevereiro vazios na Média de Zerados

A aba filtra `situacao = ATIVO` e `situacao` é nula para todo mundo até
março/2026 (mesmo achado que zerava a PDU Mês). As colunas OUT-2025 a FEV-2026
saem vazias para todos — na origem também.

### Colunas: o que a origem mostra em cada hierarquia

Canal e "Dias Restantes Exp." descrevem uma pessoa, então a origem só as mostra
na visão por vendedor — as visões por hierarquia têm apenas a coluna do grupo.
Portado assim. O tamanho da equipe, que a origem calcula e nunca chega a
renderizar, aparece aqui como subtítulo do nome do grupo: sem ele não dá para
ler o percentual, que é justamente HC ocioso ÷ tamanho da equipe.

`dias_restantes_experiencia` vale 0 para todo mundo já efetivo (e é nulo em
34.579 linhas), então a coluna só mostra o número de quem está `Em Exp.` — 403
pessoas na janela, de 1 a 180 dias. A origem imprimia um badge fixo de "45 dias"
quando o status era `EXPERIENCIA`, valor que não existe na fonte.

### Ordenação

A origem lista os vendedores na ordem em que aparecem no resultado ordenado por
`mes_referencia` — não reproduzível e sem significado. Aqui as quatro
hierarquias ordenam **alfabeticamente**, o que combina com a busca local.

### Código morto na origem

`hoveredVendedorId` / "Sinalizador de Férias" está declarado em
`TelaAnalise.tsx` e nunca é usado — não existe overlay de férias na tela. O
tooltip da matriz também está quebrado na visão por vendedor: filtra
`it.matricula === Number(vendedorId)` sendo que `vendedorId` é o `documento_hc`,
então nunca casa. Aqui a quebra por indicador funciona nas quatro hierarquias.

### Estado de tela na URL: `keepScreenParams`

Trocar a hierarquia jogava o usuário de volta na aba Produtividade. A aba era
`useState`, e um `router.push` remonta a rota sob o `loading.tsx`, levando o
estado junto. A aba passou a viajar na URL (`aba`), semeada no `useState`, então
a troca de aba continua instantânea e sobrevive à navegação.

Ao corrigir apareceu um irmão **que já existia na Tela 1**: todo `router.push`
do módulo remontava a query só com `hcFiltersToQuery(filters)`, que não conhece
os parâmetros da tela. Consequência: mexer em qualquer filtro, limpar filtros ou
clicar num card/linha devolvia a matriz da Tela 1 para `consultor` — e, na Tela
2, zerava as duas hierarquias e a aba.

`keepScreenParams(q, current)` (em `filters.ts`) recopia da URL atual tudo que
não está em `HC_FILTER_PARAMS`. Assim qualquer parâmetro de tela sobrevive sem
que cada chamada precise listá-lo. Aplicado nos seis pontos que remontam URL no
módulo.

### Custo medido

| Momento                              | Tempo   |
| ------------------------------------ | ------- |
| Carga fria (3 consultas em paralelo) | 3.213ms |
| Repetição (cache por watermark)      | 10ms    |
| Trocar a hierarquia de **uma** aba   | 373ms   |

Payload da visão por vendedor: **3,76 MB** (7.986 linhas na Produtividade,
2.018 na Média de Zerados). A quebra por indicador é ~1,4 MB disso — por isso
ela é `[nome, valor]` em vez de `{ indicador, value }`, e no máximo 3 por
célula. As visões por hierarquia ficam entre 0,01 e 0,37 MB.

## Tela 3 — Matriz Gerencial (portada)

Diferente das outras, esta tela responde sobre **um único dia**: o fim do
período filtrado. O período ainda importa — desenha a sparkline da visão Cidade
e decide quais linhas o scan lê —, mas HC ativo, quem vendeu e quem zerou são
todos de D0.

Três hierarquias no seletor (`mg` na URL):

- **Gerência** e **Coordenação** → um card por grupo, em trilho horizontal,
  ordenado do mais ocioso para o menos. Cada card traz o percentual gigante, HC
  ativo / venderam / zeraram, e a lista nominal de quem zerou com matrícula e
  coordenação (ou cidade, na visão por coordenação).
- **Cidade** → a tabela do Bloco 4. A origem diz isso com todas as letras:
  "Desempenho Regional por Cidade (Assim como Bloco 4)".

Só a tabela de Cidade é clicável, como na origem — os cards não cruzam filtro.

### Um grupo só existe se alguém estava ativo em D0

Os cards iteram apenas os registros de D0, então um grupo sem ninguém ativo
naquele dia não aparece. Por isso a visão Gerência mostra 13 cards enquanto o
Bloco 4 da Tela 1 lista 15 linhas para o mesmo período: o Bloco 4 agrupa o
período inteiro e mostra o grupo com zero. Comportamento da origem, mantido.

Conferido em 09/09/2026: Gerência e Coordenação somam o mesmo HC ativo (876) e
os mesmos 220 zerados, como têm de somar.

### D0 no meio da carga

A referência é literalmente o fim do período. Se o usuário deixa o período
terminando hoje e o warehouse ainda está carregando o dia, a ociosidade
aparece inflada — em 10/09/2026 às 1.033 pessoas contra 2.144 no dia anterior,
metade do quadro ainda não tinha chegado. Vale para o Bloco 4 da Tela 1, que
usa o mesmo D0, e para a origem. O card imprime o HC ativo justamente por isso:
um número muito abaixo do usual é o sinal de que o dia não fechou.

### Código morto na origem

O título diz "(D-3)" e os cards dizem "Ref: D-0", porque `diasZerado` é uma
constante `0`. Toda a maquinaria de sequência — `filteredDataForStreak`,
`salesMapForStreak`, `totalVendasPeriodo`, `checkDates` — é calculada e nunca
lida; `filteredSellers` e `dataMaximaFormatted` também não. Não portamos nada
disso: a tela é de um dia só.

### Reorganização que esta tela forçou

O grão pessoa × dia saiu de `databricks.ts` para **`person-day.ts`**
(`fetchPersonDay`, `applyGroupCross`, `countDay`, `zeradoByDay`, `regional`),
porque Telas 1 e 3 leem o mesmo scan para perguntas diferentes. E o Bloco 4
virou **`RegionalTable.tsx`**, que recebe linhas em vez de alcançar o
view-model de uma tela. Os números da Tela 1 foram conferidos antes e depois:
idênticos.
