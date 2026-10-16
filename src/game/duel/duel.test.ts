import { describe, expect, it } from "vitest";
import type { DuelPlayer, DuelRound } from "@/lib/duel/types";
import { normalizeDuelCode } from "./code";
import { duelStandings, duelVerdict } from "./outcome";
import { deriveDuelPhase, remainingMs, revealEndsAt } from "./phase";
import { DUEL_REVEAL_MS } from "./rules";

const round = (...scores: number[]): DuelRound => ({
  targetId: "t",
  answers: scores.map((score, seat) => ({ seat, guess: null, distanceKm: null, score })),
});

describe("normalizeDuelCode", () => {
  it("accepts typed codes in any case, with spaces or dashes", () => {
    expect(normalizeDuelCode("ab3 xk9")).toBe("AB3XK9");
    expect(normalizeDuelCode("AB3-XK9")).toBe("AB3XK9");
  });

  it("rejects look-alike characters and wrong lengths", () => {
    expect(normalizeDuelCode("AB0XK9")).toBeNull();
    expect(normalizeDuelCode("ABIXK9")).toBeNull();
    expect(normalizeDuelCode("AB3XK")).toBeNull();
    expect(normalizeDuelCode("")).toBeNull();
  });
});

describe("deriveDuelPhase", () => {
  const playing = { status: "playing" as const, roundStartedAt: 1_000, finishedAt: null, myLock: null, rounds: [] };

  it("passes through the statuses outside play", () => {
    for (const status of ["lobby", "cancelled", "finished"] as const) {
      expect(deriveDuelPhase({ ...playing, status }, 0)).toBe(status);
    }
  });

  it("reveals the last round before showing the result", () => {
    const finished = { ...playing, status: "finished" as const, finishedAt: 10_000, rounds: [round(1, 2)] };
    expect(revealEndsAt(finished)).toBe(10_000 + DUEL_REVEAL_MS);
    expect(deriveDuelPhase(finished, 10_000 + DUEL_REVEAL_MS - 1)).toBe("reveal");
    expect(deriveDuelPhase(finished, 10_000 + DUEL_REVEAL_MS)).toBe("finished");
  });

  it("counts down before the first round and reveals before the next ones", () => {
    expect(deriveDuelPhase(playing, 500)).toBe("countdown");
    expect(deriveDuelPhase({ ...playing, rounds: [round(1, 2)] }, 500)).toBe("reveal");
  });

  it("is guessing once the round starts, locked once the player locked", () => {
    expect(deriveDuelPhase(playing, 1_000)).toBe("guessing");
    expect(deriveDuelPhase({ ...playing, myLock: { guess: [2, 46], distanceKm: 1, score: 4900 } }, 1_500)).toBe("locked");
  });
});

describe("remainingMs", () => {
  it("never goes below zero", () => {
    expect(remainingMs(5_000, 1_000)).toBe(4_000);
    expect(remainingMs(5_000, 9_000)).toBe(0);
    expect(remainingMs(null, 0)).toBe(0);
  });
});

describe("duelStandings", () => {
  const player = (seat: number, total: number, isMe = false): DuelPlayer => ({ seat, pseudo: `P${seat}`, isMe, isHost: seat === 0, total, hasLocked: false });

  it("ranks by total, sharing places on ties and skipping the next", () => {
    const standings = duelStandings([player(0, 3000, true), player(1, 5000), player(2, 3000), player(3, 1000)]);
    expect(standings.map((s) => [s.player.seat, s.place])).toEqual([
      [1, 1],
      [0, 2],
      [2, 2],
      [3, 4],
    ]);
    expect(duelVerdict(standings)).toEqual({ kind: "place", place: 2 });
  });

  it("calls an outright first place a win, and a shared one a tie", () => {
    expect(duelVerdict(duelStandings([player(0, 4000, true), player(1, 1000)]))).toEqual({ kind: "win" });
    expect(duelVerdict(duelStandings([player(0, 4000, true), player(1, 4000)]))).toEqual({ kind: "tie" });
  });
});
