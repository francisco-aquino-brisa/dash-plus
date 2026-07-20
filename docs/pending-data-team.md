# Pendências para o time de dados — indicadores ainda bloqueados

_Atualizado em 2026-07-19. Tudo abaixo foi verificado contra o warehouse
(`gdb_brisanet_comunidade_dev`) via os scripts read-only._

Com a liberação dos schemas `inteligencia_comercial_e_mercado`,
`inteligencia_comercial_e_mercado_indicadores` e `looker_playground`, a tela
**Cidades** teve 8 indicadores desbloqueados (ticket/faturamento BL e 5G, churn
safra c/ bloqueio, ativação avulsa, e VE04 oficial) — já em produção e validados.

Restam 4 pendências que dependem de ação de vocês. Em ordem de impacto:

---

## 1. Portabilidade 5G (VE32, VE33, VE34, VE35) — falta acesso ao catálogo

**Onde aparece:** Cidades (bloco 5G) e telas de Vendas/Vendedor.

O catálogo `indicadores_servicos` define a fonte oficial destes indicadores como:

```
gdb_brisanet_gd.inteligencia_comercial_e_mercado.portabilidade_5g
```

O app (service principal do Databricks App) **não tem `USE CATALOG` em
`gdb_brisanet_gd`**:

```
[INSUFFICIENT_PERMISSIONS] User does not have USE CATALOG on Catalog 'gdb_brisanet_gd'
```

**Pedido:** conceder `USE CATALOG` em `gdb_brisanet_gd` + `SELECT` em
`gdb_brisanet_gd.inteligencia_comercial_e_mercado.portabilidade_5g` ao service
principal do app **ou** publicar essa view/tabela dentro de
`gdb_brisanet_comunidade_dev` (onde o app já tem acesso).

> Obs.: existem `portabilidade`, `portabilidade_solicitado` e
> `portabilidade_portado` em `inteligencia_comercial_e_mercado` (acessíveis), mas
> a estrutura é diferente (orientada a venda/consultor, colunas `Portabilidade?`,
> `STATUS`, `JANELA`), enquanto a fórmula do catálogo usa `CategoriaServico`,
> `StatusConector`, `CI_CONTRACT_ID` da `portabilidade_5g`. Se quiserem que a
> gente use as tabelas acessíveis como substituto, precisamos da confirmação de
> **qual coluna = "Portabilidade concluída/pendente/solicitada"**.

---

## 2. Dimensões incompatíveis entre `desempenho_hc` e as fontes novas — bloqueia Vendas/Produtividade/Vendedor

**Onde aparece:** Vendas · Canais, Produtividade, Vendedor.

Nessas telas os KPIs são **filtráveis** por Gerente, Canal, Nicho, UF, Cidade e
Tipo. Hoje leem de `desempenho_hc`. Os indicadores a desbloquear (Ticket,
Faturamento, Churn 5G) vivem nas fontes novas, que têm **as mesmas dimensões com
valores diferentes** — então um filtro casaria em `desempenho_hc` e falharia na
fonte nova, gerando número errado silenciosamente.

Exemplos verificados:

- **Gerente (acento):**
  `desempenho_hc.GERENTE_CANAL = "FLAVIO  (GEST`**`Ã`**`O PAP)"`
  vs `waves.GERENTE_CANAIS = "FLAVIO  (GEST`**`A`**`O PAP)"`.
- **Canal (taxonomia):** `desempenho_hc.canal_waves` tem `AGENTE AUTORIZADO`,
  `B2B`, `BKO`…; `waves.CANAL_GERAL` tem esses **+ `AGILITY`, `B2G`,
  `AGILITY - AGENTE`** (conjuntos diferentes).

**Pedido (qualquer uma resolve):**

1. **Padronizar os valores** de `GERENTE_CANAL`/`GERENTE_CANAIS`,
   `canal_waves`/`CANAL_GERAL` (e nicho/UF/cidade/tipo) entre `desempenho_hc` e
   `waves_consolidado_orcamento` / `consolidado_5g_pedido` / `churn_vendedor_5g`
   (mesma grafia, mesmos acentos, mesma taxonomia); **ou**
2. **Fornecer uma tabela de/para** oficial por dimensão (existe
   `inteligencia_comercial_e_mercado.dicionario_canais_vendas` — se for essa,
   confirmar as colunas de origem→destino); **ou**
3. **Consolidar as colunas** de ticket/faturamento/churn já dentro de
   `desempenho_hc` (mesma grão vendedor/dia), o que elimina o cruzamento entre
   schemas de vez.

Enquanto isso, esses cards seguem como "Sem acesso aos dados" nessas 3 telas.

---

## 3. Catálogo `indicadores_servicos` — 2 correções de metadado

`inteligencia_comercial_e_mercado_indicadores.indicadores_servicos` é ótimo e
virou nossa fonte de verdade. Dois campos `tabela` estão apontando para o lugar
errado (verificado por inspeção de colunas):

- **Ticket/Faturamento 5G (RE01/RE02/RE04/RE05, servico 5G):** `tabela` diz
  `waves_consolidado_orcamento`, mas as colunas citadas (`preco_promocional`,
  `preco_oferta`, `n_do_pedido`) **não existem** nessa tabela — existem em
  `consolidado_5g_pedido`. Usamos `consolidado_5g_pedido` (validado). Sugerimos
  corrigir o `tabela` no catálogo.
- **Portabilidade 5G (VE32–VE35):** `tabela` aponta para o catálogo
  `gdb_brisanet_gd`, que o app não acessa (ver item 1).

---

## 4. PDU — fonte ainda inexistente (pendência antiga)

**Onde aparece:** Vendas, Produtividade, Vendedor (indicador PDU).

`vw_hc_zerado_vendedor` **não existe em nenhum catálogo acessível**, e a coluna
`total_realizado` **não existe em lugar nenhum**. Não há substituto drop-in
(`dias_uteis_acumulado` sobrevive em `dias_acum_uteis_vw` e
`vw_producao_hc_zero_venda`, mas nenhuma carrega `total_realizado`).

**Pedido:** publicar a view do PDU (ou confirmar a fonte/coluna oficial de
`total_realizado` por matrícula/dia/serviço) em `gdb_brisanet_comunidade_dev`.

---

### Resumo do que destrava o quê

| Pendência           | Ação do time de dados                                        | Destrava                                                        |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| 1. Portabilidade 5G | GRANT em `gdb_brisanet_gd` (ou republicar em comunidade_dev) | VE32–VE35                                                       |
| 2. Dimensões        | Padronizar valores / de-para / consolidar em `desempenho_hc` | Ticket, Faturamento e Churn 5G em Vendas/Produtividade/Vendedor |
| 3. Catálogo         | Corrigir `tabela` de RE0x-5G e VE3x                          | (metadado — melhora a manutenção)                               |
| 4. PDU              | Publicar fonte com `total_realizado`                         | PDU em Vendas/Produtividade/Vendedor                            |
