# HC Zerado: aggregate in SQL, read the table, not the view

The HC Zerado module is a port of `dashboard_zero_venda` (Brisa Radar), an app
whose five screens all read one source and computed every block in the browser.
Two decisions were needed to bring it into Brisa Dash, and both are hard to undo
once the five screens depend on them.

## The source is `tb_producao_hc_zero_venda`, not the view of the same name

`projeto_brisa_performance` carries both `vw_producao_hc_zero_venda` (VIEW) and
`tb_producao_hc_zero_venda` (MANAGED). They expose **the same 44 columns** and
agree on the numbers — July/2026 returns 237.840 vendas and 3.949 documentos
through either one.

They do not cost the same. The view rebuilds a long CTE chain on every read:
`waves_consolidado_orcamento` + `consolidado_5g_pedido` +
`adm_comercial_view.vw_renovacao`, `FULL OUTER JOIN`ed against the payroll
snapshot `adm_comercial.hc_folha_dia` (filtered to `cargo = 'PROMOTOR DE VENDAS'`),
then joined to the city organograma and a holiday calendar. Measured on the same
one-month aggregate: **~8s through the view, ~0s through the table**. The whole
screen went from **45,3s to 5,9s** on the swap.

The cost of the table is staleness: it trails the view by a refresh cycle
(2026-09-03 against 2026-09-05 when this was written) and carries older
service×status combinations, so it holds more rows (3,19M against 2,96M) without
changing any sale total. For a screen read during the working day, one refresh
cycle behind is worth an order of magnitude in latency.

`DATABRICKS_HC_TABLE` overrides the object if this ever needs to point back.

## Aggregation runs in SQL, not in the browser

The original fetched the entire source into the browser (`SELECT *`, no date
filter) and derived all seven blocks in JS. That is ~1,1 GB of rows; the project's
own handoff notes record it OOM-ing in production.

Shipping a **pre-aggregated slice** to the client was measured first, because it
would have preserved the original JS block-for-block and kept the click-to-filter
interactions instant. At the grain that keeps every filter working, one month is
217.901 rows / 18,2 MB — until the management columns (gerente, coordenação,
supervisão, líder, cidade) are added, which every block groups by. With those the
same month becomes **277.683 rows / 69 MB**, because each row repeats the names.
That is not a payload.

So the module follows what the rest of the app already does (ADR 0002, "Large
fact tables"): the server filters and aggregates, and only the view-model crosses
the wire. Inside the adapter one scan returns the person × day grain (~27k rows
for a month) and every headcount block is derived from it in Node — the source is
large enough that concurrent scans of it contend with each other, and the blocks
all want the same scan.

**The cost we accepted:** a cross-filter click (a KPI card, a table row) is a
server round-trip instead of an instant client filter. It is cached by
`(filters, watermark)` like every other screen, so the second visit to a given
cut is free.

**The consequence for filters:** the range is capped at 31 days
(`MAX_RANGE_DAYS`). The original had no cap because it had already paid for all
the data; here each range is a query.

## What the port keeps from the original, deliberately

`getFilteredData` did two different things to a row, and the distinction is the
heart of the module: hierarchy filters **drop** the row, while sale filters
(serviço, indicador, status da venda, agilidade) **keep** the row and zero its
`total_vendas`. The headcount still counts; the person simply reads as having
sold nothing. In SQL that is a `WHERE` for the first kind and a `CASE` inside the
`SUM` for the second. Getting this backwards would silently shrink the
denominator of every ociosidade number on every screen.
