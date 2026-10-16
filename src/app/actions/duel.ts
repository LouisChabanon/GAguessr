"use server";

import { z } from "zod";
import { normalizeDuelCode } from "@/game/duel/code";
import { duelSettingsSchema, type DuelSettings } from "@/game/duel/settings";
import { evaluateGuess } from "@/game/evaluate";
import { lonLatSchema } from "@/game/submission";
import { drawTargetIds, duelRpcError, hasPseudo, loadDuelRef, loadDuelView } from "@/lib/duel/server";
import type { DuelResult, DuelView } from "@/lib/duel/types";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import { getMode } from "@/modes/registry";
import type { GameMode } from "@/modes/types";

const codeSchema = z.string().max(16).transform((value, ctx) => normalizeDuelCode(value) ?? (ctx.addIssue("bad code"), z.NEVER));

const lockSchema = z.strictObject({
  code: codeSchema,
  roundIndex: z.number().int().min(0).max(199),
  guess: lonLatSchema,
});

/** Settings checked against the mode's pool, so the round count can always be drawn. */
async function parseSettings(mode: GameMode, input: unknown): Promise<DuelSettings | null> {
  const parsed = duelSettingsSchema((await mode.loadTargets()).length).safeParse(input);
  return parsed.success ? parsed.data : null;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await (await serverSupabase()).auth.getUser();
  return data.user?.id ?? null;
}

const createSchema = z.strictObject({ modeId: z.string().max(64), settings: z.unknown() });
const configureSchema = z.strictObject({ code: codeSchema, settings: z.unknown() });

/** Opens a lobby on a mode for the current player, who must have a pseudo, with their settings. */
export async function createDuel(input: unknown): Promise<DuelResult<{ code: string }>> {
  const parsed = createSchema.safeParse(input);
  const mode = parsed.success ? getMode(parsed.data.modeId) : undefined;
  if (!parsed.success || !mode) return { ok: false, error: "invalid" };
  try {
    const settings = await parseSettings(mode, parsed.data.settings);
    if (!settings) return { ok: false, error: "invalid" };
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };
    if (!(await hasPseudo(userId))) return { ok: false, error: "pseudo_required" };

    const { data, error } = await adminSupabase().rpc("create_duel", {
      p_host: userId,
      p_mode: mode.id,
      p_targets: await drawTargetIds(mode, settings.rounds),
      p_round_s: settings.roundSeconds,
      p_grace_s: settings.graceSeconds,
      p_max_players: settings.maxPlayers,
    });
    if (error) throw error;
    return { ok: true, code: data };
  } catch (error: unknown) {
    console.error("[createDuel] failed", { mode: mode.id, error });
    return { ok: false, error: "unavailable" };
  }
}

/** Changes the settings of the current player's lobby, until the game starts. */
export async function configureDuel(input: unknown): Promise<DuelResult<object>> {
  const parsed = configureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { code } = parsed.data;
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };

    const duel = await loadDuelRef(code);
    const mode = duel ? getMode(duel.modeId) : undefined;
    if (!duel || !mode) return { ok: false, error: "not_found" };
    const settings = await parseSettings(mode, parsed.data.settings);
    if (!settings) return { ok: false, error: "invalid" };

    const { error } = await adminSupabase().rpc("configure_duel", {
      p_duel: duel.id,
      p_user: userId,
      p_targets: await drawTargetIds(mode, settings.rounds),
      p_round_s: settings.roundSeconds,
      p_grace_s: settings.graceSeconds,
      p_max_players: settings.maxPlayers,
    });
    const known = duelRpcError(error);
    if (known) return { ok: false, error: known };
    if (error) throw error;
    return { ok: true };
  } catch (error: unknown) {
    console.error("[configureDuel] failed", { code, error });
    return { ok: false, error: "unavailable" };
  }
}

type LobbyRpc = "start_duel" | "leave_duel";

/** Runs a host or player action on the lobby `code` as the current player. */
async function lobbyAction(rpc: LobbyRpc, code: unknown): Promise<DuelResult<object>> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "not_found" };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "unauthenticated" };
    const duel = await loadDuelRef(parsed.data);
    if (!duel) return { ok: false, error: "not_found" };

    const { error } = await adminSupabase().rpc(rpc, { p_duel: duel.id, p_user: userId });
    const known = duelRpcError(error);
    if (known) return { ok: false, error: known };
    if (error) throw error;
    return { ok: true };
  } catch (error: unknown) {
    console.error(`[${rpc}] failed`, { code: parsed.data, error });
    return { ok: false, error: "unavailable" };
  }
}

/** The host starts the lobby `code` before it is full; it needs two players. */
export async function startDuel(code: unknown): Promise<DuelResult<object>> {
  return lobbyAction("start_duel", code);
}

/** Leaves the lobby `code`: a player frees their seat, the host cancels it for everyone. */
export async function leaveDuel(code: unknown): Promise<DuelResult<object>> {
  return lobbyAction("leave_duel", code);
}

/** Seats the current player in the lobby `code`; the game starts once it is full. */
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
    if (!view.isParticipant && view.status !== "lobby") return { ok: false, error: "started" };
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

/** Opens (or returns) the rematch lobby of a finished duel: same mode, round count and timings, new sites. */
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
      p_targets: await drawTargetIds(mode, duel.targetIds.length),
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
