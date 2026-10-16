import { describe, expect, it } from "vitest";
import type { LonLat } from "@/lib/geo/distance";
import { nearestPoints, revealBounds } from "./bounds";

const ANSWER: LonLat = [0, 45];

describe("nearestPoints", () => {
  it("keeps the given share of points, nearest to the answer first", () => {
    const points: LonLat[] = [[5, 45], [0.1, 45], [20, 45], [1, 45], [2, 45]];
    expect(nearestPoints(points, ANSWER, 0.6)).toEqual([[0.1, 45], [1, 45], [2, 45]]);
  });

  it("rounds up, so a lone guess is always kept", () => {
    expect(nearestPoints([[3, 45]], ANSWER, 0.8)).toEqual([[3, 45]]);
    expect(nearestPoints([], ANSWER, 0.8)).toEqual([]);
  });
});

describe("revealBounds", () => {
  it("frames the guess and the answer", () => {
    expect(revealBounds([2, 47], ANSWER)).toEqual([[0, 45], [2, 47]]);
  });

  it("widens to the crowd's guesses but not to its outliers", () => {
    const crowd: LonLat[] = [[-1, 44], [1, 46], [0.5, 45], [-0.5, 45.5], [30, 60]];
    expect(revealBounds([0.2, 45.1], ANSWER, crowd)).toEqual([[-1, 44], [1, 46]]);
  });
});
