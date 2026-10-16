import type { Database } from "@/lib/supabase/database.types";
import type { DuelGuess, DuelPlayer, DuelRound, DuelView } from "./types";

type DuelRow = Database["public"]["Tables"]["duels"]["Row"];
type SeatRow = Pick<Database["public"]["Tables"]["duel_players"]["Row"], "user_id" | "seat">;
type GuessRow = Pick<
  Database["public"]["Tables"]["duel_guesses"]["Row"],
  "round_index" | "user_id" | "lon" | "lat" | "distance_km" | "score" | "locked_at"
>;

export interface DuelViewInput {
  duel: DuelRow;
  seats: readonly SeatRow[];
  guesses: readonly GuessRow[];
  viewerId: string;
  pseudos: ReadonlyMap<string, string>;
  rematchCode: string | null;
  now: number;
}

const NO_GUESS: DuelGuess = { guess: null, distanceKm: null, score: 0, isLocked: false };

function toGuess(row: GuessRow | undefined): DuelGuess {
  if (!row) return NO_GUESS;
  const guess = row.lon === null || row.lat === null ? null : ([row.lon, row.lat] as const);
  return { guess, distanceKm: row.distance_km, score: row.score, isLocked: row.locked_at !== null };
}

function toTime(value: string | null): number | null {
  return value === null ? null : Date.parse(value);
}

/** Rounds every player is done with: every round once finished, else those before the current one. */
function resolvedCount(duel: DuelRow): number {
  if (duel.status === "finished") return duel.target_ids.length;
  return duel.status === "playing" ? duel.round_index : 0;
}

/** Builds what `viewerId` may see of a duel; a visitor sees the lobby and who sits in it. */
export function buildDuelView({ duel, seats, guesses, viewerId, pseudos, rematchCode, now }: DuelViewInput): DuelView {
  const bySeat = [...seats].sort((a, b) => a.seat - b.seat);
  const me = bySeat.find((s) => s.user_id === viewerId);
  const isParticipant = me !== undefined;
  const isPlaying = isParticipant && duel.status === "playing";

  const find = (round: number, user: string) => guesses.find((g) => g.round_index === round && g.user_id === user);
  const rounds: DuelRound[] = isParticipant
    ? duel.target_ids.slice(0, resolvedCount(duel)).map((targetId, i) => ({
        targetId,
        answers: bySeat.map((s) => ({ seat: s.seat, ...toGuess(find(i, s.user_id)) })),
      }))
    : [];
  const players: DuelPlayer[] = bySeat.map((s) => ({
    seat: s.seat,
    pseudo: pseudos.get(s.user_id) ?? null,
    isMe: s.user_id === viewerId,
    isHost: s.user_id === duel.host_id,
    total: rounds.reduce((sum, r) => sum + (r.answers.find((a) => a.seat === s.seat)?.score ?? 0), 0),
    hasLocked: isPlaying && find(duel.round_index, s.user_id) !== undefined,
  }));
  const myLock = isPlaying ? find(duel.round_index, viewerId) : undefined;

  return {
    id: duel.id,
    code: duel.code,
    modeId: duel.mode_id,
    status: duel.status,
    isParticipant,
    isHost: viewerId === duel.host_id,
    myPseudo: pseudos.get(viewerId) ?? null,
    mySeat: me?.seat ?? null,
    players,
    maxPlayers: duel.max_players,
    roundCount: duel.target_ids.length,
    roundSeconds: duel.round_s,
    graceSeconds: duel.grace_s,
    roundIndex: duel.round_index,
    currentTargetId: isPlaying ? (duel.target_ids[duel.round_index] ?? null) : null,
    roundStartedAt: isPlaying ? toTime(duel.round_started_at) : null,
    roundDeadline: isPlaying ? toTime(duel.round_deadline) : null,
    finishedAt: isParticipant ? toTime(duel.finished_at) : null,
    myLock: myLock ? toGuess(myLock) : null,
    rounds,
    rematchCode: isParticipant ? rematchCode : null,
    serverNow: now,
  };
}
