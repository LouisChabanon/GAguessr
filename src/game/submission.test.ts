import { describe, expect, it } from "vitest";
import type { Target } from "@/modes/types";
import { MAX_ROUND_SCORE, scoreFor } from "@/lib/geo/scoring";
import { distanceKm } from "@/lib/geo/distance";
import { parseSubmission, validateSubmission, type Submission } from "./submission";

const TARGETS: Target[] = [
  { id: "a", name: "A", coords: [2, 48] },
  { id: "b", name: "B", coords: [5, 45] },
  { id: "c", name: "C", coords: [-1, 47] },
];

const allRounds = { scaleKm: 100, roundsPerGame: "all" as const };

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    modeId: "m",
    timeMs: 20_000,
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
    ["a forged score field", { ...submission(), total: 99_999 }],
  ])("rejects %s", (_, payload) => {
    expect(parseSubmission(payload).success).toBe(false);
  });
});

describe("validateSubmission", () => {
  it("recomputes every score from the guesses, ignoring nothing but the coordinates", () => {
    const result = validateSubmission(allRounds, TARGETS, submission());
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
    expect(validateSubmission(allRounds, TARGETS, submission({ rounds }))).toEqual({ ok: false, reason: "unknown_target" });
  });

  it("rejects a site played twice", () => {
    const rounds = [...submission().rounds.slice(0, 2), { targetId: "a", guess: [0, 0] as const }];
    expect(validateSubmission(allRounds, TARGETS, submission({ rounds }))).toEqual({ ok: false, reason: "duplicate_target" });
  });

  it("rejects a game with the wrong number of rounds", () => {
    const short = submission({ rounds: submission().rounds.slice(0, 2) });
    expect(validateSubmission(allRounds, TARGETS, short)).toEqual({ ok: false, reason: "round_count" });
    const capped = { scaleKm: 100, roundsPerGame: 2 };
    expect(validateSubmission(capped, TARGETS, submission()).ok).toBe(false);
    expect(validateSubmission(capped, TARGETS, short).ok).toBe(true);
  });

  it("rejects an implausibly fast game", () => {
    expect(validateSubmission(allRounds, TARGETS, submission({ timeMs: 1_000 }))).toEqual({ ok: false, reason: "too_fast" });
  });
});
