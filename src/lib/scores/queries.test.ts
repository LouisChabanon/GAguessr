import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ publicSupabase: () => ({ rpc }) }));

const { getCrowdData, getLeaderboard, getModeOverview } = await import("./queries");
const { cacheTag } = await import("next/cache");

/** A PostgREST builder: awaitable, with `.single()`. */
function result<T>(data: T, error: unknown = null) {
  const value = { data, error };
  return Object.assign(Promise.resolve(value), { single: () => Promise.resolve(value) });
}

describe("score queries", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("groups crowd guesses by site and counts within the mode's scale", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "target_stats"
        ? result([{ target_id: "gravelines", plays: 8, avg_score: 3000, median_km: 40, within_share: 0.75 }])
        : result([
            { target_id: "gravelines", lon: 2, lat: 51 },
            { target_id: "gravelines", lon: 2.2, lat: 50.8 },
          ]),
    );
    const crowd = await getCrowdData("fr-nuclear-plants");
    expect(rpc).toHaveBeenCalledWith("target_stats", { p_mode: "fr-nuclear-plants", p_within_km: 100 });
    expect(crowd).toEqual({
      withinKm: 100,
      stats: { gravelines: { plays: 8, avgScore: 3000, medianKm: 40, withinShare: 0.75 } },
      guesses: { gravelines: [[2, 51], [2.2, 50.8]] },
    });
    expect(cacheTag).toHaveBeenCalledWith("stats:fr-nuclear-plants");
  });

  it("maps leaderboard rows and limits the weekly board to the last 7 days", async () => {
    rpc.mockReturnValue(result([{ rank: 1, pseudo: "Lou", total_score: 9000, max_score: 90000, time_ms: 61000, played_at: "2026-10-15T10:00:00Z" }]));
    const rows = await getLeaderboard("fr-nuclear-plants", "week");
    expect(rows).toEqual([{ rank: 1, pseudo: "Lou", totalScore: 9000, maxScore: 90000, timeMs: 61000, playedAt: "2026-10-15T10:00:00Z" }]);
    const since = Date.parse(rpc.mock.calls[0][1].p_since);
    expect(Date.now() - since).toBeCloseTo(7 * 24 * 3600 * 1000, -4);

    await getLeaderboard("fr-nuclear-plants", "all");
    expect(rpc.mock.calls[1][1].p_since).toBeUndefined();
  });

  it("turns averages into a success share", async () => {
    rpc.mockReturnValue(result({ games: 4, players: 3, avg_score: 45000, avg_max_score: 90000 }));
    expect(await getModeOverview("fr-nuclear-plants")).toEqual({ games: 4, players: 3, avgShare: 0.5 });
    rpc.mockReturnValue(result({ games: 0, players: 0, avg_score: null, avg_max_score: null }));
    expect((await getModeOverview("fr-nuclear-plants")).avgShare).toBeNull();
  });

  it("falls back to empty data when Supabase fails", async () => {
    rpc.mockReturnValue(result(null, { message: "down" }));
    expect(await getLeaderboard("fr-nuclear-plants", "all")).toEqual([]);
    expect(await getModeOverview("fr-nuclear-plants")).toEqual({ games: 0, players: 0, avgShare: null });
    expect(await getCrowdData("fr-nuclear-plants")).toEqual({ withinKm: 100, stats: {}, guesses: {} });
    expect(console.error).toHaveBeenCalled();
  });
});
