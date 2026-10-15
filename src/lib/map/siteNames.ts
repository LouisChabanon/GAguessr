import militarySites from "@/data/fr-military-nuclear.json";
import nuclearPlants from "@/data/fr-nuclear-plants.json";
import researchSites from "@/data/fr-nuclear-research.json";
import { spoilerPlaceNames } from "./spoilers";

/** Town names hidden on the map because they would give a site of any game mode away. */
export const SPOILER_PLACE_NAMES: readonly string[] = spoilerPlaceNames(
  [...nuclearPlants, ...researchSites, ...militarySites].map((site) => site.name),
);
