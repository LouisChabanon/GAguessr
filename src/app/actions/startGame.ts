"use server";

import { signGameStart } from "@/game/gameToken";
import { getMode } from "@/modes/registry";

/** Notes, in a signed token the client hands back with its submission, when a game started. */
export async function startGame(modeId: unknown): Promise<string | null> {
  if (typeof modeId !== "string" || !getMode(modeId)) return null;
  try {
    return signGameStart(modeId, Date.now());
  } catch (error: unknown) {
    console.error("[startGame] failed", error);
    return null;
  }
}
