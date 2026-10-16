import { readDuel } from "@/lib/duel/answers";
import { duelRequest, duelResponse } from "@/lib/duel/http";

/**
 * The duel as the current player may see it. A Route Handler rather than a Server Action: the
 * client polls it, and Server Actions run one at a time, so a slow poll would hold up a lock.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/duel/[code]">) {
  const req = await duelRequest(request, (await ctx.params).code);
  if (req instanceof Response) return req;
  try {
    return duelResponse(await readDuel(req.code, req.userId));
  } catch (error: unknown) {
    console.error("[duel] read failed", { code: req.code, error });
    return duelResponse({ ok: false, error: "unavailable" });
  }
}
