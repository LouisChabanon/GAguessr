import type { LonLat } from "@/lib/geo/distance";

export type DuelStatus = "lobby" | "playing" | "finished" | "cancelled";

/** One player's answer to a round; `guess` is null when the round ran out before they locked. */
export interface DuelGuess {
  guess: LonLat | null;
  distanceKm: number | null;
  score: number;
}

/** A round both players are done with: the only rounds whose answers are shown. */
export interface DuelRound {
  targetId: string;
  me: DuelGuess;
  opponent: DuelGuess;
}

/** What one player may see of a duel. The opponent's answer to the current round is never in it. */
export interface DuelView {
  id: string;
  code: string;
  modeId: string;
  status: DuelStatus;
  /** False for a visitor who opened the link of a lobby they have not joined yet. */
  isParticipant: boolean;
  isHost: boolean;
  myPseudo: string | null;
  /** For a visitor, the host. */
  opponentPseudo: string | null;
  roundCount: number;
  roundIndex: number;
  /** Target of the current round; null outside play. */
  currentTargetId: string | null;
  /** Server times (ms since epoch) bounding the current round. */
  roundStartedAt: number | null;
  roundDeadline: number | null;
  /** When the last round ended, once finished. */
  finishedAt: number | null;
  myLock: DuelGuess | null;
  opponentLocked: boolean;
  rounds: readonly DuelRound[];
  /** Code of the rematch lobby, once either player asked for one. */
  rematchCode: string | null;
  /** The server's clock when it built the view, to correct for the client's clock. */
  serverNow: number;
}

export type DuelError =
  | "invalid"
  | "unauthenticated"
  | "pseudo_required"
  | "not_found"
  | "full"
  | "expired"
  | "too_late"
  | "unavailable";

export type DuelResult<T> = ({ ok: true } & T) | { ok: false; error: DuelError };
