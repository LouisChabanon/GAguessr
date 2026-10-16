import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** A game must be submitted within this long of its start. */
export const GAME_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const payloadSchema = z.strictObject({ modeId: z.string().min(1), startedAt: z.number().int().nonnegative() });

export type GameStartCheck = { ok: true; startedAt: number } | { ok: false };

function secret(): string {
  const value = process.env.GAME_TOKEN_SECRET;
  if (!value) throw new Error("GAME_TOKEN_SECRET is not set");
  return value;
}

function sign(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

/** A signed note of when the server saw a game of `modeId` start. */
export function signGameStart(modeId: string, now: number): string {
  const payload = Buffer.from(JSON.stringify({ modeId, startedAt: now })).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

/** Checks a start token's signature, mode and age; returns when the game started. */
export function verifyGameStart(token: string, modeId: string, now: number): GameStartCheck {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payload, signature] = parts;

  const expected = sign(payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false };

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.modeId !== modeId) return { ok: false };

  const age = now - parsed.data.startedAt;
  if (age < 0 || age > GAME_TOKEN_TTL_MS) return { ok: false };
  return { ok: true, startedAt: parsed.data.startedAt };
}
