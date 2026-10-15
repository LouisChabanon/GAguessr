import { geoContains } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGeo, stubGeoFetch } from "@/test/stubFetch";
import { loadTopology } from "./topology";
import { parseFrance } from "./france";

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
    await expect(loadTopology("/geo/france.json")).resolves.toMatchObject({ type: "Topology" });
    expect(fetchMock).toHaveBeenCalledWith("/geo/france.json");
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

  it("ships no river data", () => {
    expect(france).not.toHaveProperty("rivers");
  });

  it("has the 96 metropolitan départements, each with a label point inside it", () => {
    expect(france.departements).toHaveLength(96);
    expect(france.departementLabels).toHaveLength(96);
    const byCode = new Map(france.departements.map((d) => [d.properties.code, d]));
    for (const label of france.departementLabels) {
      expect(geoContains(byCode.get(label.properties.code)!, label.geometry.coordinates as [number, number])).toBe(true);
    }
    expect(france.departementLabels.map((l) => l.properties.name)).toEqual(expect.arrayContaining(["Loiret", "Finistère", "Corse-du-Sud"]));
  });

  it("has a label point inside each region", () => {
    const byCode = new Map(france.regions.map((r) => [r.properties.code, r]));
    expect(france.regionLabels).toHaveLength(13);
    for (const label of france.regionLabels) {
      expect(geoContains(byCode.get(label.properties.code)!, label.geometry.coordinates as [number, number])).toBe(true);
    }
  });

  it("draws only the inner borders between départements", () => {
    const lines = france.departementBorders.geometry.coordinates;
    expect(lines.length).toBeGreaterThan(50);
    const points = lines.flat();
    // Nothing out at sea, west of Brittany's coast.
    expect(points.every(([lon]) => lon > -4.8)).toBe(true);
  });

  it("ships no neighbouring countries: the map dims everything outside France instead", () => {
    expect(france).not.toHaveProperty("neighbours");
  });

  it("rejects malformed input", () => {
    expect(() => parseFrance({ type: "Topology", arcs: [], objects: { regions: {} } })).toThrow(
      /invalid france topology/i,
    );
  });
});
