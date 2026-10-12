import { geoContains } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import citiesData from "@/data/cities.json";
import plantsData from "@/data/fr-nuclear-plants.json";
import { parseCountries } from "@/lib/geo/atlas";
import { distanceToFeature } from "@/lib/geo/nearest";
import { parseFrance } from "@/lib/geo/france";
import { readGeo, stubGeoFetch } from "@/test/stubFetch";
import { buildCityTargets } from "./cities";
import { countryDisplayName } from "./country-names";
import { buildCountryTargets } from "./countries";
import { buildNuclearPlantTargets } from "./fr-nuclear-plants";
import { GAME_MODES, getMode } from "./registry";
import { slugify } from "./slug";
import type { Target } from "./types";

const countries = parseCountries(readGeo("countries-50m.json"));
const france = parseFrance(readGeo("france.json"));
const countryByName = new Map(countries.map((c) => [c.properties.name, c]));

/** Coastal cities can fall just outside the simplified 1:50m coastline. */
const COASTLINE_TOLERANCE_KM = 25;
/** Coastal plants (Paluel, Gravelines…) sit right on the simplified coastline. */
const PLANT_TOLERANCE_KM = 5;

function expectUniqueIds(targets: readonly Target[]) {
  expect(new Set(targets.map((t) => t.id)).size).toBe(targets.length);
}

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("São Tomé & Príncipe!")).toBe("sao-tome-principe");
  });
});

describe("countryDisplayName", () => {
  it("expands atlas abbreviations and passes others through", () => {
    expect(countryDisplayName("Dem. Rep. Congo")).toBe("DR Congo");
    expect(countryDisplayName("France")).toBe("France");
  });
});

describe("countries mode", () => {
  const targets = buildCountryTargets(countries);

  it("keeps real countries and drops territories, specks and Antarctica", () => {
    const names = targets.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["France", "Peru", "Singapore", "United States"]));
    expect(names).not.toEqual(expect.arrayContaining(["Antarctica"]));
    expect(names).not.toContain("Puerto Rico");
    expect(names).not.toContain("Monaco");
    expect(targets.length).toBeGreaterThan(170);
  });

  it("has unique ids", () => expectUniqueIds(targets));
});

describe("cities dataset", () => {
  const targets = buildCityTargets(citiesData);

  it("has unique ids and plenty of cities", () => {
    expectUniqueIds(targets);
    expect(targets.length).toBeGreaterThanOrEqual(150);
  });

  it.each(citiesData)("$name lies in $country", ({ name, country, lat, lon }) => {
    const feature = countryByName.get(country);
    expect(feature, `unknown atlas country "${country}"`).toBeDefined();
    const { distanceKm } = distanceToFeature([lon, lat], feature!);
    expect(distanceKm, name).toBeLessThanOrEqual(COASTLINE_TOLERANCE_KM);
  });

  it("rejects malformed data", () => {
    expect(() => buildCityTargets([{ name: "X", country: "Y", lat: 200, lon: 0 }])).toThrow();
  });
});

describe("French nuclear plants dataset", () => {
  const targets = buildNuclearPlantTargets(plantsData);

  it("lists the 18 operating sites (57 reactors)", () => {
    expect(targets).toHaveLength(18);
    expect(plantsData.reduce((sum, p) => sum + p.reactors, 0)).toBe(57);
    expectUniqueIds(targets);
  });

  it.each(targets)("$name is in metropolitan France", (target) => {
    if (target.kind !== "point") throw new Error("expected point target");
    expect(distanceToFeature(target.coords, france.land).distanceKm).toBeLessThanOrEqual(PLANT_TOLERANCE_KM);
  });

  it.each(plantsData)("$name is in $region", ({ lon, lat, region }) => {
    const closest = france.regions
      .map((r) => ({ name: r.properties.name, d: distanceToFeature([lon, lat], r).distanceKm }))
      .sort((a, b) => a.d - b.d)[0];
    expect(closest.name).toBe(region);
    if (closest.d === 0) {
      expect(geoContains(france.regions.find((r) => r.properties.name === region)!, [lon, lat])).toBe(true);
    }
  });

  it("gives no hint, and reveals river, region and reactors with the answer", () => {
    const chinon = targets.find((t) => t.name === "Chinon");
    expect(chinon?.hint).toBeUndefined();
    expect(chinon?.detail).toBe("Loire · Centre-Val de Loire · 4 reactors");
  });
});

describe("registry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("plays every nuclear plant in one game", () => {
    expect(getMode("fr-nuclear-plants")?.roundsPerGame).toBe("all");
  });

  it("has unique mode ids and finds modes by id", () => {
    expect(new Set(GAME_MODES.map((m) => m.id)).size).toBe(GAME_MODES.length);
    expect(getMode("cities")?.title).toBe("Cities");
    expect(getMode("nope")).toBeUndefined();
  });

  it.each(GAME_MODES)("$id loads enough targets for a full game", async (mode) => {
    stubGeoFetch();
    const targets = await mode.loadTargets();
    expect(targets.length).toBeGreaterThanOrEqual(mode.roundsPerGame === "all" ? 1 : mode.roundsPerGame);
  });
});
