import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import { MAX_ROUND_SCORE } from "@/lib/geo/scoring";
import type { CountryFeature } from "@/lib/geo/atlas";
import type { Target } from "@/modes/types";
import { evaluateGuess, totalScore } from "./evaluate";
import { createInitialState, currentResult, currentTarget, gameReducer, type GameState } from "./gameReducer";
import { pickTargets, roundCount } from "./pickTargets";

const PARIS: Target = { kind: "point", id: "paris", name: "Paris", coords: [2.35, 48.86] };
const LYON: Target = { kind: "point", id: "lyon", name: "Lyon", coords: [4.84, 45.76] };
const square: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
};
const SQUARELAND: Target = {
  kind: "area",
  id: "squareland",
  name: "Squareland",
  feature: { ...square, properties: { name: "Squareland" } } as CountryFeature,
};

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

  it("gives full points inside an area target and measures to the border outside", () => {
    expect(evaluateGuess(SQUARELAND, [0.5, 0.5], 1000).score).toBe(MAX_ROUND_SCORE);
    const outside = evaluateGuess(SQUARELAND, [2, 0], 1000);
    expect(outside.answer).toEqual([1, 0]);
    expect(outside.score).toBeLessThan(MAX_ROUND_SCORE);
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
    expect(gameReducer(state, { type: "confirm" })).toBe(state);
    expect(gameReducer(state, { type: "next" })).toBe(state);
  });

  it("plays a full game", () => {
    let state = gameReducer(loaded(), { type: "place", guess: [2.35, 48.86] });
    state = gameReducer(state, { type: "confirm" });
    expect(state.status).toBe("revealed");
    expect(currentResult(state)?.score).toBe(MAX_ROUND_SCORE);

    // Guesses are locked once revealed.
    expect(gameReducer(state, { type: "place", guess: [0, 0] })).toBe(state);

    state = gameReducer(state, { type: "next" });
    expect(state).toMatchObject({ status: "guessing", roundIndex: 1, guess: null });
    expect(currentResult(state)).toBeUndefined();

    state = gameReducer(gameReducer(state, { type: "place", guess: [0, 0] }), { type: "confirm" });
    state = gameReducer(state, { type: "next" });
    expect(state.status).toBe("finished");
    expect(state.results).toHaveLength(2);
  });
});
