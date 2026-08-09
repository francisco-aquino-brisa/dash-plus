"use client";

import {
  Activity,
  BarChart3,
  Briefcase,
  Files,
  Gauge,
  Grid2x2,
  Handshake,
  KeyRound,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Square,
  Target,
  TrendingUp,
  User,
  UserRound,
  Users,
} from "lucide-react";

/**
 * Curated icon set for páginas (`tb_paginas.icone` stores a kebab-case key). The
 * page form picks from this list; the table/nav resolve the key back to a lucide
 * component, falling back to a neutral square for an unknown key.
 */
export const PAGE_ICONS: { key: string; Icon: LucideIcon }[] = [
  { key: "activity", Icon: Activity },
  { key: "shopping-cart", Icon: ShoppingCart },
  { key: "users", Icon: Users },
  { key: "user", Icon: UserRound },
  { key: "shield-check", Icon: ShieldCheck },
  { key: "briefcase", Icon: Briefcase },
  { key: "files", Icon: Files },
  { key: "key", Icon: KeyRound },
  { key: "grid", Icon: LayoutGrid },
  { key: "matrix", Icon: Grid2x2 },
  { key: "bar-chart", Icon: BarChart3 },
  { key: "trending-up", Icon: TrendingUp },
  { key: "target", Icon: Target },
  { key: "gauge", Icon: Gauge },
  { key: "map-pin", Icon: MapPin },
  { key: "handshake", Icon: Handshake },
  { key: "profile", Icon: User },
];

const BY_KEY = new Map(PAGE_ICONS.map((i) => [i.key, i.Icon]));

export function resolvePageIcon(name: string | null | undefined): LucideIcon {
  return (name && BY_KEY.get(name)) || Square;
}

export function PageIcon({ name, size = 16 }: { name: string | null | undefined; size?: number }) {
  const Icon = resolvePageIcon(name);

  return <Icon size={size} />;
}
