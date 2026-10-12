import { distanceKm, type LonLat } from "@/lib/geo/distance";
import { distanceToFeature } from "@/lib/geo/nearest";
import { scoreFor } from "@/lib/geo/scoring";
import type { Target } from "@/modes/types";

export interface RoundResult {
  target: Target;
  guess: LonLat;
  /** Point the distance was measured to (nearest border point for areas). */
  answer: LonLat;
  distanceKm: number;
  score: number;
}

export function evaluateGuess(target: Target, guess: LonLat, scaleKm: number): RoundResult {
  const { distanceKm: d, nearest } =
    target.kind === "area"
      ? distanceToFeature(guess, target.feature)
      : { distanceKm: distanceKm(guess, target.coords), nearest: target.coords };

  return { target, guess, answer: nearest, distanceKm: d, score: scoreFor(d, scaleKm) };
}

export function totalScore(results: readonly RoundResult[]): number {
  return results.reduce((sum, r) => sum + r.score, 0);
}
