import type { LonLat } from "@/lib/geo/distance";

/** Where a submitted game stands, returned to the summary. */
export interface GameStanding {
  /** Share of the mode's games this one beats, 0–1. */
  percentile: number;
  /** All-time leaderboard rank this game earns its player. */
  rank: number;
  games: number;
  /** Precision points plus the speed bonus: what the leaderboard ranks by. */
  rankingScore: number;
  /** The player's pseudo, or null if they have never chosen one. */
  pseudo: string | null;
}

export type SubmitError = "invalid" | "unauthenticated" | "too_soon" | "unavailable";
export type SubmitResult = { ok: true; standing: GameStanding } | { ok: false; error: SubmitError };

export type PseudoError = "invalid" | "taken" | "unauthenticated" | "unavailable";
export type PseudoResult = { ok: true; pseudo: string } | { ok: false; error: PseudoError; message?: string };

export interface TargetStat {
  plays: number;
  avgScore: number;
  medianKm: number;
  /** Share of guesses within the mode's score scale, 0–1. */
  withinShare: number;
}

/** What players collectively did on each site of a mode. */
export interface CrowdData {
  /** The distance `TargetStat.withinShare` counts guesses within. */
  withinKm: number;
  stats: Readonly<Record<string, TargetStat>>;
  guesses: Readonly<Record<string, readonly LonLat[]>>;
}

export interface LeaderboardRow {
  rank: number;
  pseudo: string;
  /** Precision points plus the speed bonus: what the leaderboard ranks by. */
  rankingScore: number;
  totalScore: number;
  maxScore: number;
  timeMs: number;
  playedAt: string;
}
