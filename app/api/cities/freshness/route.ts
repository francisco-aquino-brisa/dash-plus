import { NextResponse } from "next/server";
import { getCitiesWatermark } from "@/lib/data/cities/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cities/freshness
 * Cheap watermark probe for the auto-refresh flag (see ADR 0002). The client
 * polls this and triggers a refresh only when the watermark advances.
 */
export async function GET() {
  try {
    const watermark = await getCitiesWatermark();

    return NextResponse.json({ watermark }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "freshness probe failed" }, { status: 502 });
  }
}
