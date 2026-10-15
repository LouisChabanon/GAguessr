import { describe, expect, it } from "vitest";
import { MAX_ROUND_SCORE } from "@/lib/geo/scoring";
import type { Target } from "@/modes/types";
import { evaluateGuess, totalScore } from "./evaluate";
import { createInitialState, currentResult, currentTarget, elapsedMs, gameReducer, type GameState } from "./gameReducer";
import { pickTargets, roundCount } from "./pickTargets";

const PARIS: Target = { id: "paris", name: "Paris", coords: [2.35, 48.86] };
const LYON: Target = { id: "lyon", name: "Lyon", coords: [4.84, 45.76] };

describe("pickTargets", () => {
  it("picks distinct items without mutating the input", () => {
    const items = [1, 2, 3, 4, 5];
    const picked = pickTargets(items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic with an injected random source", () => {
    expect(pickTargets([1, 2, 3, 4], 4, () => 0)).toEqual([2, 3, 4, 1]);
  });

  it("throws when the pool is too small", () => {
    expect(() => pickTargets([1], 2)).toThrow(/pool of 1/);
  });
});

describe("roundCount", () => {
  it("plays every target for 'all'", () => {
    expect(roundCount("all", 18)).toBe(18);
  });

  it("caps a fixed count by the pool size", () => {
    expect(roundCount(10, 191)).toBe(10);
    expect(roundCount(10, 4)).toBe(4);
  });
});

describe("evaluateGuess", () => {
  it("scores a point target by distance", () => {
    const exact = evaluateGuess(PARIS, [2.35, 48.86], 1000);
    expect(exact.score).toBe(MAX_ROUND_SCORE);
    const miss = evaluateGuess(PARIS, [4.84, 45.76], 1000);
    expect(miss.distanceKm).toBeGreaterThan(380);
    expect(miss.answer).toEqual([2.35, 48.86]);
  });

  it("totals scores", () => {
    const a = evaluateGuess(PARIS, [2.35, 48.86], 1000);
    expect(totalScore([a, a])).toBe(2 * MAX_ROUND_SCORE);
    expect(totalScore([])).toBe(0);
  });
});

describe("gameReducer", () => {
  const loaded = (): GameState =>
    gameReducer(createInitialState(1000), { type: "loaded", targets: [PARIS, LYON] });

  it("starts loading, then guessing once targets arrive", () => {
    expect(createInitialState(1000).status).toBe("loading");
    const state = loaded();
    expect(state.status).toBe("guessing");
    expect(currentTarget(state)).toBe(PARIS);
  });

  it("errors on an empty target list, a failure, and resets on retry", () => {
    const empty = gameReducer(createInitialState(1000), { type: "loaded", targets: [] });
    expect(empty.status).toBe("error");
    const failed = gameReducer(createInitialState(1000), { type: "failed", message: "boom" });
    expect(failed).toMatchObject({ status: "error", error: "boom" });
    expect(gameReducer(failed, { type: "retry" })).toEqual(createInitialState(1000));
  });

  it("ignores confirm without a guess and next while guessing", () => {
    const state = loaded();
    expect(gameReducer(state, { type: "confirm", at: 1 })).toBe(state);
    expect(gameReducer(state, { type: "next", at: 1 })).toBe(state);
  });

  it("plays a full game", () => {
    let state = gameReducer(loaded(), { type: "place", guess: [2.35, 48.86] });
    state = gameReducer(state, { type: "confirm", at: 1 });
    expect(state.status).toBe("revealed");
    expect(currentResult(state)?.score).toBe(MAX_ROUND_SCORE);

    // Guesses are locked once revealed.
    expect(gameReducer(state, { type: "place", guess: [0, 0] })).toBe(state);

    state = gameReducer(state, { type: "next", at: 2 });
    expect(state).toMatchObject({ status: "guessing", roundIndex: 1, guess: null });
    expect(currentResult(state)).toBeUndefined();

    state = gameReducer(gameReducer(state, { type: "place", guess: [0, 0] }), { type: "confirm", at: 3 });
    state = gameReducer(state, { type: "next", at: 4 });
    expect(state.status).toBe("finished");
    expect(state.results).toHaveLength(2);
  });
});

describe("stopwatch", () => {
  const start = (at: number): GameState =>
    gameReducer(gameReducer(createInitialState(1000), { type: "loaded", targets: [PARIS, LYON] }), { type: "start", at });
  const guessAndConfirm = (state: GameState, at: number) =>
    gameReducer(gameReducer(state, { type: "place", guess: [2.35, 48.86] }), { type: "confirm", at });

  it("is stopped at zero while loading", () => {
    expect(elapsedMs(createInitialState(1000), 5_000)).toBe(0);
  });

  it("waits for the start signal (the map being ready) before the first round", () => {
    const loadedOnly = gameReducer(createInitialState(1000), { type: "loaded", targets: [PARIS, LYON] });
    expect(loadedOnly.status).toBe("guessing");
    expect(elapsedMs(loadedOnly, 5_000)).toBe(0);
    // Starting again, or outside a round, changes nothing.
    const started = gameReducer(loadedOnly, { type: "start", at: 1_000 });
    expect(gameReducer(started, { type: "start", at: 3_000 })).toBe(started);
    expect(gameReducer(createInitialState(1000), { type: "start", at: 0 }).runningSince).toBeNull();
  });

  it("starts with the first round and runs while guessing", () => {
    const state = start(10_000);
    expect(elapsedMs(state, 10_000)).toBe(0);
    expect(elapsedMs(state, 13_500)).toBe(3_500);
  });

  it("pauses while an answer is revealed, and resumes with the next round", () => {
    let state = guessAndConfirm(start(0), 4_000);
    expect(elapsedMs(state, 60_000)).toBe(4_000); // reading the answer does not count
    state = gameReducer(state, { type: "next", at: 60_000 });
    expect(elapsedMs(state, 62_000)).toBe(6_000);
  });

  it("stops for good once the game is finished", () => {
    let state = gameReducer(guessAndConfirm(start(0), 4_000), { type: "next", at: 10_000 });
    state = gameReducer(guessAndConfirm(state, 15_000), { type: "next", at: 20_000 });
    expect(state.status).toBe("finished");
    expect(elapsedMs(state, 99_000)).toBe(9_000);
  });

  it("never runs backwards on a clock earlier than the round start", () => {
    expect(elapsedMs(start(10_000), 9_000)).toBe(0);
  });

  it("resets on retry and on a new game", () => {
    const played = guessAndConfirm(start(0), 4_000);
    expect(elapsedMs(gameReducer(played, { type: "retry" }), 10_000)).toBe(0);
    expect(elapsedMs(gameReducer(played, { type: "loaded", targets: [PARIS] }), 10_000)).toBe(0);
  });
});
