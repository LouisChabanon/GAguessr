import { submitAnswer } from "@/lib/duel/answers";
import { answerSchema, duelRequest, duelResponse } from "@/lib/duel/http";

/** Saves the pin the current player is pointing at, which counts if their lock never arrives in time. */
export async function POST(request: Request, ctx: RouteContext<"/api/duel/[code]/pin">) {
  const req = await duelRequest(request, (await ctx.params).code, answerSchema);
  if (req instanceof Response) return req;
  try {
    return duelResponse(await submitAnswer("pin", req.code, req.userId, req.body.roundIndex, req.body.guess));
  } catch (error: unknown) {
    console.error("[duel] pin failed", { code: req.code, error });
    return duelResponse({ ok: false, error: "unavailable" });
  }
}
