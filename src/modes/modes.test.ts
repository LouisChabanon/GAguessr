import { geoContains } from "d3-geo";
import { describe, expect, it } from "vitest";
import militaryData from "@/data/fr-military-nuclear.json";
import plantsData from "@/data/fr-nuclear-plants.json";
import researchData from "@/data/fr-nuclear-research.json";
import { distanceToFeature } from "@/lib/geo/nearest";
import { parseFrance } from "@/lib/geo/france";
import { readGeo } from "@/test/stubFetch";
import { buildNuclearPlantTargets, frNuclearPlantsMode } from "./fr-nuclear-plants";
import { frMilitaryNuclearMode, frNuclearResearchMode } from "./fr-nuclear-sites";
import { DEFAULT_MODE, GAME_MODES, getMode } from "./registry";
import { buildSiteTargets } from "./sites";
import { slugify } from "./slug";
import type { Target } from "./types";

const france = parseFrance(readGeo("france.json"));

/** Coastal sites (Paluel, Île Longue…) sit right on the simplified coastline. */
const PLANT_TOLERANCE_KM = 5;

function expectUniqueIds(targets: readonly Target[]) {
  expect(new Set(targets.map((t) => t.id)).size).toBe(targets.length);
}

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("São Tomé & Príncipe!")).toBe("sao-tome-principe");
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

  it("gives no hint, and reveals river, region and reactor count with the answer", () => {
    const chinon = targets.find((t) => t.name === "Chinon");
    expect(chinon?.hint).toBeUndefined();
    expect(chinon?.detail).toBe("Loire · Centre-Val de Loire · 4 réacteurs");
    expect(chinon?.description).toMatch(/« la boule »/);
  });
});

describe("nuclear plants mode", () => {
  it("plays every plant in one game", async () => {
    expect(frNuclearPlantsMode.roundsPerGame).toBe("all");
    expect(await frNuclearPlantsMode.loadTargets()).toHaveLength(18);
  });
});

const SITE_DATASETS = [
  { mode: frNuclearResearchMode, data: researchData, count: 10 },
  { mode: frMilitaryNuclearMode, data: militaryData, count: 18 },
] as const;

describe.each(SITE_DATASETS)("$mode.title dataset", ({ mode, data, count }) => {
  const targets = buildSiteTargets(data);

  it(`lists ${count} sites with unique ids`, async () => {
    expect(targets).toHaveLength(count);
    expectUniqueIds(targets);
    expect(await mode.loadTargets()).toHaveLength(count);
    expect(mode.roundsPerGame).toBe("all");
  });

  it.each(targets)("$name is in metropolitan France", (target) => {
    expect(distanceToFeature(target.coords, france.land).distanceKm).toBeLessThanOrEqual(PLANT_TOLERANCE_KM);
  });

  it.each(data)("$name is in $region", ({ lon, lat, region }) => {
    const closest = france.regions
      .map((r) => ({ name: r.properties.name, d: distanceToFeature([lon, lat], r).distanceKm }))
      .sort((a, b) => a.d - b.d)[0];
    expect(closest.name).toBe(region);
  });

  it("reveals the site's role and department with the answer, with no hint", () => {
    expect(targets[0].hint).toBeUndefined();
    expect(targets[0].detail).toBe(`${data[0].role} · ${data[0].department}`);
    expect(targets[0].description).toBe(data[0].description);
  });
});

describe("site datasets", () => {
  it("reject malformed rows", () => {
    expect(() => buildSiteTargets([{ name: "X", region: "Y", department: "Z", role: "R", lat: 95, lon: 0 }])).toThrow();
  });
});

describe("registry", () => {
  it("lists the three modes, plants first, and finds them by id", () => {
    expect(GAME_MODES.map((m) => m.id)).toEqual(["fr-nuclear-plants", "fr-nuclear-research", "fr-military-nuclear"]);
    expect(getMode("fr-military-nuclear")).toBe(frMilitaryNuclearMode);
    expect(getMode("countries")).toBeUndefined();
    expect(DEFAULT_MODE).toBe(frNuclearPlantsMode);
  });
});
