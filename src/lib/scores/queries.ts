import "server-only";
import type { LonLat } from "@/lib/geo/distance";
import { cacheLife, cacheTag } from "next/cache";
import { publicSupabase } from "@/lib/supabase/public";
import { getMode } from "@/modes/registry";
import { PROFILES_TAG, scoresTag, statsTag } from "./tags";
import type { CrowdData, LeaderboardPeriod, LeaderboardRow } from "./types";

/** Guesses per site kept for heatmaps. */
const HEATMAP_GUESSES_PER_TARGET = 300;
const LEADERBOARD_SIZE = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ModeOverview {
  games: number;
  players: number;
  /** Average share of the maximum score, 0–1, or null before the first game. */
  avgShare: number | null;
}

/**
 * Shared data is a bonus, never a requirement: when Supabase is down or not configured
 * (local builds, previews), pages render empty states instead of failing.
 */
async function orEmpty<T>(label: string, empty: T, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error: unknown) {
    console.error(`[scores] ${label} unavailable`, error instanceof Error ? error.message : error);
    return empty;
  }
}

export async function getCrowdData(modeId: string): Promise<CrowdData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(statsTag(modeId));
  const withinKm = getMode(modeId)?.scaleKm ?? 0;
  return orEmpty("crowd data", { withinKm, stats: {}, guesses: {} }, async () => {
    const db = publicSupabase();
    const [stats, sample] = await Promise.all([
      db.rpc("target_stats", { p_mode: modeId, p_within_km: withinKm }),
      db.rpc("mode_guess_sample", { p_mode: modeId, p_per_target: HEATMAP_GUESSES_PER_TARGET }),
    ]);
    if (stats.error) throw stats.error;
    if (sample.error) throw sample.error;

    const guesses: Record<string, LonLat[]> = {};
    for (const { target_id, lon, lat } of sample.data) (guesses[target_id] ??= []).push([lon, lat]);
    return {
      withinKm,
      stats: Object.fromEntries(
        stats.data.map((s) => [s.target_id, { plays: s.plays, avgScore: s.avg_score, medianKm: s.median_km, withinShare: s.within_share }]),
      ),
      guesses,
    };
  });
}

export async function getLeaderboard(modeId: string, period: LeaderboardPeriod): Promise<readonly LeaderboardRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(scoresTag(modeId), PROFILES_TAG);
  return orEmpty("leaderboard", [], async () => {
    const since = period === "week" ? new Date(Date.now() - WEEK_MS).toISOString() : undefined;
    const { data, error } = await publicSupabase().rpc("leaderboard", { p_mode: modeId, p_since: since, p_limit: LEADERBOARD_SIZE });
    if (error) throw error;
    return data.map((r) => ({
      rank: r.rank,
      pseudo: r.pseudo,
      totalScore: r.total_score,
      maxScore: r.max_score,
      timeMs: r.time_ms,
      playedAt: r.played_at,
    }));
  });
}

export async function getModeOverview(modeId: string): Promise<ModeOverview> {
  "use cache";
  cacheLife("minutes");
  cacheTag(statsTag(modeId));
  return orEmpty("overview", { games: 0, players: 0, avgShare: null }, async () => {
    const { data, error } = await publicSupabase().rpc("mode_overview", { p_mode: modeId }).single();
    if (error) throw error;
    const avgShare = data.avg_score !== null && data.avg_max_score ? data.avg_score / data.avg_max_score : null;
    return { games: data.games, players: data.players, avgShare };
  });
}
