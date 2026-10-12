import { citiesMode } from "./cities";
import { countriesMode } from "./countries";
import { frNuclearPlantsMode } from "./fr-nuclear-plants";
import type { GameMode } from "./types";

/** Add a game mode by appending it here. */
export const GAME_MODES: readonly GameMode[] = [countriesMode, citiesMode, frNuclearPlantsMode];

export function getMode(id: string): GameMode | undefined {
  return GAME_MODES.find((mode) => mode.id === id);
}
