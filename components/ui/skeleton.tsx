import { cn } from "@/lib/utils";

/** Pulsing placeholder block. Use to mirror real layout while data loads. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-secondary/60", className)} {...props} />;
}
