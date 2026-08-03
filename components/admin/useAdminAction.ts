"use client";

import { useState } from "react";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import type { ActionResult } from "@/lib/data/admin/types";

/**
 * Runs an admin server action with shared busy/error state and drives the shell
 * loader while it is in flight. On success the action has already
 * `revalidatePath`'d, so the server data re-renders; the caller just closes its
 * modal via `onOk`.
 */
export function useAdminAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPending = useSetNavPending();

  async function run(fn: () => Promise<ActionResult>, onOk?: () => void): Promise<void> {
    setBusy(true);
    setError(null);
    setPending(true);

    try {
      const res = await fn();

      if (res.ok) onOk?.();
      else setError(res.error);
    } catch {
      setError("Falha inesperada. Tente novamente.");
    } finally {
      setBusy(false);
      setPending(false);
    }
  }

  return { busy, error, setError, run };
}
