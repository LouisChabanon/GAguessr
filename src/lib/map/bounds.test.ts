import { describe, expect, it } from "vitest";
import type { LonLat } from "@/lib/geo/distance";
import { pointsBounds, revealBounds } from "./bounds";

const ANSWER: LonLat = [0, 45];

describe("revealBounds", () => {
  it("frames the guess and the answer", () => {
    expect(revealBounds([2, 47], ANSWER)).toEqual([[0, 45], [2, 47]]);
  });
});

describe("pointsBounds", () => {
  it("frames every point, such as both duel guesses and the answer", () => {
    expect(pointsBounds([[2, 47], ANSWER, [-1, 46]])).toEqual([[-1, 45], [2, 47]]);
  });

  it("collapses to a single point", () => {
    expect(pointsBounds([ANSWER])).toEqual([[0, 45], [0, 45]]);
  });
});
