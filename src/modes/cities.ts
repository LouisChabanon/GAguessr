import { z } from "zod";
import { countryDisplayName } from "./country-names";
import { slugify } from "./slug";
import type { GameMode, PointTarget } from "./types";

export const citySchema = z.object({
  name: z.string().min(1),
  /** Country name as spelled in world-atlas. */
  country: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type City = z.infer<typeof citySchema>;

export function buildCityTargets(input: unknown): PointTarget[] {
  return z
    .array(citySchema)
    .parse(input)
    .map((city) => ({
      kind: "point",
      id: slugify(`${city.name}-${city.country}`),
      name: city.name,
      hint: countryDisplayName(city.country),
      coords: [city.lon, city.lat],
    }));
}

export const citiesMode: GameMode = {
  id: "cities",
  title: "Cities",
  description: "Capitals and major cities around the world. Every kilometre counts.",
  region: "world",
  scaleKm: 1500,
  roundsPerGame: 10,
  loadTargets: async () => buildCityTargets((await import("@/data/cities.json")).default),
};
