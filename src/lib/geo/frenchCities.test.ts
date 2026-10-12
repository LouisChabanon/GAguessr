import { describe, expect, it } from "vitest";
import { readGeo } from "@/test/stubFetch";
import { parseFrance } from "./france";
import { FRENCH_CITIES, maxVisibleCityRank, parseFrenchCities } from "./frenchCities";
import { distanceToFeature } from "./nearest";

/** Coastal cities (Brest, Le Havre, Nice…) vs. the simplified coastline. */
const COAST_TOLERANCE_KM = 5;

describe("French cities", () => {
  const { land } = parseFrance(readGeo("france.json"));

  it("has the 10 largest cities as primary labels", () => {
    const primary = FRENCH_CITIES.filter((c) => c.properties.rank === 1).map((c) => c.properties.name);
    expect(primary).toHaveLength(10);
    expect(primary).toEqual(expect.arrayContaining(["Paris", "Marseille", "Lyon", "Toulouse", "Lille"]));
    expect(new Set(FRENCH_CITIES.map((c) => c.properties.name)).size).toBe(FRENCH_CITIES.length);
  });

  it.each(FRENCH_CITIES.map((c) => [c.properties.name, c] as const))("%s is in France", (_, city) => {
    const [lon, lat] = city.geometry.coordinates;
    expect(distanceToFeature([lon, lat], land).distanceKm).toBeLessThanOrEqual(COAST_TOLERANCE_KM);
  });

  it("rejects malformed data", () => {
    expect(() => parseFrenchCities([{ name: "X", lat: 0, lon: 0, rank: 3 }])).toThrow();
  });
});

describe("maxVisibleCityRank", () => {
  it.each([
    [300, 1],
    [499, 1],
    [500, 2],
    [2400, 2],
  ])("cities spanning %dpx → rank %d", (width, rank) => {
    expect(maxVisibleCityRank(width)).toBe(rank);
  });
});
