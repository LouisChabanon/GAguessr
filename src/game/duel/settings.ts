import { z } from "zod";
import { roundCount } from "@/game/pickTargets";
import type { GameModeMeta } from "@/modes/types";

/** What the host of a duel chooses. Mirrors the checks on duels.round_s, grace_s and max_players. */
export interface DuelSettings {
  /** Room size; the game starts on its own once it is full. */
  maxPlayers: number;
  rounds: number;
  /** Longest a round lasts. */
  roundSeconds: number;
  /** Once one player locks, the other has at most this long left. */
  graceSeconds: number;
}

export const DUEL_ROUND_SECONDS = { min: 10, max: 300, default: 45 } as const;
export const DUEL_GRACE_SECONDS = { min: 1, max: 60, default: 5 } as const;
export const DUEL_PLAYERS = { min: 2, max: 8, default: 2 } as const;
/** The duels table holds at most this many targets. */
export const DUEL_MAX_ROUNDS = 200;

/** Choices offered in the settings form; the schema accepts any value within bounds. */
export const PLAYER_PRESETS = [2, 3, 4, 6, 8] as const;
export const ROUND_COUNT_PRESETS = [3, 5, 10, 20] as const;
export const ROUND_SECONDS_PRESETS = [15, 30, 45, 60, 90, 120] as const;
export const GRACE_SECONDS_PRESETS = [3, 5, 10, 15] as const;

/** A solo game's round count, and the default timings. */
export function defaultDuelSettings(mode: Pick<GameModeMeta, "roundsPerGame">, available: number): DuelSettings {
  return {
    maxPlayers: DUEL_PLAYERS.default,
    rounds: Math.min(roundCount(mode.roundsPerGame, available), DUEL_MAX_ROUNDS),
    roundSeconds: DUEL_ROUND_SECONDS.default,
    graceSeconds: DUEL_GRACE_SECONDS.default,
  };
}

/** Validates settings sent by a client; `available` is the size of the mode's target pool. */
export function duelSettingsSchema(available: number) {
  return z
    .strictObject({
      maxPlayers: z.number().int().min(DUEL_PLAYERS.min).max(DUEL_PLAYERS.max),
      rounds: z.number().int().min(1).max(Math.min(available, DUEL_MAX_ROUNDS)),
      roundSeconds: z.number().int().min(DUEL_ROUND_SECONDS.min).max(DUEL_ROUND_SECONDS.max),
      graceSeconds: z.number().int().min(DUEL_GRACE_SECONDS.min).max(DUEL_GRACE_SECONDS.max),
    })
    .refine((s) => s.graceSeconds <= s.roundSeconds, { message: "grace longer than the round", path: ["graceSeconds"] });
}

/** Round counts to offer for a pool of `available` targets: the presets that fit, then all of them. */
export function roundCountChoices(available: number): number[] {
  const all = Math.min(available, DUEL_MAX_ROUNDS);
  return [...ROUND_COUNT_PRESETS.filter((n) => n < all), all];
}

/** Changing the round time keeps the grace no longer than the round. */
export function withRoundSeconds(settings: DuelSettings, roundSeconds: number): DuelSettings {
  return { ...settings, roundSeconds, graceSeconds: Math.min(settings.graceSeconds, roundSeconds) };
}
