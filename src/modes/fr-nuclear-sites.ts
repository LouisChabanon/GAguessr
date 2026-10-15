import { loadPhotos, withPhotos } from "./photos";
import { buildSiteTargets } from "./sites";
import type { GameMode } from "./types";

export const frNuclearResearchMode: GameMode = {
  id: "fr-nuclear-research",
  title: "Recherche et réacteurs",
  description: "Centres du CEA, réacteurs de recherche, prototypes et laboratoires : du berceau de Zoé à ITER.",
  scaleKm: 100,
  roundsPerGame: "all",
  map: "france",
  hasPhotos: true,
  loadTargets: async () =>
    withPhotos(
      "fr-nuclear-research",
      buildSiteTargets((await import("@/data/fr-nuclear-research.json")).default),
      await loadPhotos(),
    ),
};

export const frMilitaryNuclearMode: GameMode = {
  id: "fr-military-nuclear",
  title: "Sites militaires",
  description: "La carte de la dissuasion : bases de sous-marins, centres de la DAM, bases aériennes et vestiges de la guerre froide.",
  scaleKm: 100,
  roundsPerGame: "all",
  map: "france",
  hasPhotos: true,
  loadTargets: async () =>
    withPhotos(
      "fr-military-nuclear",
      buildSiteTargets((await import("@/data/fr-military-nuclear.json")).default),
      await loadPhotos(),
    ),
};
