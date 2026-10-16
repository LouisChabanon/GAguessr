import "server-only";
import { DUEL_TOLERANCE_MS } from "@/game/duel/rules";
import { pickTargets, roundCount } from "@/game/pickTargets";
import { adminSupabase } from "@/lib/supabase/admin";
import type { GameMode } from "@/modes/types";
import type { DuelError, DuelView } from "./types";
import { buildDuelView } from "./view";

/** What each exception raised by the duel functions means for the player. */
const RPC_ERRORS: Readonly<Record<string, DuelError>> = {
  not_found: "not_found",
  not_participant: "not_found",
  full: "full",
  expired: "expired",
  not_playing: "too_late",
  wrong_round: "too_late",
  not_started: "too_late",
  already_locked: "too_late",
  not_finished: "too_late",
};

/** The player-facing error for a failed duel RPC, or null when it is unexpected and must be thrown. */
export function duelRpcError(error: { message: string } | null): DuelError | null {
  return error ? (RPC_ERRORS[error.message] ?? null) : null;
}

/** The targets of a new duel: as many as a solo game of the mode, in random order. */
export async function drawTargetIds(mode: GameMode): Promise<string[]> {
  const targets = await mode.loadTargets();
  return pickTargets(targets, roundCount(mode.roundsPerGame, targets.length)).map((t) => t.id);
}

export async function hasPseudo(userId: string): Promise<boolean> {
  const { data, error } = await adminSupabase().from("profiles").select("pseudo").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function loadDuelRow(code: string) {
  const { data, error } = await adminSupabase().from("duels").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Loads what `userId` may see of the duel `code`, first settling rounds whose time ran out, so
 * looking at a duel is all it takes to move it on. Null when there is no such duel.
 */
export async function loadDuelView(code: string, userId: string): Promise<DuelView | null> {
  const admin = adminSupabase();
  let duel = await loadDuelRow(code);
  if (!duel) return null;

  const deadline = duel.round_deadline === null ? null : Date.parse(duel.round_deadline);
  if (duel.status === "playing" && deadline !== null && Date.now() >= deadline + DUEL_TOLERANCE_MS) {
    const { error } = await admin.rpc("duel_tick", { p_duel: duel.id });
    if (error) throw error;
    duel = (await loadDuelRow(code)) ?? duel;
  }

  // The viewer too: a visitor who already has a pseudo is not asked for one again.
  const people = [...new Set([duel.host_id, duel.guest_id, userId])].filter((id): id is string => id !== null);
  const [guesses, profiles, rematch] = await Promise.all([
    admin.from("duel_guesses").select("round_index, user_id, lon, lat, distance_km, score").eq("duel_id", duel.id),
    admin.from("profiles").select("id, pseudo").in("id", people),
    duel.rematch_id ? admin.from("duels").select("code").eq("id", duel.rematch_id).maybeSingle() : Promise.resolve(null),
  ]);
  if (guesses.error) throw guesses.error;
  if (profiles.error) throw profiles.error;
  if (rematch?.error) throw rematch.error;

  return buildDuelView({
    duel,
    guesses: guesses.data,
    viewerId: userId,
    pseudos: new Map(profiles.data.map((p) => [p.id, p.pseudo])),
    rematchCode: rematch?.data?.code ?? null,
    now: Date.now(),
  });
}

/** The duel's id, mode and targets; null when there is no such duel. */
export async function loadDuelRef(code: string) {
  const duel = await loadDuelRow(code);
  return duel && { id: duel.id, modeId: duel.mode_id, targetIds: duel.target_ids };
}
