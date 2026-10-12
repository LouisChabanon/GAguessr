import { geoContains } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGeo, stubGeoFetch } from "@/test/stubFetch";
import { loadTopology, parseCountries } from "./atlas";
import { parseFrance } from "./france";

describe("parseCountries", () => {
  it("converts the bundled atlases to named country features", () => {
    for (const file of ["countries-50m.json", "countries-110m.json"]) {
      const countries = parseCountries(readGeo(file));
      expect(countries.length).toBeGreaterThan(170);
      expect(countries.map((c) => c.properties.name)).toContain("France");
    }
  });

  it.each([null, {}, { type: "Topology", arcs: [], objects: {} }])("rejects %j", (input) => {
    expect(() => parseCountries(input)).toThrow(/invalid countries topology/i);
  });
});

describe("loadTopology", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("surfaces HTTP errors, retries, then caches per URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadTopology("/geo/test-a.json")).rejects.toThrow(/503/);
    await expect(loadTopology("/geo/test-a.json")).resolves.toEqual({ ok: 1 });
    await loadTopology("/geo/test-a.json");
    await loadTopology("/geo/test-b.json");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("serves files through the stub used by other tests", async () => {
    const fetchMock = stubGeoFetch();
    await expect(loadTopology("/geo/countries-110m.json")).resolves.toMatchObject({ type: "Topology" });
    expect(fetchMock).toHaveBeenCalledWith("/geo/countries-110m.json");
  });
});

describe("parseFrance", () => {
  const france = parseFrance(readGeo("france.json"));

  it("has the 13 metropolitan regions", () => {
    expect(france.regions).toHaveLength(13);
    expect(france.regions.map((r) => r.properties.name)).toEqual(
      expect.arrayContaining(["Bretagne", "Corse", "Occitanie", "Grand Est"]),
    );
  });

  it("merges regions into a correctly wound land polygon", () => {
    expect(geoContains(france.land, [2.35, 48.86])).toBe(true); // Paris
    expect(geoContains(france.land, [9.15, 42.15])).toBe(true); // Corsica
    expect(geoContains(france.land, [-3, 47])).toBe(false); // Bay of Biscay
    expect(geoContains(france.land, [-52.33, 4.94])).toBe(false); // Cayenne
  });

  it("includes the major rivers and their main tributaries, without labels", () => {
    const names = france.rivers.map((r) => r.properties.name);
    expect(names).toEqual(
      expect.arrayContaining(["Loire", "Seine", "Rhône", "Garonne", "Meuse", "Moselle", "Vienne", "Saône", "Allier"]),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(france.rivers.filter((r) => r.properties.major).map((r) => r.properties.name).sort()).toEqual(
      ["Garonne", "Loire", "Rhin", "Rhône", "Seine"],
    );
  });

  it("includes neighbouring countries but not France itself", () => {
    const names = france.neighbours.map((n) => n.properties.name);
    expect(names).toEqual(expect.arrayContaining(["Spain", "Germany", "Belgium", "Italy", "Switzerland"]));
    expect(names).not.toContain("France");
  });

  it("rejects malformed input", () => {
    expect(() => parseFrance({ type: "Topology", arcs: [], objects: { regions: {} } })).toThrow(
      /invalid france topology/i,
    );
  });
});
