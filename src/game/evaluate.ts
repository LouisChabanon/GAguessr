import { distanceKm, type LonLat } from "@/lib/geo/distance";
import { scoreFor } from "@/lib/geo/scoring";
import type { Target } from "@/modes/types";

export interface RoundResult {
  target: Target;
  guess: LonLat;
  /** Where the target actually is. */
  answer: LonLat;
  distanceKm: number;
  score: number;
}

export function evaluateGuess(target: Target, guess: LonLat, scaleKm: number): RoundResult {
  const d = distanceKm(guess, target.coords);
  return { target, guess, answer: target.coords, distanceKm: d, score: scoreFor(d, scaleKm) };
}

export function totalScore(results: readonly RoundResult[]): number {
  return results.reduce((sum, r) => sum + r.score, 0);
}
