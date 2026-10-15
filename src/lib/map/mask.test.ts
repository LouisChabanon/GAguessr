import { describe, expect, it } from "vitest";
import type { Feature, MultiPolygon, Position } from "geojson";
import { outsideOf } from "./mask";

const square = (x: number, y: number, size: number, clockwise = false): Position[] => {
  const ring = [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
  return clockwise ? ring.reverse() : ring;
};

/** Twice the signed planar area: positive when counter-clockwise. */
const signedArea = (ring: Position[]) =>
  ring.slice(1).reduce((sum, [x1, y1], i) => sum + (ring[i][0] * y1 - x1 * ring[i][1]), 0);

/** Even-odd rule over every ring, as a fill renderer sees it: count edge crossings of a ray going east. */
const isFilled = (rings: Position[][], [px, py]: Position) =>
  rings
    .flatMap((ring) => ring.slice(1).map((end, i) => [ring[i], end]))
    .filter(([[x0, y0], [x1, y1]]) => (y0 > py) !== (y1 > py) && px < x0 + ((py - y0) * (x1 - x0)) / (y1 - y0))
    .length % 2 === 1;

// Mainland drawn clockwise, island counter-clockwise: the input winding must not matter.
const land: Feature<MultiPolygon> = {
  type: "Feature",
  properties: {},
  geometry: { type: "MultiPolygon", coordinates: [[square(0, 40, 8, true)], [square(9, 41, 1)]] },
};

describe("outsideOf", () => {
  const mask = outsideOf(land, [[-30, 30], [40, 65]]);
  const rings = mask.geometry.coordinates;

  it("covers the whole box with one hole per landmass", () => {
    expect(mask.geometry.type).toBe("Polygon");
    expect(rings).toHaveLength(3);
    expect(rings[0]).toEqual([[-30, 30], [40, 30], [40, 65], [-30, 65], [-30, 30]]);
  });

  it("winds every hole against the outer ring, whatever the input winding", () => {
    const outer = Math.sign(signedArea(rings[0]));
    for (const hole of rings.slice(1)) {
      expect(Math.sign(signedArea(hole))).toBe(-outer);
    }
  });

  it("fills everything but the land", () => {
    expect(isFilled(rings, [4, 44])).toBe(false); // mainland
    expect(isFilled(rings, [9.5, 41.5])).toBe(false); // island
    expect(isFilled(rings, [-5, 38])).toBe(true); // a neighbour
    expect(isFilled(rings, [20, 60])).toBe(true);
  });
});
