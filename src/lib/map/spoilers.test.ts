import { describe, expect, it } from "vitest";
import { SPOILER_PLACE_NAMES } from "./siteNames";
import { spoilerPlaceNames } from "./spoilers";

describe("spoilerPlaceNames", () => {
  it("returns every run of consecutive words, keeping hyphens and apostrophes", () => {
    const names = spoilerPlaceNames(["Saint-Alban-du-Rhône", "Base aérienne d'Istres"]);
    expect(names).toEqual(expect.arrayContaining(["Saint-Alban-du-Rhône", "Saint-Alban", "Alban-du-Rhône", "Rhône", "Istres", "Base aérienne"]));
  });

  it("skips runs too short to name a place", () => {
    const names = spoilerPlaceNames(["Le Blayais", "Cruas-Meysse"]);
    expect(names).not.toContain("Le");
    expect(names).toEqual(expect.arrayContaining(["Blayais", "Cruas", "Meysse", "Cruas-Meysse"]));
  });

  it("returns a sorted list without duplicates", () => {
    const names = spoilerPlaceNames(["CEA Marcoule", "Marcoule"]);
    expect(names).toEqual([...new Set(names)].sort());
    expect(names.filter((n) => n === "Marcoule")).toHaveLength(1);
  });
});

describe("SPOILER_PLACE_NAMES", () => {
  it("covers the towns of every game mode", () => {
    expect(SPOILER_PLACE_NAMES).toEqual(
      expect.arrayContaining(["Flamanville", "Gravelines", "Chinon", "Cattenom", "Nogent-sur-Seine", "Marcoule", "Brennilis", "Pierrelatte", "Taverny", "Saint-Dizier", "Istres", "Landivisiau", "Gramat", "Valduc", "Kudankulam", "Zaporizhzhia", "Balakovo"]),
    );
  });
});
