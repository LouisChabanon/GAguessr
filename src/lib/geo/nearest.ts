import { geoContains } from "d3-geo";
import type { Feature, Position } from "geojson";
import { distanceKm, type LonLat } from "./distance";

export interface FeatureDistance {
  distanceKm: number;
  /** Closest point of the feature to the click (the click itself when inside). */
  nearest: LonLat;
}

function featureVertices(feature: Feature): Position[] {
  const { geometry } = feature;
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Distance from a point to an area feature: 0 when inside, otherwise the
 * distance to the closest boundary vertex. At 1:50m resolution vertices are
 * dense enough that this stays within a few km of the true edge distance.
 */
export function distanceToFeature(point: LonLat, feature: Feature): FeatureDistance {
  if (geoContains(feature, point as [number, number])) {
    return { distanceKm: 0, nearest: point };
  }

  return featureVertices(feature).reduce<FeatureDistance>(
    (best, [lon, lat]) => {
      const vertex: LonLat = [lon, lat];
      const d = distanceKm(point, vertex);
      return d < best.distanceKm ? { distanceKm: d, nearest: vertex } : best;
    },
    { distanceKm: Number.POSITIVE_INFINITY, nearest: point },
  );
}
