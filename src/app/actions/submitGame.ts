"use server";

import { updateTag } from "next/cache";
import { verifyGameStart } from "@/game/gameToken";
import { parseSubmission, validateSubmission, type ValidatedGame } from "@/game/submission";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import { scoresTag, statsTag } from "@/lib/scores/tags";
import type { GameStanding, SubmitResult } from "@/lib/scores/types";
import { getMode } from "@/modes/registry";

/** One finished game per player and mode in this window; replays faster than that are not stored. */
const MIN_GAME_INTERVAL = "10 seconds";
const TOO_SOON = "too_soon";

function insertPayload(userId: string, modeId: string, game: ValidatedGame) {
  return {
    user_id: userId,
    mode_id: modeId,
    total_score: game.totalScore,
    max_score: game.maxScore,
    time_ms: game.timeMs,
    guesses: game.rounds.map((r) => ({
      target_id: r.targetId,
      round_index: r.roundIndex,
      lon: r.guess[0],
      lat: r.guess[1],
      distance_km: r.distanceKm,
      score: r.score,
    })),
  };
}

async function standingOf(gameId: string, userId: string): Promise<GameStanding> {
  const admin = adminSupabase();
  const [standing, profile] = await Promise.all([
    admin.rpc("game_standing", { p_game: gameId }).single(),
    admin.from("profiles").select("pseudo").eq("id", userId).maybeSingle(),
  ]);
  if (standing.error) throw standing.error;
  if (profile.error) throw profile.error;
  const { ranking_score: rankingScore, ...rest } = standing.data;
  return { ...rest, rankingScore, pseudo: profile.data?.pseudo ?? null };
}

/**
 * Records a finished game. The client sends only its guesses: the server checks them against
 * the mode and recomputes every score, so a forged total cannot reach the leaderboard.
 */
export async function submitGame(input: unknown): Promise<SubmitResult> {
  const parsed = parseSubmission(input);
  const mode = parsed.success ? getMode(parsed.data.modeId) : undefined;
  if (!parsed.success || !mode) return { ok: false, error: "invalid" };

  try {
    const { data: auth } = await (await serverSupabase()).auth.getUser();
    if (!auth.user) return { ok: false, error: "unauthenticated" };

    const now = Date.now();
    const start = verifyGameStart(parsed.data.startToken, mode.id, now);
    if (!start.ok) {
      console.warn("[submitGame] rejected", { mode: mode.id, reason: "bad_token" });
      return { ok: false, error: "invalid" };
    }

    const validation = validateSubmission(mode, await mode.loadTargets(), parsed.data, { startedAt: start.startedAt, now });
    if (!validation.ok) {
      console.warn("[submitGame] rejected", { mode: mode.id, reason: validation.reason });
      return { ok: false, error: "invalid" };
    }

    const { data: gameId, error } = await adminSupabase().rpc("insert_game", {
      p: insertPayload(auth.user.id, mode.id, validation.game),
      p_min_interval: MIN_GAME_INTERVAL,
    });
    if (error?.message === TOO_SOON) return { ok: false, error: "too_soon" };
    if (error) throw error;

    updateTag(scoresTag(mode.id));
    updateTag(statsTag(mode.id));
    return { ok: true, standing: await standingOf(gameId, auth.user.id) };
  } catch (error: unknown) {
    console.error("[submitGame] failed", { mode: mode.id, error });
    return { ok: false, error: "unavailable" };
  }
}
