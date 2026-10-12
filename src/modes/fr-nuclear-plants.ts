import { z } from "zod";
import { slugify } from "./slug";
import type { GameMode, PointTarget } from "./types";

export const nuclearPlantSchema = z.object({
  name: z.string().min(1),
  /** One of the 13 metropolitan regions, as named in public/geo/france.json. */
  region: z.string().min(1),
  department: z.string().min(1),
  waterSource: z.string().min(1),
  reactors: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type NuclearPlant = z.infer<typeof nuclearPlantSchema>;

export function buildNuclearPlantTargets(input: unknown): PointTarget[] {
  return z
    .array(nuclearPlantSchema)
    .parse(input)
    .map((plant) => ({
      kind: "point",
      id: slugify(plant.name),
      name: plant.name,
      // No hint: the player has to know the plant. Context comes with the answer.
      detail: `${plant.waterSource} · ${plant.region} · ${plant.reactors} reactors`,
      coords: [plant.lon, plant.lat],
    }));
}

export const frNuclearPlantsMode: GameMode = {
  id: "fr-nuclear-plants",
  title: "French nuclear plants",
  description: "Place all 18 of France's operating nuclear power plants on a map of its rivers, regions and major cities.",
  region: "france-metro",
  scaleKm: 100,
  roundsPerGame: "all",
  loadTargets: async () =>
    buildNuclearPlantTargets((await import("@/data/fr-nuclear-plants.json")).default),
};
