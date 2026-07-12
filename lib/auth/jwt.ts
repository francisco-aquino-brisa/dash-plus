import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Stateless internal session. After a successful SSO login, we issue a signed
 * JWT (HS256) holding the minimal user data and store it in an httpOnly cookie.
 * There is no database: the cookie is the single source of the session.
 *
 * Lifted from the sibling `dashboard` project (see ADR 0003).
 */

export const SESSION_COOKIE = "brisa_session";

export interface SessionUser {
  id: number; // from SSO
  picture: string; // from SSO
  username: string; // from SSO (CPF)
  name: string; // from SSO
  email: string; // from cadastro_usuario
  permissao: string; // from cadastro_usuario
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
      typeof payload.id === "number" &&
      typeof payload.picture === "string" &&
      typeof payload.username === "string" &&
      typeof payload.name === "string" &&
      typeof payload.email === "string" &&
      typeof payload.permissao === "string"
    ) {
      return {
        id: payload.id,
        picture: payload.picture,
        username: payload.username,
        name: payload.name,
        email: payload.email,
        permissao: payload.permissao,
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
