"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  LogOut,
  Menu,
  PanelLeft,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { title: "Performance Cidades", href: "/dashboard", icon: Activity },
  { title: "Vendas · Canais", href: "/vendas", icon: ShoppingCart },
  { title: "Produtividade Comercial", href: "/produtividade", icon: Users },
  { title: "Dashboard Vendedor", href: "/vendedor", icon: UserRound },
];

const STORAGE_KEY = "brisa-sidebar-collapsed";

/** Navigation links, shared by the desktop rail and the mobile drawer. */
function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {!collapsed && (
        <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Navegação
        </div>
      )}
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-secondary",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}
    </>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-border px-3">
      <span className="bg-gradient-primary shadow-glow grid h-7 w-7 shrink-0 place-items-center rounded-lg text-primary-foreground">
        <BarChart3 className="h-4 w-4" />
      </span>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-bold">Brisanet</div>
          <div className="text-[10px] text-muted-foreground">Dashboards executivos</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ user, children }: { user: { name: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the collapsed preference (persisted across reloads).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;

      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");

      return next;
    });

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar (icon rail when collapsed) — hidden on mobile */}
        <aside
          className={cn(
            "sticky top-0 z-40 hidden h-screen shrink-0 border-r border-border bg-card/60 backdrop-blur transition-[width] duration-200 ease-out lg:block",
            collapsed ? "w-[3.75rem]" : "w-64",
          )}
        >
          <div className="flex h-full flex-col">
            <Brand collapsed={collapsed} />
            <nav className="flex-1 space-y-1 p-2">
              <NavLinks collapsed={collapsed} />
            </nav>
          </div>
        </aside>

        {/* Mobile drawer + overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside className="shadow-elegant absolute top-0 left-0 h-full w-64 border-r border-border bg-card">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border pr-2">
                  <div className="flex-1">
                    <Brand collapsed={false} />
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fechar menu"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav className="flex-1 space-y-1 p-2">
                  <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
                </nav>
              </div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: hamburger on mobile, collapse trigger on desktop */}
          <div className="sticky top-0 z-30 flex h-10 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className="hidden h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[#5ecccb] hover:text-foreground lg:grid"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <span className="truncate text-xs text-muted-foreground">Brisanet · Dashboards</span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
              <button
                onClick={logout}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </TooltipProvider>
  );
}
