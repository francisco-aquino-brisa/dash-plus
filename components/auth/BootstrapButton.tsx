"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * Link to `/bootstrap` that shows it is working.
 *
 * `/bootstrap` is a route handler that queries Databricks and then redirects, so
 * this is a full browser navigation — there is no transition to hook into, and
 * the click can sit for seconds with nothing happening. The click is NOT
 * prevented: the state only paints the spinner while the browser navigates away.
 *
 * Coming back through bfcache restores the page with the spinner still lit,
 * hence the `pageshow` reset.
 */
export function BootstrapButton({
  href = "/bootstrap",
  icon,
  label,
  pendingLabel,
  className,
  style,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
  pendingLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const restore = (e: PageTransitionEvent) => e.persisted && setPending(false);

    window.addEventListener("pageshow", restore);

    return () => window.removeEventListener("pageshow", restore);
  }, []);

  return (
    <a
      href={href}
      aria-busy={pending}
      onClick={() => setPending(true)}
      className={className}
      style={{ ...style, ...(pending ? { pointerEvents: "none", opacity: 0.85 } : null) }}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4" style={{ animation: "bdSpin .7s linear infinite" }} />
      ) : (
        icon
      )}
      {pending ? pendingLabel : label}
    </a>
  );
}
