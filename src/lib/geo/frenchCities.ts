import type { Feature, Point } from "geojson";
import { z } from "zod";
import citiesData from "@/data/fr-cities.json";

/** 1 = always labelled, 2 = labelled once the map is zoomed in a little (see lib/map/style.ts). */
export type CityRank = 1 | 2;

export type CityFeature = Feature<Point, { name: string; rank: CityRank }>;

const frenchCitySchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  rank: z.union([z.literal(1), z.literal(2)]),
});

export function parseFrenchCities(input: unknown): CityFeature[] {
  return z
    .array(frenchCitySchema)
    .parse(input)
    .map(({ name, lat, lon, rank }) => ({
      type: "Feature",
      properties: { name, rank },
      geometry: { type: "Point", coordinates: [lon, lat] },
    }));
}

export const FRENCH_CITIES: readonly CityFeature[] = parseFrenchCities(citiesData);
