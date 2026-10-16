import { submitAnswer } from "@/lib/duel/answers";
import { answerSchema, duelRequest, duelResponse } from "@/lib/duel/http";

/** Locks the current player's guess for a round; the server scores it. Safe to retry: a lock that already went through answers already_locked. */
export async function POST(request: Request, ctx: RouteContext<"/api/duel/[code]/lock">) {
  const req = await duelRequest(request, (await ctx.params).code, answerSchema);
  if (req instanceof Response) return req;
  try {
    return duelResponse(await submitAnswer("lock", req.code, req.userId, req.body.roundIndex, req.body.guess));
  } catch (error: unknown) {
    console.error("[duel] lock failed", { code: req.code, error });
    return duelResponse({ ok: false, error: "unavailable" });
  }
}
