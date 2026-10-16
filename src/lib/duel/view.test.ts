import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { buildDuelView, type DuelViewInput } from "./view";

type DuelRow = Database["public"]["Tables"]["duels"]["Row"];

const HOST = "host";
const BOB = "bob";
const CAROL = "carol";
const NOW = Date.parse("2026-10-17T10:00:00Z");

const DUEL: DuelRow = {
  id: "duel-1",
  code: "AB3XK9",
  mode_id: "fr-nuclear-plants",
  target_ids: ["gravelines", "penly", "flamanville"],
  host_id: HOST,
  max_players: 4,
  status: "playing",
  round_index: 1,
  round_s: 45,
  grace_s: 5,
  round_started_at: "2026-10-17T09:59:50Z",
  round_deadline: "2026-10-17T10:00:35Z",
  version: 4,
  rematch_id: null,
  created_at: "2026-10-17T09:58:00Z",
  finished_at: null,
};

const LOCKED_AT = "2026-10-17T09:59:30Z";
const guess = (round: number, user: string, score: number) => ({
  round_index: round,
  user_id: user,
  lon: 2,
  lat: 50,
  distance_km: 12,
  score,
  locked_at: LOCKED_AT,
});
const timedOut = (round: number, user: string) => ({ round_index: round, user_id: user, lon: null, lat: null, distance_km: null, score: 0, locked_at: null });
/** A pin placed but not locked before the deadline: it scores, unlocked. */
const unlockedPin = (round: number, user: string, score: number) => ({ ...guess(round, user, score), locked_at: null });

function view(overrides: Partial<DuelViewInput> = {}) {
  return buildDuelView({
    duel: DUEL,
    // Out of order on purpose: the view sorts by seat.
    seats: [
      { user_id: CAROL, seat: 2 },
      { user_id: HOST, seat: 0 },
      { user_id: BOB, seat: 1 },
    ],
    guesses: [guess(0, HOST, 4000), timedOut(0, BOB), unlockedPin(0, CAROL, 2500), guess(1, BOB, 4500)],
    viewerId: HOST,
    pseudos: new Map([
      [HOST, "Alice"],
      [BOB, "Bob"],
      [CAROL, "Carol"],
    ]),
    rematchCode: null,
    now: NOW,
    ...overrides,
  });
}

describe("buildDuelView", () => {
  it("lists every player by seat with their totals, and never their account ids", () => {
    const v = view();
    expect(v.players).toEqual([
      { seat: 0, pseudo: "Alice", isMe: true, isHost: true, total: 4000, hasLocked: false },
      { seat: 1, pseudo: "Bob", isMe: false, isHost: false, total: 0, hasLocked: true },
      { seat: 2, pseudo: "Carol", isMe: false, isHost: false, total: 2500, hasLocked: false },
    ]);
    expect(v).toMatchObject({ isHost: true, mySeat: 0, maxPlayers: 4, roundCount: 3, roundSeconds: 45, graceSeconds: 5 });
    expect(JSON.stringify(v)).not.toMatch(/"(host|bob|carol)"/);
  });

  it("shows resolved rounds with every answer, and whether it was locked", () => {
    expect(view().rounds).toEqual([
      {
        targetId: "gravelines",
        answers: [
          { seat: 0, guess: [2, 50], distanceKm: 12, score: 4000, isLocked: true },
          { seat: 1, guess: null, distanceKm: null, score: 0, isLocked: false },
          { seat: 2, guess: [2, 50], distanceKm: 12, score: 2500, isLocked: false },
        ],
      },
    ]);
  });

  it("tells who locked the current round without showing their answer", () => {
    const v = view();
    expect(v.myLock).toBeNull();
    expect(JSON.stringify(v)).not.toContain("4500");
  });

  it("gives the viewer their own lock and the round's timing", () => {
    const v = view({ viewerId: BOB });
    expect(v.myLock).toEqual({ guess: [2, 50], distanceKm: 12, score: 4500, isLocked: true });
    expect(v).toMatchObject({ isHost: false, mySeat: 1, currentTargetId: "penly", roundDeadline: Date.parse(DUEL.round_deadline!) });
  });

  it("shows every round once the duel is finished", () => {
    const v = view({ duel: { ...DUEL, status: "finished", round_index: 2 }, rematchCode: "ZZ9ZZ9" });
    expect(v.rounds).toHaveLength(3);
    expect(v.players[1].total).toBe(4500);
    expect(v.players.every((p) => !p.hasLocked)).toBe(true);
    expect(v.currentTargetId).toBeNull();
    expect(v.rematchCode).toBe("ZZ9ZZ9");
  });

  it("shows a visitor the lobby and who sits in it, with their own pseudo, and nothing else", () => {
    const lobby = { ...DUEL, status: "lobby" as const, round_index: 0 };
    const v = view({ duel: lobby, viewerId: "stranger", rematchCode: "ZZ9ZZ9", pseudos: new Map([[HOST, "Alice"], ["stranger", "Dave"]]) });
    expect(v).toMatchObject({ isParticipant: false, mySeat: null, rounds: [], myLock: null, currentTargetId: null, rematchCode: null });
    expect(v.players.map((p) => p.pseudo)).toEqual(["Alice", null, null]);
    expect(v.myPseudo).toBe("Dave");
  });
});
