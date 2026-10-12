import { geoDistance } from "d3-geo";

export type LonLat = readonly [lon: number, lat: number];

export const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance(a as [number, number], b as [number, number]) * EARTH_RADIUS_KM;
}

export function isValidLonLat([lon, lat]: LonLat): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90
  );
}
