import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { buildDuelView, type DuelViewInput } from "./view";

type DuelRow = Database["public"]["Tables"]["duels"]["Row"];

const HOST = "host";
const GUEST = "guest";
const NOW = Date.parse("2026-10-17T10:00:00Z");

const DUEL: DuelRow = {
  id: "duel-1",
  code: "AB3XK9",
  mode_id: "fr-nuclear-plants",
  target_ids: ["gravelines", "penly", "flamanville"],
  host_id: HOST,
  guest_id: GUEST,
  status: "playing",
  round_index: 1,
  round_started_at: "2026-10-17T09:59:50Z",
  round_deadline: "2026-10-17T10:00:35Z",
  version: 4,
  rematch_id: null,
  created_at: "2026-10-17T09:58:00Z",
  finished_at: null,
};

const guess = (round: number, user: string, score: number) => ({
  round_index: round,
  user_id: user,
  lon: 2,
  lat: 50,
  distance_km: 12,
  score,
});

function view(overrides: Partial<DuelViewInput> = {}) {
  return buildDuelView({
    duel: DUEL,
    guesses: [guess(0, HOST, 4000), { ...guess(0, GUEST, 0), lon: null, lat: null, distance_km: null }, guess(1, GUEST, 4500)],
    viewerId: HOST,
    pseudos: new Map([
      [HOST, "Alice"],
      [GUEST, "Bob"],
    ]),
    rematchCode: null,
    now: NOW,
    ...overrides,
  });
}

describe("buildDuelView", () => {
  it("shows resolved rounds from the viewer's side", () => {
    const v = view();
    expect(v.rounds).toEqual([
      {
        targetId: "gravelines",
        me: { guess: [2, 50], distanceKm: 12, score: 4000 },
        opponent: { guess: null, distanceKm: null, score: 0 },
      },
    ]);
    expect(v).toMatchObject({ isHost: true, isParticipant: true, myPseudo: "Alice", opponentPseudo: "Bob", roundCount: 3 });
  });

  it("tells that the opponent locked the current round without showing their answer", () => {
    const v = view();
    expect(v.opponentLocked).toBe(true);
    expect(v.myLock).toBeNull();
    expect(JSON.stringify(v)).not.toContain("4500");
  });

  it("gives the viewer their own lock and the round's timing", () => {
    const v = view({ viewerId: GUEST });
    expect(v.myLock).toEqual({ guess: [2, 50], distanceKm: 12, score: 4500 });
    expect(v.opponentLocked).toBe(false);
    expect(v.currentTargetId).toBe("penly");
    expect(v.roundDeadline).toBe(Date.parse(DUEL.round_deadline!));
  });

  it("shows every round once the duel is finished", () => {
    const v = view({ duel: { ...DUEL, status: "finished", round_index: 2 }, rematchCode: "ZZ9ZZ9" });
    expect(v.rounds).toHaveLength(3);
    expect(v.rounds[1].opponent.score).toBe(4500);
    expect(v.currentTargetId).toBeNull();
    expect(v.rematchCode).toBe("ZZ9ZZ9");
  });

  it("knows a visitor's own pseudo, so they are not asked for it again", () => {
    const v = view({ viewerId: "stranger", pseudos: new Map([[HOST, "Alice"], ["stranger", "Carol"]]) });
    expect(v.myPseudo).toBe("Carol");
  });

  it("shows a visitor nothing but the lobby and its host", () => {
    const v = view({ viewerId: "stranger", rematchCode: "ZZ9ZZ9" });
    expect(v).toMatchObject({ isParticipant: false, opponentPseudo: "Alice", rounds: [], myLock: null, currentTargetId: null, rematchCode: null });
    expect(v.opponentLocked).toBe(false);
  });
});
