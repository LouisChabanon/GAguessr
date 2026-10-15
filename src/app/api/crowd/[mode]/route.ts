import { getCrowdData } from "@/lib/scores/queries";
import { GAME_MODES, getMode } from "@/modes/registry";

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode: mode.id }));
}

/** Other players' guesses and per-site stats for a mode, shown with each round's answer. */
export async function GET(_request: Request, ctx: RouteContext<"/api/crowd/[mode]">) {
  const { mode: modeId } = await ctx.params;
  if (!getMode(modeId)) return Response.json({ error: "Unknown mode" }, { status: 404 });
  return Response.json(await getCrowdData(modeId));
}
