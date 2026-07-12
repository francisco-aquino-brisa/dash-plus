// Generic, device-local user-preferences store (localStorage-backed).
//
// Intentionally tiny and framework-agnostic so any screen can persist a small
// bit of UI state (selected indicators, collapsed panels, …) without a server
// round-trip. Keys are namespaced under a single prefix to avoid clashes and to
// make it easy to wipe all app preferences at once.
//
// This module is safe to import on the server: every access guards on
// `typeof window`. For React components prefer the `usePreference` hook, which
// adds hydration-safe reads.

const PREFIX = "brisa-dash:pref:";

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

/** Read a preference, returning `fallback` when unset, unavailable, or corrupt. */
export function readPreference<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Persist a preference. No-op on the server or when storage is unavailable. */
export function writePreference<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    /* quota / private-mode / disabled storage — best-effort */
  }
}

/** Remove a single preference. */
export function clearPreference(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    /* best-effort */
  }
}
