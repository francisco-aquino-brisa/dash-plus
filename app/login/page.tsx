"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Info } from "lucide-react";
import { isValidCpf, maskCpf, onlyDigits } from "@/lib/auth/cpf";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Actionable guidance per login failure, shown in the error tooltip. */
function hintForStatus(status: number): string {
  if (status === 400) return "Preencha o CPF e a senha corretamente.";

  if (status === 401) return "Confira seu CPF, senha e o código (OTP), se solicitado.";

  if (status === 403)
    return "Seu acesso ainda não foi liberado. Peça ao time de dados para cadastrar e ativar seu CPF.";

  return "Instabilidade ao validar o acesso. Tente novamente em instantes; se persistir, avise o time de dados.";
}

interface Steps {
  name: string;
  picture: string;
  otp: boolean;
  captcha: boolean;
}

const PICTURE_BASE =
  process.env.NEXT_PUBLIC_SSO_PICTURE_BASE_URL ?? "https://novorevan.brisanet.net.br/assets/img/users";

// Rotating brand taglines for the login panel.
const TAGLINES: { title: string; subtitle: string }[] = [
  {
    title: "Performance Cidades",
    subtitle: "Acesse com sua conta Brisanet para visualizar os indicadores executivos.",
  },
  {
    title: "Dashboards Corporativos",
    subtitle: "Monitoramento de dados internos, centralizado e em tempo real.",
  },
  {
    title: "Dados Financeiros",
    subtitle: "A saúde financeira de diversos setores reunida em um só lugar.",
  },
  {
    title: "Inteligência Comercial",
    subtitle: "Vendas, crescimento de base e churn sob a sua visão.",
  },
];
const TAGLINE_INTERVAL_MS = 5000;

export default function LoginPage() {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [steps, setSteps] = useState<Steps | null>(null);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);

  // Rotate the brand taglines on the left panel.
  const [tagIndex, setTagIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTagIndex((i) => (i + 1) % TAGLINES.length), TAGLINE_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);
  const tag = TAGLINES[tagIndex];

  const lastQueried = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDiscovery = useCallback(() => {
    setSteps(null);
    setStepsError(null);
    setOtp("");
    lastQueried.current = "";
  }, []);

  useEffect(() => {
    const digits = onlyDigits(cpf);

    if (digits.length < 11 || !isValidCpf(digits)) {
      resetDiscovery();

      return;
    }

    if (digits === lastQueried.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      lastQueried.current = digits;
      setStepsLoading(true);
      setStepsError(null);
      setSteps(null);

      try {
        const res = await fetch(`/api/auth/steps?login=${encodeURIComponent(maskCpf(digits))}`);

        if (!res.ok) throw new Error("steps");

        setSteps((await res.json()) as Steps);
      } catch {
        setStepsError("Não foi possível identificar este CPF. Tente novamente.");
      } finally {
        setStepsLoading(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cpf, resetDiscovery]);

  const canSubmit = isValidCpf(cpf) && password.length > 0 && (!steps?.otp || otp.length > 0) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: maskCpf(cpf), password, otp: steps?.otp ? otp : undefined }),
      });

      if (!res.ok) {
        if (res.status >= 500) {
          // Unhandled/internal failure — don't surface server details to the user.
          setError({
            message: "Erro interno do servidor. Tente novamente em instantes.",
            hint: hintForStatus(res.status),
          });
        } else {
          const data = await res.json().catch(() => ({}));
          setError({ message: data.error || "Não foi possível entrar.", hint: hintForStatus(res.status) });
        }

        setSubmitting(false);

        return;
      }

      // Hard navigation so middleware re-evaluates with the new session cookie.
      window.location.assign("/dashboard");
    } catch {
      setError({
        message: "Falha de conexão ao entrar.",
        hint: "Verifique sua conexão e tente novamente em instantes.",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="bg-gradient-primary relative hidden w-1/2 flex-col justify-between p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <Activity className="h-5 w-5" />
          </span>
          Brisanet
        </div>

        <div className="min-h-[180px]">
          {/* key forces the entrance animation to replay on each tagline change */}
          <div key={tagIndex} className="animate-tagline-in">
            <h1 className="text-4xl leading-tight font-bold">{tag.title}</h1>
            <p className="mt-4 max-w-sm text-primary-foreground/80">{tag.subtitle}</p>
          </div>
          {/* progress dots */}
          <div className="mt-8 flex gap-2">
            {TAGLINES.map((t, i) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setTagIndex(i)}
                aria-label={t.title}
                className={cn(
                  "h-1.5 rounded-full bg-white/40 transition-all",
                  i === tagIndex ? "w-8 bg-white/90" : "w-3 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </div>

        <div className="text-sm text-primary-foreground/70">© Brisanet · uso interno</div>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden">
            <span className="text-gradient text-2xl font-extrabold">Brisanet</span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use seu CPF e senha da Brisanet.</p>
          </div>

          <Field label="CPF">
            <Input
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className="bg-secondary/60"
            />
            {stepsLoading && <p className="mt-1 text-xs text-muted-foreground">Identificando…</p>}
            {stepsError && <p className="mt-1 text-xs text-destructive">{stepsError}</p>}
          </Field>

          {steps && steps.name && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${PICTURE_BASE}/${steps.picture}`}
                alt={steps.name}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full bg-secondary object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{steps.name}</p>
                <p className="text-xs text-muted-foreground">{maskCpf(cpf)}</p>
              </div>
            </div>
          )}

          <Field label="Senha">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/60"
            />
          </Field>

          {steps?.otp && (
            <Field label="Código (OTP)">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(onlyDigits(e.target.value).slice(0, 8))}
                className="bg-secondary/60"
              />
            </Field>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span className="flex-1">{error.message}</span>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Mais detalhes do erro"
                      className="mt-0.5 shrink-0 cursor-help text-destructive/70 transition-colors hover:text-destructive focus:outline-none"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-[260px] text-left leading-relaxed whitespace-normal"
                  >
                    {error.hint}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          <Button type="submit" disabled={!canSubmit} className={cn("w-full")}>
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
