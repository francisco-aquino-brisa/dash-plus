"use client";

import { Building2, CheckCircle2, Rocket, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { statusColor } from "@/lib/ui/status";
import { formatNumber, formatPct } from "@/lib/format";
import type { KpiValue } from "@/lib/data/cities/compute";

/**
 * Screen-specific blocks kept from the legacy Cities dashboard that the new_ui
 * prototype doesn't surface, restyled with the `--s-*` tokens: the sales funnel
 * (Bloco 7), the churn pair (Bloco 5) and the coverage panel. Data comes from
 * the same server view-model.
 */
const panelStyle: React.CSSProperties = {
  border: "1px solid var(--s-border)",
  borderRadius: "var(--r-panel)",
  background: "var(--s-card)",
  padding: 15,
  boxShadow: "var(--s-sh)",
  display: "flex",
  flexDirection: "column",
  gap: 13,
};

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "-.02em",
          }}
        >
          {title}
        </h3>
        <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function StatCell({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        border: "1px solid var(--s-border)",
        borderRadius: 10,
        background: "var(--s-sunken)",
        padding: "9px 10px",
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".07em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: "-.02em",
          color: color ?? "var(--s-t1)",
        }}
      >
        {value}
      </span>
      {hint && <span style={{ fontSize: 10.5, color: "var(--s-t3)" }}>{hint}</span>}
    </div>
  );
}

function InfoNote({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        border: "1px solid var(--s-border)",
        borderRadius: 12,
        background: "var(--s-sunken)",
        padding: "10px 12px",
        fontSize: 11.5,
        color: "var(--s-t2)",
        lineHeight: 1.45,
      }}
    >
      <Icon size={14} style={{ flex: "none", color: "var(--s-brand)", marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

// ── Bloco 7 · Funil de Vendas ────────────────────────────────────────────────
const FUNNEL: { label: string; key: "criadas" | "efetivadas" | "instaladas"; icon: LucideIcon }[] = [
  { label: "Criadas", key: "criadas", icon: ShoppingCart },
  { label: "Efetivadas", key: "efetivadas", icon: CheckCircle2 },
  { label: "Instaladas", key: "instaladas", icon: Rocket },
];

export function FunnelBlock({
  criadas,
  efetivadas,
  instaladas,
  ativacoes5g,
  efetCriado,
  instEfet,
}: {
  criadas: KpiValue;
  efetivadas: KpiValue;
  instaladas: KpiValue;
  ativacoes5g: KpiValue;
  efetCriado: number;
  instEfet: number;
}) {
  const byKey = { criadas, efetivadas, instaladas };

  return (
    <Panel title="Bloco 7 · Funil de Vendas" subtitle="Criadas → Efetivadas → Instaladas">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {FUNNEL.map(({ label, key, icon: Icon }) => {
          const k = byKey[key];
          const barW = Math.max(2, Math.min(100, k.atingimento));

          return (
            <div
              key={key}
              style={{
                border: "1px solid var(--s-border)",
                borderRadius: 13,
                background: "var(--s-sunken)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--s-t2)" }}>Vendas {label}</span>
                <Icon size={15} style={{ color: "var(--s-brand)" }} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 24,
                  letterSpacing: "-.02em",
                }}
              >
                {formatNumber(k.resultado)}
              </div>
              <div style={{ fontSize: 11, color: "var(--s-t3)" }}>
                Meta {formatNumber(k.meta)} · Projeção {formatNumber(k.projecao)}
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 99,
                  background: "var(--s-card)",
                  overflow: "hidden",
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 99,
                    width: `${barW}%`,
                    background: statusColor(k.atingimento),
                    transformOrigin: "left",
                    animation: "bdGrow .5s ease both",
                  }}
                />
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  fontWeight: 800,
                  color: statusColor(k.atingimento),
                }}
              >
                {formatPct(k.atingimento, 0)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <StatCell label="Efetivado / Criado" value={formatPct(efetCriado)} />
        <StatCell label="Instalado / Efetivado" value={formatPct(instEfet)} />
        <StatCell
          label="Ativações 5G"
          value={formatNumber(ativacoes5g.resultado)}
          hint={`Meta ${formatNumber(ativacoes5g.meta)}`}
        />
      </div>
    </Panel>
  );
}

// ── Bloco 5 · Churn ──────────────────────────────────────────────────────────
export function ChurnBlock({
  churnRate,
  cancelamentosMes,
  voluntarios,
  involuntarios,
  churn5g,
}: {
  churnRate: KpiValue;
  cancelamentosMes: number;
  voluntarios: number;
  involuntarios: number;
  churn5g: { churnRate: number; cancelamentos: number; comConsumo: number; semConsumo: number };
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
      <Panel title="Bloco 5 · Churn FTTH/FWA/BL" subtitle="Cancelamentos do mês">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCell
            label="Churn Rate"
            value={formatPct(churnRate.resultado)}
            hint={`Meta ${formatPct(churnRate.meta)}`}
            color={statusColor(churnRate.atingimento, true)}
          />
          <StatCell label="Cancelamentos Mês" value={formatNumber(cancelamentosMes)} />
          <StatCell label="Cancelamentos Voluntários" value={formatNumber(voluntarios)} />
          <StatCell label="Cancelamentos Involuntários" value={formatNumber(involuntarios)} />
        </div>
      </Panel>
      <Panel title="Bloco 5 · Churn 5G" subtitle="Cancelamentos com/sem consumo">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCell
            label="Churn Rate 5G"
            value={formatPct(churn5g.churnRate)}
            hint="Meta 2,00%"
            color={statusColor(churn5g.churnRate <= 2 ? 100 : 200, true)}
          />
          <StatCell label="Cancelamentos" value={formatNumber(churn5g.cancelamentos)} />
          <StatCell label="Com Consumo" value={formatNumber(churn5g.comConsumo)} />
          <StatCell label="Sem Consumo" value={formatNumber(churn5g.semConsumo)} />
        </div>
      </Panel>
    </div>
  );
}

// ── Cobertura & Penetração ───────────────────────────────────────────────────
export function CoverageBlock({
  scope,
  coverage,
  base5g,
  showBase5g,
}: {
  scope: "5G" | "Banda Larga";
  coverage: { totalCidades: number; totalBase: number; totalHP: number; takeup: number };
  base5g: number;
  showBase5g: boolean;
}) {
  return (
    <Panel title="Cobertura & Penetração" subtitle="Visão consolidada do escopo filtrado">
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".09em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
        }}
      >
        Escopo principal: {scope} {scope === "Banda Larga" && "(FTTH + FWA)"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <StatCell label="Cidades no escopo" value={formatNumber(coverage.totalCidades)} />
        <StatCell label={`Base Ativa ${scope}`} value={formatNumber(coverage.totalBase)} />
        <StatCell label="Home Passed" value={formatNumber(coverage.totalHP)} />
        <StatCell
          label="Takeup Geral"
          value={formatPct(coverage.takeup)}
          color={coverage.takeup >= 25 ? "var(--s-ok)" : "var(--s-t1)"}
        />
        {showBase5g && (
          <StatCell
            label="Base 5G (independente)"
            value={formatNumber(base5g)}
            hint="Não soma à Banda Larga"
          />
        )}
      </div>
      <InfoNote icon={Building2}>
        Drill-down: use os filtros acima para descer por Gerência → Coordenação → Supervisão → Cidade.
      </InfoNote>
      <InfoNote icon={Users}>
        KPIs recalculados no servidor a cada filtro · projeção pro-rata pelo dia atual.
      </InfoNote>
    </Panel>
  );
}
