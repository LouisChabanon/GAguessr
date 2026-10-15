import { frNuclearPlantsMode } from "./fr-nuclear-plants";
import { frMilitaryNuclearMode, frNuclearResearchMode } from "./fr-nuclear-sites";
import type { GameMode } from "./types";

/** Add a game mode by appending it here. */
export const GAME_MODES: readonly GameMode[] = [frNuclearPlantsMode, frNuclearResearchMode, frMilitaryNuclearMode];

export const DEFAULT_MODE: GameMode = frNuclearPlantsMode;

export function getMode(id: string): GameMode | undefined {
  return GAME_MODES.find((mode) => mode.id === id);
}
