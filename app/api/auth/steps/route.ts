import { NextRequest, NextResponse } from "next/server";
import { getSteps, SsoError } from "@/lib/sso/client";
import { isValidCpf, maskCpf } from "@/lib/auth/cpf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/steps?login={cpf}
 * Server-side proxy for the SSO discovery step. Returns
 * { name, picture, otp, captcha }. Validates the CPF before calling the SSO.
 */
export async function GET(req: NextRequest) {
  const login = req.nextUrl.searchParams.get("login") ?? "";

  if (!isValidCpf(login)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  try {
    const steps = await getSteps(maskCpf(login));

    return NextResponse.json(steps, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof SsoError ? err.status : 502;

    return NextResponse.json({ error: "Falha ao consultar o SSO" }, { status });
  }
}
