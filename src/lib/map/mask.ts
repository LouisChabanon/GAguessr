import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

type Bounds = [[number, number], [number, number]];

/** Twice the signed planar area of a closed ring: positive when counter-clockwise. */
function signedArea(ring: readonly Position[]): number {
  return ring.slice(1).reduce((sum, [x1, y1], i) => sum + (ring[i][0] * y1 - x1 * ring[i][1]), 0);
}

function clockwise(ring: readonly Position[]): Position[] {
  return signedArea(ring) > 0 ? [...ring].reverse() : [...ring];
}

/**
 * Everything inside `bounds` except `land`: a box with one hole per landmass.
 * MapLibre tells holes from outer rings by winding, so the box runs counter-clockwise and every hole clockwise.
 */
export function outsideOf(land: Feature<MultiPolygon>, [[west, south], [east, north]]: Bounds): Feature<Polygon> {
  const box: Position[] = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  const holes = land.geometry.coordinates.map(([outer]) => clockwise(outer));
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [box, ...holes] } };
}
