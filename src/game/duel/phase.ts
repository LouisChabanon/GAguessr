import type { DuelView } from "@/lib/duel/types";
import { DUEL_REVEAL_MS } from "./rules";

export type DuelPhase =
  | "lobby"
  | "cancelled"
  /** Before the first round. */
  | "countdown"
  | "guessing"
  /** Locked, waiting for the opponent or the deadline. */
  | "locked"
  /** Both answers to the last round shown, before the next round starts. */
  | "reveal"
  | "finished";

type PhaseInput = Pick<DuelView, "status" | "roundStartedAt" | "finishedAt" | "myLock" | "rounds">;

/** When the reveal of the last finished round ends (server clock), or null outside a reveal. */
export function revealEndsAt(view: PhaseInput): number | null {
  if (view.status === "finished") return view.finishedAt === null ? null : view.finishedAt + DUEL_REVEAL_MS;
  return view.status === "playing" && view.rounds.length > 0 ? view.roundStartedAt : null;
}

/** Where a duel stands at `now`, on the server's clock. The last round is revealed like the others before the result. */
export function deriveDuelPhase(view: PhaseInput, now: number): DuelPhase {
  switch (view.status) {
    case "lobby":
    case "cancelled":
      return view.status;
    case "finished": {
      const until = revealEndsAt(view);
      return until !== null && now < until ? "reveal" : "finished";
    }
    case "playing":
      if (view.roundStartedAt !== null && now < view.roundStartedAt) {
        return view.rounds.length === 0 ? "countdown" : "reveal";
      }
      return view.myLock ? "locked" : "guessing";
  }
}

/** Time left until `deadline` at `now`, never negative. */
export function remainingMs(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, deadline - now);
}
