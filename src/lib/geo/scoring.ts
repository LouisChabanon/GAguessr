export const MAX_ROUND_SCORE = 5000;

const GREAT_RATIO = 0.8;
const GOOD_RATIO = 0.4;

export type ScoreTier = "great" | "good" | "poor";

/** Exponential decay: a miss of `scaleKm` keeps ~37% of the points. */
export function scoreFor(distanceKm: number, scaleKm: number): number {
  if (!(scaleKm > 0)) {
    throw new Error(`Score scale must be positive, got ${scaleKm}`);
  }
  if (Number.isNaN(distanceKm)) return 0;

  const d = Math.max(0, distanceKm);
  return Math.round(MAX_ROUND_SCORE * Math.exp(-d / scaleKm));
}

export function scoreTier(score: number): ScoreTier {
  const ratio = score / MAX_ROUND_SCORE;
  if (ratio >= GREAT_RATIO) return "great";
  if (ratio >= GOOD_RATIO) return "good";
  return "poor";
}
