import type { DuelRound } from "@/lib/duel/types";

export interface DuelOutcome {
  myTotal: number;
  opponentTotal: number;
  winner: "me" | "opponent" | "tie";
}

/** Totals so far; the higher total wins. */
export function duelOutcome(rounds: readonly DuelRound[]): DuelOutcome {
  const myTotal = rounds.reduce((sum, r) => sum + r.me.score, 0);
  const opponentTotal = rounds.reduce((sum, r) => sum + r.opponent.score, 0);
  const winner = myTotal === opponentTotal ? "tie" : myTotal > opponentTotal ? "me" : "opponent";
  return { myTotal, opponentTotal, winner };
}
