import "server-only";
import { z } from "zod";
import { normalizeDuelCode } from "@/game/duel/code";
import { lonLatSchema } from "@/game/submission";
import { isSameOrigin } from "@/lib/http/sameOrigin";
import { serverSupabase } from "@/lib/supabase/server";
import type { DuelError, DuelResult } from "./types";

const STATUS: Readonly<Record<DuelError, number>> = {
  invalid: 400,
  unauthenticated: 401,
  pseudo_required: 403,
  not_found: 404,
  full: 409,
  expired: 410,
  started: 409,
  too_many_players: 409,
  not_enough_players: 409,
  too_late: 409,
  already_locked: 409,
  unavailable: 503,
};

/** A duel result as JSON, never cached: it changes every second. */
export function duelResponse<T>(result: DuelResult<T>): Response {
  return Response.json(result, { status: result.ok ? 200 : STATUS[result.error], headers: { "Cache-Control": "no-store" } });
}

export const answerSchema = z.strictObject({
  roundIndex: z.number().int().min(0).max(199),
  guess: lonLatSchema,
});

export type Answer = z.infer<typeof answerSchema>;

export async function currentUserId(): Promise<string | null> {
  const { data } = await (await serverSupabase()).auth.getUser();
  return data.user?.id ?? null;
}

interface DuelRequest<B> {
  code: string;
  userId: string;
  body: B;
}

/**
 * Checks what every duel endpoint needs: a well-formed code, a signed-in player, and for writes a
 * same-origin request with a valid body. Returns a response to send instead when one is missing.
 */
export async function duelRequest<B>(
  request: Request,
  rawCode: string,
  bodySchema?: z.ZodType<B>,
): Promise<DuelRequest<B> | Response> {
  const code = normalizeDuelCode(rawCode);
  if (!code) return duelResponse({ ok: false, error: "not_found" });
  if (bodySchema && !isSameOrigin(request.headers)) return Response.json({ ok: false, error: "invalid" }, { status: 403 });

  let body: unknown = undefined;
  if (bodySchema) {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return duelResponse({ ok: false, error: "invalid" });
    body = parsed.data;
  }
  const userId = await currentUserId();
  if (!userId) return duelResponse({ ok: false, error: "unauthenticated" });
  return { code, userId, body: body as B };
}
