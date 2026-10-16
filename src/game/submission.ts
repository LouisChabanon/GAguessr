import { z } from "zod";
import type { LonLat } from "@/lib/geo/distance";
import { MAX_ROUND_SCORE } from "@/lib/geo/scoring";
import type { GameModeMeta, Target } from "@/modes/types";
import { evaluateGuess, totalScore } from "./evaluate";
import { roundCount } from "./pickTargets";

/** A human needs at least this long per round to read the target and drop a pin. */
export const MIN_MS_PER_ROUND = 1_500;
/** Slack between the client's stopwatch and the server's view of the game, for request latency. */
export const CLOCK_TOLERANCE_MS = 2_000;
const MAX_ROUNDS = 200;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;

export const lonLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** What the client sends at the end of a game: what it guessed, never what it scored. */
export const submissionSchema = z.strictObject({
  modeId: z.string().min(1).max(64),
  timeMs: z.number().int().min(0).max(MAX_TIME_MS),
  startToken: z.string().min(1).max(512),
  rounds: z
    .array(z.strictObject({ targetId: z.string().min(1).max(128), guess: lonLatSchema }))
    .min(1)
    .max(MAX_ROUNDS),
});

export interface Submission {
  modeId: string;
  timeMs: number;
  /** From startGame: proves when the server saw the game begin. */
  startToken: string;
  rounds: readonly { targetId: string; guess: LonLat }[];
}

/** When the server saw the game start, and when it received the submission (ms). */
export interface ServerClock {
  startedAt: number;
  now: number;
}

export function parseSubmission(input: unknown): z.ZodSafeParseResult<Submission> {
  return submissionSchema.safeParse(input);
}

export interface ValidatedRound {
  targetId: string;
  roundIndex: number;
  guess: LonLat;
  distanceKm: number;
  score: number;
}

export interface ValidatedGame {
  totalScore: number;
  maxScore: number;
  timeMs: number;
  rounds: readonly ValidatedRound[];
}

export type RejectionReason = "unknown_target" | "duplicate_target" | "round_count" | "too_fast" | "clock_mismatch";

export type ValidationResult = { ok: true; game: ValidatedGame } | { ok: false; reason: RejectionReason };

/** Checks a submission against the mode's rules and recomputes every score server-side. */
export function validateSubmission(
  mode: Pick<GameModeMeta, "scaleKm" | "roundsPerGame">,
  targets: readonly Target[],
  submission: Submission,
  clock: ServerClock,
): ValidationResult {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const seen = new Set<string>();
  for (const { targetId } of submission.rounds) {
    if (!byId.has(targetId)) return { ok: false, reason: "unknown_target" };
    if (seen.has(targetId)) return { ok: false, reason: "duplicate_target" };
    seen.add(targetId);
  }
  if (submission.rounds.length !== roundCount(mode.roundsPerGame, targets.length)) {
    return { ok: false, reason: "round_count" };
  }
  if (submission.timeMs < submission.rounds.length * MIN_MS_PER_ROUND) {
    return { ok: false, reason: "too_fast" };
  }
  // Guessing time excludes reveals, so it can never exceed the game's real duration.
  if (submission.timeMs > clock.now - clock.startedAt + CLOCK_TOLERANCE_MS) {
    return { ok: false, reason: "clock_mismatch" };
  }

  const results = submission.rounds.map(({ targetId, guess }) => evaluateGuess(byId.get(targetId)!, guess, mode.scaleKm));
  return {
    ok: true,
    game: {
      totalScore: totalScore(results),
      maxScore: results.length * MAX_ROUND_SCORE,
      timeMs: submission.timeMs,
      rounds: results.map((r, roundIndex) => ({
        targetId: r.target.id,
        roundIndex,
        guess: r.guess,
        distanceKm: r.distanceKm,
        score: r.score,
      })),
    },
  };
}
