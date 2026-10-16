import type { LonLat } from "@/lib/geo/distance";
import type { DuelResult, DuelView } from "./types";

/** Past this, a request is given up on: the next poll or retry will do better than waiting. */
const REQUEST_TIMEOUT_MS = 8_000;

/** What the client got when the request never produced an answer (offline, timeout, server down). */
const UNREACHABLE = { ok: false, error: "unavailable" } as const;

async function call<T>(url: string, init: RequestInit = {}): Promise<DuelResult<T>> {
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const isJson = response.headers.get("content-type")?.includes("application/json");
    return isJson ? ((await response.json()) as DuelResult<T>) : UNREACHABLE;
  } catch {
    return UNREACHABLE;
  }
}

/** Whether a result says nothing about the duel, only about the network: worth another try. */
export function isUnreachable(result: DuelResult<unknown>): boolean {
  return !result.ok && result.error === "unavailable";
}

export function fetchDuel(code: string): Promise<DuelResult<{ view: DuelView }>> {
  return call(`/api/duel/${code}`);
}

/** Sends a lock, or a pin (where the player is pointing, in case the lock never arrives). */
export function postAnswer(kind: "lock" | "pin", code: string, roundIndex: number, guess: LonLat): Promise<DuelResult<object>> {
  return call(`/api/duel/${code}/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundIndex, guess }),
  });
}
