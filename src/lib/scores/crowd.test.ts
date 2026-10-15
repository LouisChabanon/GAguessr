import { describe, expect, it } from "vitest";
import { parseCrowdData } from "./crowd";

const valid = {
  withinKm: 100,
  stats: { gravelines: { plays: 12, avgScore: 3200.5, medianKm: 42, withinShare: 0.75 } },
  guesses: { gravelines: [[2.1, 51], [2.3, 50.9]] },
};

describe("parseCrowdData", () => {
  it("accepts the route's payload", () => {
    expect(parseCrowdData(valid)).toEqual(valid);
  });

  it.each([
    ["a non-object", "oops"],
    ["out-of-range guesses", { ...valid, guesses: { gravelines: [[500, 0]] } }],
    ["a share above 1", { ...valid, stats: { gravelines: { ...valid.stats.gravelines, withinShare: 2 } } }],
    ["missing fields", { stats: {} }],
  ])("rejects %s", (_, input) => {
    expect(parseCrowdData(input)).toBeNull();
  });
});
