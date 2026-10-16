import "server-only";
import { evaluateGuess } from "@/game/evaluate";
import type { LonLat } from "@/lib/geo/distance";
import { adminSupabase } from "@/lib/supabase/admin";
import { getMode } from "@/modes/registry";
import { duelRpcError, loadDuelRef, loadDuelView } from "./server";
import type { DuelResult, DuelView } from "./types";

/** A lock ends the player's round; a pin only records where they are pointing, in case the lock never arrives. */
export type AnswerKind = "lock" | "pin";

const RPC = { lock: "duel_lock", pin: "duel_pin" } as const;

/** The duel `code` as `userId` may see it; settles rounds whose time ran out on the way. */
export async function readDuel(code: string, userId: string): Promise<DuelResult<{ view: DuelView }>> {
  const view = await loadDuelView(code, userId);
  if (!view || view.status === "cancelled") return { ok: false, error: "not_found" };
  if (!view.isParticipant && view.status !== "lobby") return { ok: false, error: "started" };
  return { ok: true, view };
}

/** Scores `guess` for the round on the server and records it as a lock or a pin. */
export async function submitAnswer(kind: AnswerKind, code: string, userId: string, roundIndex: number, guess: LonLat): Promise<DuelResult<object>> {
  const duel = await loadDuelRef(code);
  const mode = duel ? getMode(duel.modeId) : undefined;
  const targetId = duel?.targetIds[roundIndex];
  if (!duel || !mode || !targetId) return { ok: false, error: "not_found" };
  const target = (await mode.loadTargets()).find((t) => t.id === targetId);
  if (!target) throw new Error(`Duel target "${targetId}" is not in mode "${mode.id}"`);

  const result = evaluateGuess(target, guess, mode.scaleKm);
  const { error } = await adminSupabase().rpc(RPC[kind], {
    p_duel: duel.id,
    p_user: userId,
    p_round: roundIndex,
    p_lon: guess[0],
    p_lat: guess[1],
    p_distance_km: result.distanceKm,
    p_score: result.score,
  });
  const known = duelRpcError(error);
  if (known) {
    if (kind === "lock") console.warn("[duel] lock rejected", { code, roundIndex, reason: error?.message });
    return { ok: false, error: known };
  }
  if (error) throw error;
  return { ok: true };
}
