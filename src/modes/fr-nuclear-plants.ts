import { z } from "zod";
import { loadPhotos, withPhotos } from "./photos";
import { slugify } from "./slug";
import type { GameMode, Target } from "./types";

export const nuclearPlantSchema = z.object({
  name: z.string().min(1),
  /** One of the 13 metropolitan regions, as named in public/geo/france.json. */
  region: z.string().min(1),
  department: z.string().min(1),
  waterSource: z.string().min(1),
  reactors: z.number().int().positive(),
  /** One sentence revealed with the answer, only when there is something worth saying. */
  description: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type NuclearPlant = z.infer<typeof nuclearPlantSchema>;

export function buildNuclearPlantTargets(input: unknown): Target[] {
  return z
    .array(nuclearPlantSchema)
    .parse(input)
    .map((plant) => ({
      id: slugify(plant.name),
      name: plant.name,
      // No hint: the player has to know the plant. Context comes with the answer.
      detail: `${plant.waterSource} · ${plant.region} · ${plant.reactors} réacteurs`,
      description: plant.description,
      coords: [plant.lon, plant.lat],
    }));
}

export const frNuclearPlantsMode: GameMode = {
  id: "fr-nuclear-plants",
  title: "Centrales nucléaires",
  description: "Les 18 centrales nucléaires en activité, à placer sur la carte des régions et grandes villes.",
  scaleKm: 100,
  roundsPerGame: "all",
  loadTargets: async () =>
    withPhotos(
      "fr-nuclear-plants",
      buildNuclearPlantTargets((await import("@/data/fr-nuclear-plants.json")).default),
      await loadPhotos(),
    ),
};
