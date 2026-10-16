import { describe, expect, it } from "vitest";
import { defaultDuelSettings, duelSettingsSchema, roundCountChoices, withRoundSeconds } from "./settings";

describe("duel settings", () => {
  it("defaults to a solo game's length and the standard timings", () => {
    expect(defaultDuelSettings({ roundsPerGame: "all" }, 18)).toEqual({ maxPlayers: 2, rounds: 18, roundSeconds: 45, graceSeconds: 5 });
    expect(defaultDuelSettings({ roundsPerGame: 10 }, 173).rounds).toBe(10);
  });

  it("accepts settings within bounds", () => {
    expect(duelSettingsSchema(18).safeParse({ maxPlayers: 8, rounds: 18, roundSeconds: 10, graceSeconds: 10 }).success).toBe(true);
  });

  it.each([
    ["more rounds than sites", { maxPlayers: 2, rounds: 19, roundSeconds: 45, graceSeconds: 5 }],
    ["no round", { maxPlayers: 2, rounds: 0, roundSeconds: 45, graceSeconds: 5 }],
    ["a round too short", { maxPlayers: 2, rounds: 5, roundSeconds: 5, graceSeconds: 5 }],
    ["a round too long", { maxPlayers: 2, rounds: 5, roundSeconds: 301, graceSeconds: 5 }],
    ["a grace longer than the round", { maxPlayers: 2, rounds: 5, roundSeconds: 15, graceSeconds: 20 }],
    ["a single player", { maxPlayers: 1, rounds: 5, roundSeconds: 45, graceSeconds: 5 }],
    ["more than eight players", { maxPlayers: 9, rounds: 5, roundSeconds: 45, graceSeconds: 5 }],
    ["fractional seconds", { maxPlayers: 2, rounds: 5, roundSeconds: 45.5, graceSeconds: 5 }],
  ])("rejects %s", (_, settings) => {
    expect(duelSettingsSchema(18).safeParse(settings).success).toBe(false);
  });

  it("offers the presets that fit the pool, then every site", () => {
    expect(roundCountChoices(18)).toEqual([3, 5, 10, 18]);
    expect(roundCountChoices(10)).toEqual([3, 5, 10]);
    expect(roundCountChoices(4)).toEqual([3, 4]);
    expect(roundCountChoices(173)).toEqual([3, 5, 10, 20, 173]);
  });

  it("shortens the grace when the round becomes shorter than it", () => {
    expect(withRoundSeconds({ maxPlayers: 2, rounds: 5, roundSeconds: 45, graceSeconds: 15 }, 10)).toEqual({ maxPlayers: 2, rounds: 5, roundSeconds: 10, graceSeconds: 10 });
    expect(withRoundSeconds({ maxPlayers: 2, rounds: 5, roundSeconds: 45, graceSeconds: 5 }, 90).graceSeconds).toBe(5);
  });
});
