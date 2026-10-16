import { describe, expect, it } from "vitest";
import type { Target } from "@/modes/types";
import { MAX_ROUND_SCORE, scoreFor } from "@/lib/geo/scoring";
import { distanceKm } from "@/lib/geo/distance";
import { CLOCK_TOLERANCE_MS, MIN_MS_PER_ROUND, parseSubmission, validateSubmission, type Submission } from "./submission";

const TARGETS: Target[] = [
  { id: "a", name: "A", coords: [2, 48] },
  { id: "b", name: "B", coords: [5, 45] },
  { id: "c", name: "C", coords: [-1, 47] },
];

const allRounds = { scaleKm: 100, roundsPerGame: "all" as const };
/** The server saw the game start 30 s before the submission arrived. */
const CLOCK = { startedAt: 0, now: 30_000 };

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    modeId: "m",
    timeMs: 20_000,
    startToken: "token",
    rounds: [
      { targetId: "a", guess: [2.1, 48] },
      { targetId: "b", guess: [5, 45] },
      { targetId: "c", guess: [0, 47] },
    ],
    ...overrides,
  };
}

describe("parseSubmission", () => {
  it("accepts a well-formed payload", () => {
    expect(parseSubmission(submission())).toEqual({ success: true, data: submission() });
  });

  it.each([
    ["a missing mode", { ...submission(), modeId: "" }],
    ["out-of-range coordinates", submission({ rounds: [{ targetId: "a", guess: [200, 0] }] })],
    ["non-finite time", { ...submission(), timeMs: Number.NaN }],
    ["no rounds", submission({ rounds: [] })],
    ["a missing start token", { ...submission(), startToken: "" }],
    ["a forged score field", { ...submission(), total: 99_999 }],
  ])("rejects %s", (_, payload) => {
    expect(parseSubmission(payload).success).toBe(false);
  });
});

describe("validateSubmission", () => {
  it("recomputes every score from the guesses, ignoring nothing but the coordinates", () => {
    const result = validateSubmission(allRounds, TARGETS, submission(), CLOCK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = submission().rounds.map((r, i) => scoreFor(distanceKm(r.guess, TARGETS[i].coords), 100));
    expect(result.game.rounds.map((r) => r.score)).toEqual(expected);
    expect(result.game.totalScore).toBe(expected.reduce((a, b) => a + b, 0));
    expect(result.game.maxScore).toBe(3 * MAX_ROUND_SCORE);
    expect(result.game.rounds[1]).toMatchObject({ targetId: "b", roundIndex: 1, distanceKm: 0, score: MAX_ROUND_SCORE });
  });

  it("rejects a site that is not in the mode", () => {
    const rounds = [...submission().rounds.slice(0, 2), { targetId: "zz", guess: [0, 0] as const }];
    expect(validateSubmission(allRounds, TARGETS, submission({ rounds }), CLOCK)).toEqual({ ok: false, reason: "unknown_target" });
  });

  it("rejects a site played twice", () => {
    const rounds = [...submission().rounds.slice(0, 2), { targetId: "a", guess: [0, 0] as const }];
    expect(validateSubmission(allRounds, TARGETS, submission({ rounds }), CLOCK)).toEqual({ ok: false, reason: "duplicate_target" });
  });

  it("rejects a game with the wrong number of rounds", () => {
    const short = submission({ rounds: submission().rounds.slice(0, 2) });
    expect(validateSubmission(allRounds, TARGETS, short, CLOCK)).toEqual({ ok: false, reason: "round_count" });
    const capped = { scaleKm: 100, roundsPerGame: 2 };
    expect(validateSubmission(capped, TARGETS, submission(), CLOCK).ok).toBe(false);
    expect(validateSubmission(capped, TARGETS, short, CLOCK).ok).toBe(true);
  });

  it("rejects a game faster than the per-round floor", () => {
    const floor = 3 * MIN_MS_PER_ROUND;
    expect(MIN_MS_PER_ROUND).toBe(1_500);
    expect(validateSubmission(allRounds, TARGETS, submission({ timeMs: floor - 1 }), CLOCK)).toEqual({ ok: false, reason: "too_fast" });
    expect(validateSubmission(allRounds, TARGETS, submission({ timeMs: floor }), CLOCK).ok).toBe(true);
  });

  it("rejects a reported time longer than the server saw the game last", () => {
    const tooLong = submission({ timeMs: CLOCK.now - CLOCK.startedAt + CLOCK_TOLERANCE_MS + 1 });
    expect(validateSubmission(allRounds, TARGETS, tooLong, CLOCK)).toEqual({ ok: false, reason: "clock_mismatch" });
    const withinTolerance = submission({ timeMs: CLOCK.now - CLOCK.startedAt + CLOCK_TOLERANCE_MS });
    expect(validateSubmission(allRounds, TARGETS, withinTolerance, CLOCK).ok).toBe(true);
  });
});
