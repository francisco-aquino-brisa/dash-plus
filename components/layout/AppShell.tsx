"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ChevronsUpDown,
  ClipboardCheck,
  Database,
  Eye,
  Files,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeft,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  User,
  UserRound,
  Users,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SetNavPendingContext } from "@/lib/ui/nav-pending";
import { HC_FILTER_PARAMS } from "@/lib/data/hc-zerado/filters";

interface ShellUser {
  nome: string;
  email: string;
  nivel: string;
  isAdmin: boolean;
}

interface NavItem {
  title: string;
  short: string;
  href: string;
  icon: LucideIcon;
  /** Second line under the title. Only the HC Zerado screens carry one. */
  subtitle?: string;
}

const NAV: NavItem[] = [
  { title: "Performance Cidades", short: "Cidades", href: "/dashboard", icon: Activity },
  { title: "Vendas · Canais", short: "Canais", href: "/vendas", icon: ShoppingCart },
  { title: "Produtividade Comercial", short: "Produtiv.", href: "/produtividade", icon: Users },
  { title: "Dashboard Vendedor", short: "Vendedor", href: "/vendedor", icon: UserRound },
  { title: "HC Zerado", short: "HC Zerado", href: "/hc-zerado/desempenho", icon: UserX },
];

// Entering the admin area swaps the whole navigation to the management screens
// (DESIGN_SYSTEM §5). The swap and its explicit exit exist on both platforms.
const ADMIN_NAV: NavItem[] = [
  { title: "Usuários", short: "Usuários", href: "/admin/usuarios", icon: Users },
  { title: "Níveis de acesso", short: "Níveis", href: "/admin/niveis", icon: ShieldCheck },
  { title: "Cargos", short: "Cargos", href: "/admin/cargos", icon: Briefcase },
  { title: "Páginas", short: "Páginas", href: "/admin/paginas", icon: Files },
  { title: "Permissões", short: "Permiss.", href: "/admin/capacidades", icon: KeyRound },
  { title: "Permissões por nível", short: "Matriz", href: "/admin/permissoes", icon: LayoutGrid },
  { title: "Indicadores", short: "Indic.", href: "/admin/indicadores", icon: Activity },
];

// HC Zerado swaps the sidebar the same way the admin area does. Titles and
// subtitles are the ones the original Brisa Radar screens carry.
const HC_ZERADO_NAV: NavItem[] = [
  {
    title: "Desempenho HC",
    short: "Desemp.",
    subtitle: "Ativos e Zerados",
    href: "/hc-zerado/desempenho",
    icon: LayoutDashboard,
  },
  {
    title: "Análise de Produtividade",
    short: "Produtiv.",
    subtitle: "Mensal e Zerados",
    href: "/hc-zerado/produtividade",
    icon: Database,
  },
  {
    title: "Matriz Gerencial",
    short: "Matriz",
    subtitle: "Ociosidade de Regional",
    href: "/hc-zerado/matriz",
    icon: LayoutGrid,
  },
  {
    title: "Justificar HC",
    short: "Justificar",
    subtitle: "Ociosidade Zerados",
    href: "/hc-zerado/justificar",
    icon: ClipboardCheck,
  },
  {
    title: "Auditar Justificativas",
    short: "Auditar",
    subtitle: "Consultar & Avaliar",
    href: "/hc-zerado/auditar",
    icon: Eye,
  },
];

const COLLAPSE_KEY = "brisa-sidebar-collapsed";
const THEME_KEY = "brisa-dash-theme";
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Theme = "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "dark") setTheme("dark");
  }, []);

  const toggle = () =>
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";

      document.documentElement.setAttribute("data-theme", next);

      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage disabled */
      }

      return next;
    });

  return [theme, toggle];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Short "Nome S." form used in the sidebar profile row. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) return name;

  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** The data-source status line ("Databricks · Ago/26" + "atualizado 07:33 · cache 1h"). */
function useDataSource() {
  const now = new Date();
  const competencia = `${MONTHS[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch("/api/cities/freshness")
      .then((r) => (r.ok ? r.json() : null))
      .then(() => {
        if (!alive) return;

        const d = new Date();

        setUpdatedAt(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  return {
    line: `Databricks · ${competencia}`,
    sub: updatedAt ? `atualizado ${updatedAt} · cache 1h` : "conectando…",
  };
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [railed, setRailed] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [userMenu, setUserMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The brand loader lights on either a menu page change (menuPending, a
  // transition) or a screen's own filter/refresh request (screenPending, set via
  // the nav-pending context / useReportNavPending). Both are transition-backed,
  // so the loader stays lit for the whole request — click to commit — no flicker.
  const [screenPending, setScreenPending] = useState(false);
  const [menuPending, startNav] = useTransition();
  const navPending = menuPending || screenPending;
  const source = useDataSource();

  useEffect(() => {
    setRailed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  useEffect(() => {
    setUserMenu(false);
    setMoreOpen(false);
  }, [pathname]);

  // Navigate through a transition so menuPending covers the full page change.
  // Keep <Link> for prefetch / middle-click / new-tab — only intercept a plain
  // left-click to a different path.
  const navTo = (href: string) => (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    if (new URL(href, window.location.origin).pathname === pathname) return;

    e.preventDefault();
    setUserMenu(false);
    setMoreOpen(false);
    startNav(() => router.push(href));
  };

  const toggleRail = () =>
    setRailed((c) => {
      const next = !c;

      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");

      return next;
    });

  const expanded = !railed;
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const inHcZerado = pathname === "/hc-zerado" || pathname.startsWith("/hc-zerado/");
  const inSubArea = inAdmin || inHcZerado;
  const navItems = inHcZerado ? HC_ZERADO_NAV : inAdmin ? ADMIN_NAV : NAV;
  const navHeading = "Navegação";
  const activeTitle = navItems.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.title;

  // Carry the active filters along when switching between the 5 HC Zerado
  // screens, so a filter set on one screen doesn't reset on the next — the
  // same querystring keys `HcFilterPanel` already writes on every screen.
  const searchParams = useSearchParams();
  const hcFilterQuery = useMemo(() => {
    if (!inHcZerado) return "";

    const q = new URLSearchParams();

    for (const key of HC_FILTER_PARAMS) {
      const value = searchParams.get(key);

      if (value) q.set(key, value);
    }

    return q.toString();
  }, [inHcZerado, searchParams]);
  const navHref = (href: string) => (hcFilterQuery ? `${href}?${hcFilterQuery}` : href);

  // The mobile tab bar only shows the first 3 items; a screen reached through
  // "Mais" (e.g. Justificar HC, Auditar Justificativas) would otherwise leave
  // every tab unlit, reading as if the bar lost track of where you are.
  const overflowActive = !navItems
    .slice(0, 3)
    .some((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  const ghostBtn: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    border: "1px solid var(--s-border)",
    borderRadius: 9,
    background: "var(--s-sunken)",
    color: "var(--s-t2)",
    padding: "7px 8px",
    font: "inherit",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    transition: ".16s",
  };

  return (
    <SetNavPendingContext.Provider value={setScreenPending}>
      <TooltipProvider delayDuration={0}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            overflow: "hidden",
            background: "var(--s-page)",
          }}
        >
          {/* Mobile header */}
          <div
            className="flex-none border-b border-border bg-card lg:hidden"
            style={{ position: "sticky", top: 0, zIndex: 30 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px 10px" }}>
              <div
                style={{
                  flex: "none",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 7,
                  background: "var(--bn-gradient-orange)",
                  boxShadow: "0 5px 14px -6px rgba(229,48,1,.55)",
                }}
              >
                {/* Logo stays in flow to reserve the tile width; the dots overlay
                    it during a filter navigation so the tile never resizes. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brisanet-logo-white.png"
                  alt="Brisanet"
                  style={{
                    display: "block",
                    height: 12,
                    width: "auto",
                    visibility: navPending ? "hidden" : "visible",
                  }}
                />
                {navPending && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BrandLoadingDots />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="font-display"
                  style={{
                    fontWeight: 800,
                    fontSize: 17,
                    letterSpacing: "-.02em",
                    color: "var(--s-t1)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activeTitle ?? "Brisa Dash"}
                </div>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="bd-ghost"
                style={{
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "1px solid var(--s-border)",
                  background: "var(--s-sunken)",
                  color: "var(--s-t2)",
                  cursor: "pointer",
                }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <span
                style={{
                  flex: "none",
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "1px solid var(--s-border)",
                  background: "var(--s-brand-weak)",
                  color: "var(--s-brand)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {initials(user.nome)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "stretch", flex: 1, minHeight: 0 }}>
            {/* Desktop sidebar */}
            <aside
              className="hidden lg:flex"
              style={{
                flex: "none",
                zIndex: 35,
                minHeight: 0,
                width: railed ? 64 : 236,
                borderRight: "1px solid var(--s-border)",
                background: "var(--s-card)",
                flexDirection: "column",
                padding: "16px 12px",
                gap: 18,
                transition: "width .18s ease",
              }}
            >
              {/* Brand + theme toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
                {/* The orange brand tile keeps its size; while a filter navigation
                    is in flight the logo is replaced by bouncing loading dots. */}
                <div
                  title="Brisanet"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 38,
                    padding: expanded && !navPending ? "0 14px" : 0,
                    borderRadius: 10,
                    background: "var(--bn-gradient-orange)",
                    boxShadow: "0 6px 16px -6px rgba(229,48,1,.55)",
                  }}
                >
                  {navPending ? (
                    <BrandLoadingDots />
                  ) : expanded ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/brisanet-logo-white.png"
                      alt="Brisanet"
                      style={{ display: "block", height: 15, width: "auto", maxWidth: "100%" }}
                    />
                  ) : null}
                </div>
                {expanded && (
                  <button
                    onClick={toggleTheme}
                    title="Alternar tema"
                    aria-label="Alternar tema"
                    className="bd-ghost"
                    style={{
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid var(--s-border)",
                      background: "var(--s-sunken)",
                      color: "var(--s-t2)",
                      cursor: "pointer",
                      transition: ".16s",
                    }}
                  >
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                )}
              </div>

              {expanded && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "var(--s-t3)",
                    marginTop: -12,
                    padding: "0 4px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Dashboards executivos
                </div>
              )}

              {!expanded && (
                <button
                  onClick={toggleTheme}
                  title="Alternar tema"
                  aria-label="Alternar tema"
                  className="bd-ghost"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "100%",
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid var(--s-border)",
                    background: "var(--s-sunken)",
                    color: "var(--s-t2)",
                    cursor: "pointer",
                  }}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              )}

              {/* Collapse */}
              <button
                onClick={toggleRail}
                title={expanded ? "Recolher menu" : "Expandir menu"}
                aria-label={expanded ? "Recolher menu" : "Expandir menu"}
                className="bd-ghost"
                style={ghostBtn}
              >
                <PanelLeft size={16} style={{ flex: "none" }} />
                {expanded && (
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Recolher menu
                  </span>
                )}
              </button>

              {/* Navigation (scrolls) */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {expanded && (
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".11em",
                      textTransform: "uppercase",
                      color: "var(--s-t3)",
                      padding: "0 8px 8px",
                    }}
                  >
                    {navHeading}
                  </div>
                )}
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={navHref(item.href)}
                      onClick={navTo(navHref(item.href))}
                      title={item.title}
                      className="bd-nav"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        border: 0,
                        borderRadius: 10,
                        padding: 9,
                        fontSize: 13.5,
                        fontWeight: active ? 800 : 600,
                        color: active ? "var(--s-brand)" : "var(--s-t2)",
                        background: active ? "var(--s-brand-weak)" : undefined,
                        textDecoration: "none",
                        transition: ".16s",
                        justifyContent: expanded ? "flex-start" : "center",
                      }}
                    >
                      <Icon size={17} style={{ flex: "none", opacity: 0.95 }} />
                      {expanded && (
                        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: "var(--s-t3)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                      )}
                      {expanded && (
                        <span
                          style={{
                            flex: "none",
                            width: 5,
                            height: 5,
                            borderRadius: 99,
                            background: active ? "var(--s-brand)" : "transparent",
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Footer (fixed) */}
              <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {inSubArea ? (
                  <Link
                    href="/dashboard"
                    onClick={navTo("/dashboard")}
                    title="Voltar aos dashboards"
                    className="bd-ghost"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      border: "1px solid var(--s-brand-line)",
                      borderRadius: 10,
                      padding: 9,
                      background: "var(--s-brand-weak)",
                      color: "var(--s-brand)",
                      fontSize: 13,
                      fontWeight: 800,
                      textDecoration: "none",
                      transition: ".16s",
                      justifyContent: expanded ? "flex-start" : "center",
                    }}
                  >
                    <ArrowLeft size={17} style={{ flex: "none" }} />
                    {expanded && (
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Voltar aos dashboards
                      </span>
                    )}
                  </Link>
                ) : (
                  user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={navTo("/admin")}
                      title="Área administrativa"
                      className="bd-ghost"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        border: "1px solid var(--s-border)",
                        borderRadius: 10,
                        padding: 9,
                        background: "var(--s-card)",
                        color: "var(--s-t2)",
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: "none",
                        transition: ".16s",
                        justifyContent: expanded ? "flex-start" : "center",
                      }}
                    >
                      <Settings size={17} style={{ flex: "none" }} />
                      {expanded && (
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Administração
                        </span>
                      )}
                    </Link>
                  )
                )}

                {/* Data source */}
                {expanded ? (
                  <div
                    title={`${source.line} — ${source.sub}`}
                    style={{
                      border: "1px solid var(--s-border)",
                      borderRadius: 12,
                      padding: "11px 12px",
                      background: "var(--s-sunken)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--s-t2)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: "var(--s-ok)",
                          boxShadow: "0 0 0 3px var(--s-ok-bg)",
                        }}
                      />
                      {source.line}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 4 }}>{source.sub}</div>
                  </div>
                ) : (
                  <div
                    title={`${source.line} — ${source.sub}`}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      height: 34,
                      border: "1px solid var(--s-border)",
                      borderRadius: 10,
                      background: "var(--s-sunken)",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        background: "var(--s-ok)",
                        boxShadow: "0 0 0 3px var(--s-ok-bg)",
                      }}
                    />
                  </div>
                )}

                {/* Profile + menu */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setUserMenu((v) => !v)}
                    title={user.nome}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      width: "100%",
                      textAlign: "left",
                      border: 0,
                      borderRadius: 10,
                      padding: 5,
                      background: userMenu ? "var(--s-sunken)" : "transparent",
                      font: "inherit",
                      cursor: "pointer",
                      transition: ".16s",
                      justifyContent: expanded ? "flex-start" : "center",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: "var(--s-brand-weak)",
                        color: "var(--s-brand)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10.5,
                        fontWeight: 800,
                      }}
                    >
                      {initials(user.nome)}
                    </span>
                    {expanded && (
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "var(--s-t1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {shortName(user.nome)}
                        </span>
                        <span style={{ display: "block", fontSize: 10, color: "var(--s-t3)" }}>
                          Conta e sessão
                        </span>
                      </span>
                    )}
                    {expanded && <ChevronsUpDown size={14} style={{ flex: "none", color: "var(--s-t3)" }} />}
                  </button>

                  {userMenu && (
                    <>
                      <div
                        onClick={() => setUserMenu(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 55 }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          zIndex: 60,
                          bottom: "calc(100% + 6px)",
                          left: 0,
                          minWidth: 200,
                          padding: 6,
                          background: "var(--s-card)",
                          border: "1px solid var(--s-border)",
                          borderRadius: 12,
                          boxShadow: "var(--s-sh-2)",
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 10px 9px",
                            borderBottom: "1px solid var(--s-border)",
                            marginBottom: 5,
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--s-t1)" }}>
                            {user.nome}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 2 }}>
                            {user.email}
                          </div>
                        </div>
                        {user.isAdmin && (
                          <button
                            onClick={() => {
                              setUserMenu(false);
                              startNav(() => router.push("/admin"));
                            }}
                            className="bd-menuitem"
                            style={menuItem("var(--s-t1)")}
                          >
                            <Settings size={15} style={{ flex: "none" }} />
                            <span>Administração</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            startNav(() => router.push("/perfil"));
                          }}
                          className="bd-menuitem"
                          style={menuItem("var(--s-t1)")}
                        >
                          <User size={15} style={{ flex: "none" }} />
                          <span>Ver perfil</span>
                        </button>
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            startNav(() => router.push("/organograma"));
                          }}
                          className="bd-menuitem"
                          style={menuItem("var(--s-t1)")}
                        >
                          <Network size={15} style={{ flex: "none" }} />
                          <span>Organograma</span>
                        </button>
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            window.location.assign("/logout");
                          }}
                          className="bd-menuitem"
                          style={menuItem("var(--s-bad)")}
                        >
                          <LogOut size={15} style={{ flex: "none" }} />
                          <span>Sair</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </aside>

            {/* Content column (own scroll) */}
            <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto" }}>{children}</main>
          </div>

          {/* Mobile tab bar: first 3 screens + Mais */}
          <nav
            className="flex lg:hidden"
            style={{
              flex: "none",
              alignItems: "stretch",
              gap: 2,
              padding: "6px 8px 10px",
              background: "var(--s-card)",
              borderTop: "1px solid var(--s-border)",
            }}
          >
            {navItems.slice(0, 3).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={navHref(item.href)}
                  onClick={navTo(navHref(item.href))}
                  style={tabItem(active)}
                >
                  <Icon size={20} />
                  <span style={tabLabel}>{item.short}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              style={tabItem(moreOpen || overflowActive)}
            >
              <MoreHorizontal size={20} />
              <span style={tabLabel}>Mais</span>
            </button>
          </nav>

          {/* "Mais" bottom sheet */}
          {moreOpen && (
            <div className="lg:hidden" style={{ position: "fixed", inset: 0, zIndex: 80 }}>
              <div
                onClick={() => setMoreOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15,15,26,.45)",
                  backdropFilter: "blur(3px)",
                  animation: "bdFade .2s ease both",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  insetInline: 0,
                  bottom: 0,
                  maxHeight: "88%",
                  overflowY: "auto",
                  background: "var(--s-card)",
                  borderRadius: "22px 22px 0 0",
                  padding: "16px 14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  animation: "bdSheet .24s cubic-bezier(.2,.9,.3,1) both",
                }}
              >
                <div style={{ padding: "0 6px 8px" }}>
                  <div
                    className="font-display"
                    style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.02em", color: "var(--s-t1)" }}
                  >
                    {inHcZerado ? "HC Zerado" : inAdmin ? "Administração" : "Dashboards"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
                    {inHcZerado
                      ? "Ociosidade comercial: HC ativo, zerados e justificativas."
                      : inAdmin
                        ? "Telas gerenciais da área administrativa."
                        : "Novas telas aparecem aqui automaticamente."}
                  </div>
                </div>
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={navHref(item.href)}
                      onClick={navTo(navHref(item.href))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        width: "100%",
                        minHeight: 50,
                        padding: "0 12px",
                        borderRadius: 12,
                        textDecoration: "none",
                        fontSize: 13.5,
                        fontWeight: active ? 800 : 600,
                        color: active ? "var(--s-brand)" : "var(--s-t2)",
                        background: active ? "var(--s-brand-weak)" : "transparent",
                      }}
                    >
                      <Icon size={18} style={{ flex: "none" }} />
                      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--s-t3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={15} style={{ flex: "none", opacity: 0.5 }} />
                    </Link>
                  );
                })}
                {!inSubArea && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      padding: "11px 12px",
                      border: "1px dashed var(--s-border-2)",
                      borderRadius: 12,
                      color: "var(--s-t3)",
                      fontSize: 11.5,
                    }}
                  >
                    <Plus size={16} style={{ flex: "none" }} />
                    Espaço reservado para os próximos dashboards.
                  </div>
                )}
                {inSubArea ? (
                  <Link
                    href="/dashboard"
                    onClick={navTo("/dashboard")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      width: "100%",
                      minHeight: 50,
                      marginTop: 8,
                      padding: "0 12px",
                      border: "1px solid var(--s-brand-line)",
                      borderRadius: 12,
                      background: "var(--s-brand-weak)",
                      color: "var(--s-brand)",
                      textDecoration: "none",
                      fontSize: 13.5,
                      fontWeight: 800,
                    }}
                  >
                    <ArrowLeft size={18} style={{ flex: "none" }} />
                    <span style={{ flex: 1 }}>Voltar aos dashboards</span>
                    <ChevronRight size={15} style={{ flex: "none", opacity: 0.5 }} />
                  </Link>
                ) : (
                  user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={navTo("/admin")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        width: "100%",
                        minHeight: 50,
                        marginTop: 8,
                        padding: "0 12px",
                        border: "1px solid var(--s-border)",
                        borderRadius: 12,
                        background: "var(--s-card)",
                        color: "var(--s-t2)",
                        textDecoration: "none",
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      <Settings size={18} style={{ flex: "none" }} />
                      <span style={{ flex: 1 }}>Administração</span>
                      <ChevronRight size={15} style={{ flex: "none", opacity: 0.5 }} />
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </SetNavPendingContext.Provider>
  );
}

/** Three bouncing white dots shown in the brand tile during a filter navigation. */
function BrandLoadingDots() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: "#fff",
            animation: `bdBounce 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

function tabItem(active: boolean): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: 0,
    borderRadius: 12,
    background: active ? "var(--s-brand-weak)" : "transparent",
    color: active ? "var(--s-brand)" : "var(--s-t3)",
    font: "inherit",
    textDecoration: "none",
    cursor: "pointer",
    transition: ".16s",
  };
}

const tabLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: "-.01em",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function menuItem(fg: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    textAlign: "left",
    minHeight: 38,
    padding: "0 10px",
    border: 0,
    borderRadius: 9,
    background: "transparent",
    color: fg,
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}
