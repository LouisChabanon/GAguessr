import { geoEqualEarth, geoPath } from "d3-geo";
import { zoom, zoomIdentity } from "d3-zoom";
import { describe, expect, it } from "vitest";
import type { Extent } from "./viewport";
import {
  COMPACT_MAX_WIDTH,
  contentExtent,
  fitProjection,
  hudInsets,
  invertPoint,
  rectsIntersect,
  revealTransform,
  visibleRect,
} from "./viewport";

const SPHERE = { type: "Sphere" } as const;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 740 };
const constrain = zoom().constrain();

describe("hudInsets", () => {
  it("reserves more top space on compact screens", () => {
    expect(hudInsets(PHONE).top).toBeGreaterThan(hudInsets(DESKTOP).top);
    expect(hudInsets({ width: COMPACT_MAX_WIDTH, height: 800 })).toEqual(hudInsets(DESKTOP));
  });
});

describe("fitProjection", () => {
  it("keeps the map clear of the HUD on desktop", () => {
    const projection = fitProjection(geoEqualEarth(), SPHERE, DESKTOP, { isWholeWorld: true });
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(SPHERE);
    expect(y0).toBeGreaterThanOrEqual(hudInsets(DESKTOP).top - 1);
    expect(y1).toBeLessThanOrEqual(DESKTOP.height - hudInsets(DESKTOP).bottom + 1);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(DESKTOP.width);
  });

  it("lets a whole-world map overflow sideways on a phone", () => {
    const projection = fitProjection(geoEqualEarth(), SPHERE, PHONE, { isWholeWorld: true });
    const [[x0], [x1]] = geoPath(projection).bounds(SPHERE);
    expect(x1 - x0).toBeGreaterThan(PHONE.width);
  });

  it("contains a regional map within the viewport on a phone", () => {
    const projection = fitProjection(geoEqualEarth(), SPHERE, PHONE, { isWholeWorld: false });
    const [[x0], [x1]] = geoPath(projection).bounds(SPHERE);
    expect(x1 - x0).toBeLessThanOrEqual(PHONE.width);
  });
});

describe("contentExtent", () => {
  it("is never smaller than the viewport", () => {
    const projection = fitProjection(geoEqualEarth(), SPHERE, PHONE, { isWholeWorld: true });
    const [[x0, y0], [x1, y1]] = contentExtent(geoPath(projection), SPHERE, PHONE);
    expect(x0).toBeLessThan(0);
    expect(x1).toBeGreaterThan(PHONE.width);
    expect([y0, y1]).toEqual([0, PHONE.height]);
  });
});

describe("invertPoint", () => {
  const projection = fitProjection(geoEqualEarth(), SPHERE, DESKTOP, { isWholeWorld: true });

  it("round-trips a point on the map", () => {
    const [lon, lat] = invertPoint(projection, projection([10, 20])!)!;
    expect(lon).toBeCloseTo(10, 6);
    expect(lat).toBeCloseTo(20, 6);
  });

  it("rejects clicks outside the globe", () => {
    expect(invertPoint(projection, [2, 2])).toBeNull();
  });
});

describe("revealTransform", () => {
  const projection = fitProjection(geoEqualEarth(), SPHERE, DESKTOP, { isWholeWorld: true });
  const extent: Extent = [[0, 0], [DESKTOP.width, DESKTOP.height]];
  const safeArea = { top: 120, bottom: 220 };

  it("zooms in on nearby points and centres them in the visible area", () => {
    const t = revealTransform(projection, [[2, 48], [4, 46]], DESKTOP, safeArea, extent, constrain);
    expect(t.k).toBeGreaterThan(1);
    const mid = projection([3, 47])!;
    const [, y] = t.apply(mid);
    const visibleMid = safeArea.top + (DESKTOP.height - safeArea.top - safeArea.bottom) / 2;
    expect(y).toBeCloseTo(visibleMid, -1);
  });

  it("stays fully zoomed out for points on opposite sides of the world", () => {
    const t = revealTransform(projection, [[-150, 0], [150, 0]], DESKTOP, safeArea, extent, constrain);
    expect(t.k).toBe(1);
  });

  it("returns identity when nothing projects", () => {
    expect(revealTransform(projection, [], DESKTOP, safeArea, extent, constrain)).toEqual(zoomIdentity);
  });
});

describe("culling helpers", () => {
  it("detects overlapping and disjoint rectangles", () => {
    expect(rectsIntersect([[0, 0], [10, 10]], [[5, 5], [20, 20]])).toBe(true);
    expect(rectsIntersect([[0, 0], [10, 10]], [[10, 10], [20, 20]])).toBe(true); // touching
    expect(rectsIntersect([[0, 0], [10, 10]], [[11, 0], [20, 10]])).toBe(false);
  });

  it("maps the screen back to unzoomed map coordinates", () => {
    expect(visibleRect(zoomIdentity, DESKTOP)).toEqual([[0, 0], [1440, 900]]);
    const zoomed = zoomIdentity.translate(-100, -50).scale(2);
    expect(visibleRect(zoomed, DESKTOP)).toEqual([[50, 25], [770, 475]]);
  });
});
