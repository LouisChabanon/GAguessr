import { z } from "zod";
import { loadPhotos, withPhotos } from "./photos";
import { slugify } from "./slug";
import type { GameMode, Target } from "./types";

export const worldPlantSchema = z.object({
  name: z.string().min(1),
  /** Reactors in service, long-term shut-down ones included (as PRIS counts them). */
  reactors: z.number().int().positive(),
  capacityMw: z.number().int().positive(),
  /** French name of the country. */
  country: z.string().min(1),
  countryCode: z.string().length(2),
  /** Year the first reactor went into service. */
  since: z.number().int().min(1950),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type WorldPlant = z.infer<typeof worldPlantSchema>;

const MW = new Intl.NumberFormat("fr-FR");

function reactorCount(n: number): string {
  return n === 1 ? "1 réacteur" : `${n} réacteurs`;
}

export function buildWorldPlantTargets(input: unknown): Target[] {
  return z
    .array(worldPlantSchema)
    .parse(input)
    .map((plant) => ({
      // Two countries could share a station name; the country code keeps ids unique.
      id: slugify(`${plant.countryCode} ${plant.name}`),
      name: plant.name,
      // Station names are obscure worldwide: the country narrows the search without giving it away.
      hint: plant.country,
      detail: `${reactorCount(plant.reactors)} · ${MW.format(plant.capacityMw)} MW · depuis ${plant.since}`,
      coords: [plant.lon, plant.lat],
    }));
}

export const worldNuclearPlantsMode: GameMode = {
  id: "world-nuclear-plants",
  title: "Centrales du monde",
  description: "Les centrales nucléaires en service dans le monde : dix tirées au hasard à chaque partie, sur la carte du monde.",
  // Worldwide, landing in the right region already deserves points.
  scaleKm: 500,
  roundsPerGame: 10,
  map: "world",
  hasPhotos: true,
  loadTargets: async () =>
    withPhotos(
      "world-nuclear-plants",
      buildWorldPlantTargets((await import("@/data/world-nuclear-plants.json")).default),
      await loadPhotos(),
    ),
};
