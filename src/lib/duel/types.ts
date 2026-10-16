import type { LonLat } from "@/lib/geo/distance";

export type DuelStatus = "lobby" | "playing" | "finished" | "cancelled";

/** One player's answer to a round; `guess` is null when the round ran out before they locked. */
export interface DuelGuess {
  guess: LonLat | null;
  distanceKm: number | null;
  score: number;
}

export interface DuelAnswer extends DuelGuess {
  seat: number;
}

/** A round every player is done with: the only rounds whose answers are shown. */
export interface DuelRound {
  targetId: string;
  /** One per player, by seat. */
  answers: readonly DuelAnswer[];
}

/** A seated player, as others see them: a seat and a pseudo, never an account id. */
export interface DuelPlayer {
  /** 0 for the host; stable for the whole duel. */
  seat: number;
  pseudo: string | null;
  isMe: boolean;
  isHost: boolean;
  /** Sum of the resolved rounds. */
  total: number;
  /** Whether they locked the current round; the answer itself stays hidden until it ends. */
  hasLocked: boolean;
}

/** What one player may see of a duel. Nobody's answer to the current round is in it, except the viewer's own. */
export interface DuelView {
  id: string;
  code: string;
  modeId: string;
  status: DuelStatus;
  /** False for a visitor who opened the link of a lobby they have not joined yet. */
  isParticipant: boolean;
  isHost: boolean;
  /** The viewer's own pseudo, seated or not, so a visitor is not asked for it again. */
  myPseudo: string | null;
  /** The viewer's seat, or null for a visitor. */
  mySeat: number | null;
  /** Everyone seated, by seat. */
  players: readonly DuelPlayer[];
  maxPlayers: number;
  roundCount: number;
  /** The host's timings for every round. */
  roundSeconds: number;
  graceSeconds: number;
  roundIndex: number;
  /** Target of the current round; null outside play. */
  currentTargetId: string | null;
  /** Server times (ms since epoch) bounding the current round. */
  roundStartedAt: number | null;
  roundDeadline: number | null;
  /** When the last round ended, once finished. */
  finishedAt: number | null;
  myLock: DuelGuess | null;
  rounds: readonly DuelRound[];
  /** Code of the rematch lobby, once any player asked for one. */
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
  | "started"
  | "too_many_players"
  | "not_enough_players"
  | "too_late"
  | "unavailable";

export type DuelResult<T> = ({ ok: true } & T) | { ok: false; error: DuelError };
