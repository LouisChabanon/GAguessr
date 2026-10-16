import type { Database } from "@/lib/supabase/database.types";
import type { DuelGuess, DuelRound, DuelView } from "./types";

type DuelRow = Database["public"]["Tables"]["duels"]["Row"];
type GuessRow = Pick<Database["public"]["Tables"]["duel_guesses"]["Row"], "round_index" | "user_id" | "lon" | "lat" | "distance_km" | "score">;

export interface DuelViewInput {
  duel: DuelRow;
  guesses: readonly GuessRow[];
  viewerId: string;
  pseudos: ReadonlyMap<string, string>;
  rematchCode: string | null;
  now: number;
}

const NO_GUESS: DuelGuess = { guess: null, distanceKm: null, score: 0 };

function toGuess(row: GuessRow | undefined): DuelGuess {
  if (!row) return NO_GUESS;
  const guess = row.lon === null || row.lat === null ? null : ([row.lon, row.lat] as const);
  return { guess, distanceKm: row.distance_km, score: row.score };
}

function toTime(value: string | null): number | null {
  return value === null ? null : Date.parse(value);
}

/** Rounds both players are done with: every round once finished, else those before the current one. */
function resolvedCount(duel: DuelRow): number {
  if (duel.status === "finished") return duel.target_ids.length;
  return duel.status === "playing" ? duel.round_index : 0;
}

/** Builds what `viewerId` may see of a duel; a visitor sees the lobby only. */
export function buildDuelView({ duel, guesses, viewerId, pseudos, rematchCode, now }: DuelViewInput): DuelView {
  const isHost = viewerId === duel.host_id;
  const isParticipant = isHost || viewerId === duel.guest_id;
  const opponentId = isHost ? duel.guest_id : duel.host_id;
  const isPlaying = isParticipant && duel.status === "playing";

  const find = (round: number, user: string | null) => guesses.find((g) => g.round_index === round && g.user_id === user);
  const rounds: DuelRound[] = isParticipant
    ? duel.target_ids.slice(0, resolvedCount(duel)).map((targetId, i) => ({
        targetId,
        me: toGuess(find(i, viewerId)),
        opponent: toGuess(find(i, opponentId)),
      }))
    : [];
  const myLock = isPlaying ? find(duel.round_index, viewerId) : undefined;

  return {
    id: duel.id,
    code: duel.code,
    modeId: duel.mode_id,
    status: duel.status,
    isParticipant,
    isHost,
    myPseudo: pseudos.get(viewerId) ?? null,
    opponentPseudo: opponentId ? (pseudos.get(opponentId) ?? null) : null,
    roundCount: duel.target_ids.length,
    roundIndex: duel.round_index,
    currentTargetId: isPlaying ? (duel.target_ids[duel.round_index] ?? null) : null,
    roundStartedAt: isPlaying ? toTime(duel.round_started_at) : null,
    roundDeadline: isPlaying ? toTime(duel.round_deadline) : null,
    finishedAt: isParticipant ? toTime(duel.finished_at) : null,
    myLock: myLock ? toGuess(myLock) : null,
    opponentLocked: isPlaying && find(duel.round_index, opponentId) !== undefined,
    rounds,
    rematchCode: isParticipant ? rematchCode : null,
    serverNow: now,
  };
}
