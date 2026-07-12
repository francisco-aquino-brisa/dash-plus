import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./jwt";

/**
 * Read the current session inside a Server Component / Route Handler.
 * Returns null when there is no valid session.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;

  return verifySession(token);
}
