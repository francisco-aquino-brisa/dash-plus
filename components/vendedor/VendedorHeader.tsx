"use client";

import { Briefcase, Building, Clock, MapPin, Radio, UserRound, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VendedorProfile } from "@/lib/data/vendedor/types";

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}

export function VendedorHeader({ profile }: { profile: VendedorProfile }) {
  const ativo = profile.situacao.toUpperCase() === "ATIVO";

  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-gradient-primary shadow-glow grid h-12 w-12 shrink-0 place-items-center rounded-xl text-primary-foreground">
            <UserRound className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold text-foreground">{profile.nome}</h2>
            <p className="text-xs text-muted-foreground">
              Matrícula {profile.matricula} · {profile.nivel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              ativo ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
            )}
          >
            {profile.situacao}
          </span>
          {profile.tipoCidade !== "—" && (
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {profile.tipoCidade}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field icon={MapPin} label="Cidade" value={profile.cidade} />
        <Field icon={Radio} label="Canal" value={profile.canal} />
        <Field icon={Briefcase} label="Gerente" value={profile.gerente} />
        <Field icon={Users2} label="Supervisão" value={profile.supervisao} />
        <Field icon={Building} label="Coordenação" value={profile.coordenacao} />
        <Field icon={Building} label="Gerência" value={profile.gerencia} />
        <Field icon={Radio} label="Nicho" value={profile.nicho} />
        <Field icon={Clock} label="Tempo de empresa" value={profile.tempoEmpresa} />
      </div>
    </section>
  );
}
