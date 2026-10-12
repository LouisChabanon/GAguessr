import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import { distanceKm, isValidLonLat } from "./distance";
import { distanceToFeature } from "./nearest";
import { MAX_ROUND_SCORE, scoreFor, scoreTier } from "./scoring";

const PARIS = [2.3522, 48.8566] as const;
const LONDON = [-0.1276, 51.5072] as const;
const NEW_YORK = [-74.006, 40.7128] as const;

// 1°×1° square. d3-geo expects clockwise exterior rings (the opposite of RFC 7946).
const SQUARE: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
  },
};

describe("distanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(distanceKm(PARIS, PARIS)).toBe(0);
  });

  it("matches known great-circle distances", () => {
    expect(distanceKm(PARIS, LONDON)).toBeCloseTo(344, -1);
    expect(distanceKm(PARIS, NEW_YORK)).toBeCloseTo(5837, -2);
  });

  it("is symmetric", () => {
    expect(distanceKm(LONDON, NEW_YORK)).toBeCloseTo(distanceKm(NEW_YORK, LONDON), 6);
  });
});

describe("isValidLonLat", () => {
  it("accepts in-range coordinates", () => {
    expect(isValidLonLat([180, -90])).toBe(true);
  });

  it.each([
    [[181, 0]],
    [[0, 91]],
    [[Number.NaN, 0]],
    [[0, Number.POSITIVE_INFINITY]],
  ])("rejects %j", (point) => {
    expect(isValidLonLat(point as [number, number])).toBe(false);
  });
});

describe("distanceToFeature", () => {
  it("returns 0 and the click itself when inside the polygon", () => {
    const result = distanceToFeature([0.5, 0.5], SQUARE);
    expect(result.distanceKm).toBe(0);
    expect(result.nearest).toEqual([0.5, 0.5]);
  });

  it("returns distance to the closest vertex when outside", () => {
    const result = distanceToFeature([3, 1], SQUARE);
    expect(result.nearest).toEqual([1, 1]);
    expect(result.distanceKm).toBeCloseTo(distanceKm([3, 1], [1, 1]), 6);
  });

  it("handles multipolygons", () => {
    const multi: Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [SQUARE.geometry.coordinates, [[[10, 10], [10, 11], [11, 11], [11, 10], [10, 10]]]],
      },
    };
    expect(distanceToFeature([12, 11], multi).nearest).toEqual([11, 11]);
  });
});

describe("scoreFor", () => {
  it("gives the max score for a perfect guess", () => {
    expect(scoreFor(0, 1000)).toBe(MAX_ROUND_SCORE);
  });

  it("decays with distance and never goes negative", () => {
    const near = scoreFor(100, 1000);
    const far = scoreFor(1000, 1000);
    expect(near).toBeGreaterThan(far);
    expect(far).toBe(Math.round(MAX_ROUND_SCORE / Math.E));
    expect(scoreFor(20_000, 100)).toBe(0);
  });

  it("treats negative or invalid distances as zero distance / zero score", () => {
    expect(scoreFor(-5, 1000)).toBe(MAX_ROUND_SCORE);
    expect(scoreFor(Number.NaN, 1000)).toBe(0);
  });

  it("rejects a non-positive scale", () => {
    expect(() => scoreFor(10, 0)).toThrow(/scale/i);
  });
});

describe("scoreTier", () => {
  it.each([
    [5000, "great"],
    [4000, "great"],
    [2500, "good"],
    [1999, "poor"],
    [0, "poor"],
  ] as const)("%i → %s", (score, tier) => {
    expect(scoreTier(score)).toBe(tier);
  });
});
