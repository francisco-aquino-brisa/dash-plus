import { Construction } from "lucide-react";

export function PlaceholderScreen({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-2.5rem)]">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-4">
          <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
            <Construction className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl leading-tight font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] place-items-center px-6 py-24">
        <div className="shadow-elegant rounded-2xl border border-dashed border-border bg-card/40 px-10 py-16 text-center">
          <Construction className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-4 text-lg font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description ?? "Em breve."}</p>
        </div>
      </div>
    </div>
  );
}
