"use server";

import { z } from "zod";
import { normalizeDuelCode } from "@/game/duel/code";
import { evaluateGuess } from "@/game/evaluate";
import { lonLatSchema } from "@/game/submission";
import { drawTargetIds, duelRpcError, hasPseudo, loadDuelRef, loadDuelView } from "@/lib/duel/server";
import type { DuelResult, DuelView } from "@/lib/duel/types";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import { getMode } from "@/modes/registry";

const codeSchema = z.string().max(16).transform((value, ctx) => normalizeDuelCode(value) ?? (ctx.addIssue("bad code"), z.NEVER));

const lockSchema = z.strictObject({
  code: codeSchema,
  roundIndex: z.number().int().min(0).max(199),
  guess: lonLatSchema,
});

async function currentUserId(): Promise<string | null> {
  const { data } = await (await serverSupabase()).auth.getUser();
  return data.user?.id ?? null;
}

/** Opens a lobby on `modeId` for the current player, who must have a pseudo. */
export async function createDuel(modeId: unknown): Promise<DuelResult<{ code: string }>> {
  const mode = typeof modeId === "string" ? getMode(modeId) : undefined;
  if (!mode) return { ok: false, error: "invalid" };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };
    if (!(await hasPseudo(userId))) return { ok: false, error: "pseudo_required" };

    const { data, error } = await adminSupabase().rpc("create_duel", {
      p_host: userId,
      p_mode: mode.id,
      p_targets: await drawTargetIds(mode),
    });
    if (error) throw error;
    return { ok: true, code: data };
  } catch (error: unknown) {
    console.error("[createDuel] failed", { mode: mode.id, error });
    return { ok: false, error: "unavailable" };
  }
}

/** Seats the current player in the lobby `code`, which starts the duel. */
export async function joinDuel(code: unknown): Promise<DuelResult<object>> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "not_found" };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };
    if (!(await hasPseudo(userId))) return { ok: false, error: "pseudo_required" };

    const { error } = await adminSupabase().rpc("join_duel", { p_code: parsed.data, p_user: userId });
    const known = duelRpcError(error);
    if (known) return { ok: false, error: known };
    if (error) throw error;
    return { ok: true };
  } catch (error: unknown) {
    console.error("[joinDuel] failed", { code: parsed.data, error });
    return { ok: false, error: "unavailable" };
  }
}

/** The duel as the current player may see it. Also settles rounds whose time ran out. */
export async function getDuel(code: unknown): Promise<DuelResult<{ view: DuelView }>> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "not_found" };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };

    const view = await loadDuelView(parsed.data, userId);
    if (!view || view.status === "cancelled") return { ok: false, error: "not_found" };
    if (!view.isParticipant && view.status !== "lobby") return { ok: false, error: "full" };
    return { ok: true, view };
  } catch (error: unknown) {
    console.error("[getDuel] failed", { code: parsed.data, error });
    return { ok: false, error: "unavailable" };
  }
}

/** Locks the current player's guess for a round; the server scores it. */
export async function lockDuelGuess(input: unknown): Promise<DuelResult<object>> {
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { code, roundIndex, guess } = parsed.data;
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };

    const duel = await loadDuelRef(code);
    const mode = duel ? getMode(duel.modeId) : undefined;
    const targetId = duel?.targetIds[roundIndex];
    if (!duel || !mode || !targetId) return { ok: false, error: "not_found" };
    const target = (await mode.loadTargets()).find((t) => t.id === targetId);
    if (!target) throw new Error(`Duel target "${targetId}" is not in mode "${mode.id}"`);

    const result = evaluateGuess(target, guess, mode.scaleKm);
    const { error } = await adminSupabase().rpc("duel_lock", {
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
      console.warn("[lockDuelGuess] rejected", { code, roundIndex, reason: error?.message });
      return { ok: false, error: known };
    }
    if (error) throw error;
    return { ok: true };
  } catch (error: unknown) {
    console.error("[lockDuelGuess] failed", { code, error });
    return { ok: false, error: "unavailable" };
  }
}

/** Opens (or returns) the rematch lobby of a finished duel. */
export async function requestRematch(code: unknown): Promise<DuelResult<{ code: string }>> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "not_found" };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };

    const duel = await loadDuelRef(parsed.data);
    const mode = duel ? getMode(duel.modeId) : undefined;
    if (!duel || !mode) return { ok: false, error: "not_found" };

    const { data, error } = await adminSupabase().rpc("duel_rematch", {
      p_duel: duel.id,
      p_user: userId,
      p_targets: await drawTargetIds(mode),
    });
    const known = duelRpcError(error);
    if (known) return { ok: false, error: known };
    if (error) throw error;
    return { ok: true, code: data };
  } catch (error: unknown) {
    console.error("[requestRematch] failed", { code: parsed.data, error });
    return { ok: false, error: "unavailable" };
  }
}
