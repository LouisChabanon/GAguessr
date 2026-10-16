import type { RoundResult } from "@/game/evaluate";
import type { Target } from "@/modes/types";
import type { DuelGuess } from "./types";

/**
 * A duel answer in the shape the map and score panels take. A round that ran out has no guess:
 * it is drawn at the answer, so no line or pin shows for it.
 */
export function toRoundResult(target: Target, answer: DuelGuess): RoundResult {
  return {
    target,
    guess: answer.guess ?? target.coords,
    answer: target.coords,
    distanceKm: answer.distanceKm ?? 0,
    score: answer.score,
  };
}
