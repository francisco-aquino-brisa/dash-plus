/**
 * Brisanet SSO client. Used ONLY on the server (route handlers), never in the
 * browser — this avoids CORS and keeps the flow under our control.
 *
 * Endpoints:
 *   GET  {SSO_BASE_URL}/auth/steps?login={cpf}
 *   POST {SSO_BASE_URL}/auth/login
 *
 * Lifted from the sibling `dashboard` project (see ADR 0003).
 */

function ssoBaseUrl(): string {
  const base = process.env.SSO_BASE_URL ?? "https://revan.brisanet.net.br/sso/v1";

  return base.replace(/\/+$/, "");
}

export interface SsoSteps {
  name: string;
  picture: string;
  otp: boolean;
  captcha: boolean;
}

export interface SsoLoginResult {
  id: number;
  picture: string;
  username: string;
  name: string;
  /** Extra fields the SSO may return (preserved but unused). */
  [key: string]: unknown;
}

export interface SsoLoginInput {
  username: string; // CPF with punctuation
  password: string;
  otp?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Discovery step: given a CPF (with punctuation), returns name, picture and
 * whether the login will require OTP / captcha.
 */
export async function getSteps(loginCpf: string): Promise<SsoSteps> {
  const url = `${ssoBaseUrl()}/auth/steps?login=${encodeURIComponent(loginCpf)}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new SsoError(`Falha ao consultar steps (${res.status})`, res.status);
  }

  const data = (await res.json()) as Partial<SsoSteps>;

  return {
    name: typeof data.name === "string" ? data.name : "",
    picture: typeof data.picture === "string" ? data.picture : "",
    otp: Boolean(data.otp),
    captcha: Boolean(data.captcha),
  };
}

/**
 * SSO login. On success returns the user data.
 * NEVER log password or otp anywhere.
 */
export async function login(input: SsoLoginInput): Promise<SsoLoginResult> {
  const url = `${ssoBaseUrl()}/auth/login`;

  const body: Record<string, unknown> = {
    username: input.username,
    password: input.password,
  };

  // Only send otp when there is a value.
  if (input.otp) body.otp = input.otp;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let data: Record<string, unknown> = {};

  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // response without JSON body
  }

  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "Credenciais inválidas";
    throw new SsoError(message, res.status);
  }

  if (typeof data.id !== "number" || typeof data.username !== "string" || typeof data.name !== "string") {
    throw new SsoError("Resposta de login inesperada do SSO", 502);
  }

  return {
    ...data,
    id: data.id,
    picture: typeof data.picture === "string" ? data.picture : "",
    username: data.username,
    name: data.name,
  } as SsoLoginResult;
}

export class SsoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SsoError";
    this.status = status;
  }
}
