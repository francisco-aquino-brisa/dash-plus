"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IndicatorDef } from "@/lib/indicators/definitions";

/**
 * Small "i" badge that reveals an indicator's calculation on hover/focus.
 * Rendered as a <span> (not <button>) so it can sit inside a clickable card
 * without nesting buttons; stops propagation so it never triggers the card.
 * Relies on the TooltipProvider in AppShell.
 */
export function InfoHint({ def, className }: { def: IndicatorDef; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label="Como este indicador é calculado"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "inline-grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full text-muted-foreground/60 transition-colors hover:text-primary focus:outline-none focus-visible:text-primary",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[280px] text-left text-xs leading-relaxed whitespace-normal"
      >
        {def.formula}
      </TooltipContent>
    </Tooltip>
  );
}
