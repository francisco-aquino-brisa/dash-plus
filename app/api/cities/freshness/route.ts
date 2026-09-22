import { NextResponse } from "next/server";
import { getCitiesWatermark } from "@/lib/data/cities/repository";
import { requireSession } from "@/lib/auth/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cities/freshness
 * Cheap watermark probe for the auto-refresh flag (see ADR 0002). The client
 * polls this and triggers a refresh only when the watermark advances.
 *
 * Session-guarded only, deliberately: the sidebar polls this on EVERY screen as
 * a liveness pulse, so gating it on the Cidades page would 403 in a loop for
 * everyone who does not hold that page. Endpoints that serve a screen's actual
 * data use `requirePageSession` instead (ADR 0007).
 */
export async function GET() {
  const session = await requireSession();

  if (session instanceof NextResponse) return session;

  try {
    const watermark = await getCitiesWatermark();

    return NextResponse.json({ watermark }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "freshness probe failed" }, { status: 502 });
  }
}
