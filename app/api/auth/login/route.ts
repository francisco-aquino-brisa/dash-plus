import { NextRequest, NextResponse } from "next/server";
import { login as ssoLogin, SsoError } from "@/lib/sso/client";
import { isValidCpf, maskCpf } from "@/lib/auth/cpf";
import { authorizeByCpf } from "@/lib/auth/authz";
import { signSession, SESSION_COOKIE, getSessionTtlSeconds } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body: { username (CPF), password, otp? }
 * Forwards to the SSO; on success, issues the internal JWT and sets the
 * httpOnly cookie. NEVER logs password/otp.
 */
export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; otp?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const username = body.username ?? "";
  const password = body.password ?? "";
  const otp = body.otp?.trim() || undefined;

  if (!isValidCpf(username) || !password) {
    return NextResponse.json({ error: "Credenciais incompletas" }, { status: 400 });
  }

  // 1) Validate credentials against the Brisanet SSO.
  let user;

  try {
    user = await ssoLogin({ username: maskCpf(username), password, otp });
  } catch (err) {
    if (err instanceof SsoError) {
      const status = err.status >= 400 && err.status < 500 ? 401 : 502;

      return NextResponse.json({ error: err.message }, { status });
    }

    // Non-SsoError here = couldn't reach the SSO (DNS/network/timeout). Common
    // when the runtime can't route to the internal SSO host. NEVER log secrets.
    console.error("[login] SSO unreachable:", (err as Error)?.name, "-", (err as Error)?.message);

    return NextResponse.json({ error: "Não foi possível contatar o SSO da Brisanet." }, { status: 502 });
  }

  // 2) Authorize against cadastro_usuario (must exist + usuario_ativo = true).
  let authz;

  try {
    authz = await authorizeByCpf(username);
  } catch (err) {
    // Databricks query failed — usually the app service principal lacks access to
    // the SQL Warehouse / tables. Log the FULL error (stack + every own property)
    // so the exact cause is visible in the runtime logs. No secrets are in here.
    console.error("[login] cadastro_usuario lookup failed:", err);

    try {
      console.error("[login] error detail:", JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    } catch {
      /* non-serializable error */
    }

    return NextResponse.json({ error: "Falha ao verificar o acesso na base de usuários." }, { status: 502 });
  }

  if (!authz) {
    return NextResponse.json(
      { error: "Seu usuário não tem acesso liberado a este painel. Procure o time de dados." },
      { status: 403 },
    );
  }

  // 3) Issue the session token: identity from SSO + email/permissao from the table.
  try {
    const token = await signSession({
      id: user.id,
      picture: user.picture,
      username: user.username,
      name: user.name,
      email: authz.email,
      permissao: authz.permissao,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        picture: user.picture,
        username: user.username,
        name: user.name,
        email: authz.email,
        permissao: authz.permissao,
      },
    });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSessionTtlSeconds(),
    });

    return res;
  } catch (err) {
    // Reaches here only if signing fails (e.g. JWT_SECRET missing/misconfigured).
    console.error("[login] session signing failed:", (err as Error)?.message);

    return NextResponse.json({ error: "Falha ao gerar a sessão." }, { status: 500 });
  }
}
