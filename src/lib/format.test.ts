import { describe, expect, it } from "vitest";
import { formatDistance, formatScore } from "./format";

describe("formatDistance", () => {
  it.each([
    [0, "Spot on"],
    [0.4, "< 1 km"],
    [12.6, "13 km"],
    [12345.2, "12,345 km"],
  ])("%d → %s", (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

describe("formatScore", () => {
  it("groups thousands", () => {
    expect(formatScore(48210)).toBe("48,210");
  });
});
