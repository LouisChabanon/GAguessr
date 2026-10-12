import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubGeoFetch } from "@/test/stubFetch";
import { pickLevel, REGIONS, WORLD_DETAIL_ZOOM, type BasemapLevel } from "./regions";

const level = (minZoom: number): BasemapLevel => ({ minZoom, layers: [] });

describe("pickLevel", () => {
  const levels = [level(1), level(2.5), level(8)];

  it.each([
    [1, 1],
    [2.49, 1],
    [2.5, 2.5],
    [7, 2.5],
    [40, 8],
  ])("zoom %d → level %d", (k, minZoom) => {
    expect(pickLevel(levels, k)?.minZoom).toBe(minZoom);
  });

  it("handles unsorted levels and zooms below every level", () => {
    expect(pickLevel([level(2.5), level(1)], 3)?.minZoom).toBe(2.5);
    expect(pickLevel([level(2)], 1)).toBeUndefined();
  });
});

describe("regions", () => {
  beforeEach(() => {
    stubGeoFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("world draws 1:110m first and loads 1:50m detail on demand", async () => {
    const basemap = await REGIONS.world.loadBasemap();
    const [base] = basemap.levels;
    const lowRes = base.layers[0].features;
    expect(lowRes.length).toBeLessThan(180);
    expect(lowRes.some((f) => f.properties?.name === "Antarctica")).toBe(false);

    expect(basemap.detail?.minZoom).toBe(WORLD_DETAIL_ZOOM);
    const detail = await basemap.detail!.load();
    expect(detail.minZoom).toBe(WORLD_DETAIL_ZOOM);
    expect(detail.layers[0].features.length).toBeGreaterThan(lowRes.length);
  });

  it("france draws neighbours, regions, rivers, then city labels, with no detail level", async () => {
    const basemap = await REGIONS["france-metro"].loadBasemap();
    expect(basemap.detail).toBeUndefined();
    const layers = basemap.levels[0].layers;
    expect(layers.map((l) => `${l.kind}:${l.style}`)).toEqual([
      "fill:muted",
      "fill:region",
      "line:river",
      "line:river-major",
      "label:city",
    ]);
    expect(layers[1].features).toHaveLength(13);
  });

  it.each(Object.values(REGIONS))("$id projection round-trips coordinates", (region) => {
    const projection = region.createProjection();
    const point = projection([2.35, 48.86]);
    expect(point).not.toBeNull();
    const [lon, lat] = projection.invert!(point!)!;
    expect(lon).toBeCloseTo(2.35, 6);
    expect(lat).toBeCloseTo(48.86, 6);
  });
});
