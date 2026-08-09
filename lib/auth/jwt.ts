import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Stateless internal session. The app runs inside Databricks Apps, which
 * authenticates the user at the edge and forwards their email. After the gate
 * resolves the user against `tb_usuarios`, we issue a signed JWT (HS256)
 * holding the minimal user data and store it in an httpOnly cookie. There is no
 * database session: the cookie is the single source of the session. See ADR 0005.
 */

export const SESSION_COOKIE = "brisa_session";

export interface SessionUser {
  email: string; // login key (from X-Forwarded-Email / tb_usuarios)
  nome: string; // from tb_usuarios
  cpf: string | null; // join key to other tables (not used for login)
  matricula: string | null; // tb_usuarios.matricula — keys the vendedor screen to self
  nivelId: number; // tb_usuarios.nivel_id
  nivel: string; // tb_niveis.nome
  isAdmin: boolean; // derived: nivel === "admin"
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

function getTtlSeconds(): number {
  const raw = process.env.JWT_TTL_SECONDS;
  const parsed = raw ? parseInt(raw, 10) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8 * 60 * 60; // 8h
}

/** Sign the session JWT from the user data. */
export async function signSession(user: SessionUser): Promise<string> {
  const ttl = getTtlSeconds();

  return new SignJWT({ ...user } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(getSecret());
}

/**
 * Verify the JWT and return the user, or null if invalid/expired.
 * Uses only Edge-runtime-compatible APIs (jose) so it can run inside the
 * middleware.
 */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });

    if (
      typeof payload.email === "string" &&
      typeof payload.nome === "string" &&
      (typeof payload.cpf === "string" || payload.cpf === null) &&
      typeof payload.nivelId === "number" &&
      typeof payload.nivel === "string" &&
      typeof payload.isAdmin === "boolean"
    ) {
      // `matricula` is lenient so cookies minted before it existed still verify
      // (→ null until re-minted).
      return {
        email: payload.email,
        nome: payload.nome,
        cpf: (payload.cpf as string | null) ?? null,
        matricula: typeof payload.matricula === "string" ? payload.matricula : null,
        nivelId: payload.nivelId,
        nivel: payload.nivel,
        isAdmin: payload.isAdmin,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function getSessionTtlSeconds(): number {
  return getTtlSeconds();
}
