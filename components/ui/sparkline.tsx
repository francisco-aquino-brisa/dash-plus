"use client";

/**
 * Tiny 12-point sparkline (DESIGN_SYSTEM §4.3).
 *
 * Authored in a fixed 100×26 viewBox with `preserveAspectRatio="none"` so it
 * stretches to fill whatever width the KPI card gives it; the stroke stays
 * crisp via `vector-effect:non-scaling-stroke`.
 */
export function Sparkline({
  values,
  line,
  fill,
  height = 26,
}: {
  values: number[];
  /** Stroke colour (a `--s-*` var). */
  line: string;
  /** Area fill colour (a `--s-*` var). */
  fill: string;
  height?: number;
}) {
  const paths = sparkPaths(values, 100, 26, 3);

  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      style={{ flex: 1, height, minWidth: 40, opacity: 0.9 }}
      aria-hidden="true"
    >
      <path d={paths.area} fill={fill} />
      <path
        d={paths.line}
        fill="none"
        stroke={line}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Build the line + closed-area SVG paths for a series (prototype `paths()`). */
export function sparkPaths(values: number[], w: number, h: number, pad: number) {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const range = mx - mn || 1;
  const pts = values.map(
    (v, i) => [(i / (values.length - 1)) * w, h - pad - ((v - mn) / range) * (h - pad * 2)] as const,
  );
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return { line, area: `${line} L${w},${h} L0,${h} Z`, pts };
}
