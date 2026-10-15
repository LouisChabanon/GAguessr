import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "./supabaseDb";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";
const MODE = "fr-nuclear-plants";

interface GuessRow {
  target_id: string;
  round_index: number;
  lon: number;
  lat: number;
  distance_km: number;
  score: number;
}

function guess(target: string, round: number, distanceKm: number, score: number): GuessRow {
  return { target_id: target, round_index: round, lon: 2 + round, lat: 46, distance_km: distanceKm, score };
}

async function insertGame(db: PGlite, user: string, total: number, timeMs: number, guesses: GuessRow[], minInterval = "0 seconds") {
  const payload = { user_id: user, mode_id: MODE, total_score: total, max_score: 10_000, time_ms: timeMs, guesses };
  return asRole(db, "service_role", null, async () => {
    const res = await db.query<{ id: string }>("select public.insert_game($1::jsonb, $2::interval) as id", [JSON.stringify(payload), minInterval]);
    return res.rows[0].id;
  });
}

async function setPseudo(db: PGlite, user: string, pseudo: string) {
  await db.query("insert into public.profiles (id, pseudo) values ($1, $2)", [user, pseudo]);
}

describe("scores and stats migration", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    for (const id of [ALICE, BOB, CAROL]) await db.query("insert into auth.users (id) values ($1)", [id]);
  });

  describe("security", () => {
    it("denies direct writes and reads of games to anon and authenticated", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        await expect(
          asRole(db, role, ALICE, () =>
            db.query("insert into public.games (user_id, mode_id, total_score, max_score, time_ms, rounds) values ($1, $2, 1, 1, 1, 1)", [ALICE, MODE]),
          ),
        ).rejects.toThrow(/permission denied/);
        await expect(asRole(db, role, ALICE, () => db.query("select * from public.guesses"))).rejects.toThrow(/permission denied/);
      }
    });

    it("denies insert_game and game_standing to clients", async () => {
      await expect(
        asRole(db, "authenticated", ALICE, () => db.query("select public.insert_game('{}'::jsonb, '0 seconds')")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, "anon", null, () => db.query("select * from public.game_standing(gen_random_uuid())")),
      ).rejects.toThrow(/permission denied/);
    });

    it("lets a player name only themselves", async () => {
      await asRole(db, "authenticated", ALICE, () => db.query("insert into public.profiles (id, pseudo) values ($1, 'Alice')", [ALICE]));
      await expect(
        asRole(db, "authenticated", ALICE, () => db.query("insert into public.profiles (id, pseudo) values ($1, 'Bob')", [BOB])),
      ).rejects.toThrow(/row-level security/);
      const others = await asRole(db, "authenticated", BOB, () => db.query("select * from public.profiles"));
      expect(others.rows).toHaveLength(0);
    });

    it("rejects malformed and case-insensitively duplicated pseudos", async () => {
      await expect(setPseudo(db, ALICE, "a")).rejects.toThrow(/check/);
      await expect(setPseudo(db, ALICE, " padded ")).rejects.toThrow(/check/);
      await expect(setPseudo(db, ALICE, "<script>")).rejects.toThrow(/check/);
      await setPseudo(db, ALICE, "Élodie");
      await expect(setPseudo(db, BOB, "élodie")).rejects.toThrow(/duplicate/);
    });
  });

  describe("insert_game", () => {
    it("stores the game and its guesses", async () => {
      const id = await insertGame(db, ALICE, 7000, 30_000, [guess("gravelines", 0, 10, 4000), guess("penly", 1, 50, 3000)]);
      const game = await db.query<{ rounds: number }>("select rounds from public.games where id = $1", [id]);
      expect(game.rows[0].rounds).toBe(2);
      const guesses = await db.query("select * from public.guesses where game_id = $1", [id]);
      expect(guesses.rows).toHaveLength(2);
    });

    it("refuses a second game of the same mode within the interval", async () => {
      await insertGame(db, ALICE, 7000, 30_000, [guess("gravelines", 0, 10, 4000)], "1 minute");
      await expect(insertGame(db, ALICE, 7000, 30_000, [guess("gravelines", 0, 10, 4000)], "1 minute")).rejects.toThrow(/too_soon/);
      await expect(insertGame(db, BOB, 7000, 30_000, [guess("gravelines", 0, 10, 4000)], "1 minute")).resolves.toBeTypeOf("string");
    });

    it("rolls the whole game back when a guess is invalid", async () => {
      await expect(insertGame(db, ALICE, 7000, 30_000, [guess("gravelines", 0, 10, 4000), { ...guess("penly", 1, 5, 1), lat: 99 }])).rejects.toThrow();
      const games = await db.query("select * from public.games");
      expect(games.rows).toHaveLength(0);
    });
  });

  describe("leaderboard", () => {
    beforeEach(async () => {
      await setPseudo(db, ALICE, "Alice");
      await setPseudo(db, BOB, "Bob");
      await insertGame(db, ALICE, 5000, 20_000, [guess("gravelines", 0, 30, 5000)]);
      await insertGame(db, ALICE, 8000, 40_000, [guess("gravelines", 0, 5, 8000)]);
      await insertGame(db, BOB, 8000, 30_000, [guess("gravelines", 0, 5, 8000)]);
      await insertGame(db, CAROL, 9900, 10_000, [guess("gravelines", 0, 1, 9900)]); // no pseudo
    });

    it("keeps each named player's best game, faster first on ties", async () => {
      const res = await asRole(db, "anon", null, () =>
        db.query<{ rank: number; pseudo: string; total_score: number }>("select rank::int, pseudo, total_score from public.leaderboard($1)", [MODE]),
      );
      expect(res.rows).toEqual([
        { rank: 1, pseudo: "Bob", total_score: 8000 },
        { rank: 2, pseudo: "Alice", total_score: 8000 },
      ]);
    });

    it("only counts games since the given date", async () => {
      await db.query("update public.games set created_at = now() - interval '30 days' where user_id = $1", [BOB]);
      const res = await db.query<{ pseudo: string }>("select pseudo from public.leaderboard($1, now() - interval '7 days')", [MODE]);
      expect(res.rows.map((r) => r.pseudo)).toEqual(["Alice"]);
    });

    it("places a game against every other game and named player", async () => {
      const id = await insertGame(db, CAROL, 6000, 10_000, [guess("gravelines", 0, 20, 6000)]);
      const res = await asRole(db, "service_role", null, () =>
        db.query<{ percentile: number; rank: number; games: number }>("select percentile, rank::int, games::int from public.game_standing($1)", [id]),
      );
      // Lower: the 5000 game, out of 5 games. Above it: Alice and Bob (Carol's own 9900 is ignored).
      expect(res.rows[0]).toEqual({ percentile: 0.2, rank: 3, games: 5 });
    });
  });

  describe("stats", () => {
    beforeEach(async () => {
      await insertGame(db, ALICE, 6000, 1, [guess("gravelines", 0, 10, 4000), guess("penly", 1, 300, 2000)]);
      await insertGame(db, BOB, 2000, 1, [guess("gravelines", 0, 30, 1000), guess("penly", 1, 500, 1000)]);
    });

    it("summarises how well each site is known", async () => {
      const res = await asRole(db, "anon", null, () =>
        db.query("select target_id, plays::int, avg_score, median_km, within_share from public.target_stats($1, 100) order by target_id", [MODE]),
      );
      expect(res.rows).toEqual([
        { target_id: "gravelines", plays: 2, avg_score: 2500, median_km: 20, within_share: 1 },
        { target_id: "penly", plays: 2, avg_score: 1500, median_km: 400, within_share: 0 },
      ]);
    });

    it("samples the latest guesses per site", async () => {
      const res = await asRole(db, "anon", null, () => db.query("select * from public.mode_guess_sample($1, 1)", [MODE]));
      expect(res.rows).toHaveLength(2);
    });

    it("gives a mode overview", async () => {
      const res = await asRole(db, "anon", null, () =>
        db.query("select games::int, players::int, avg_score from public.mode_overview($1)", [MODE]),
      );
      expect(res.rows[0]).toEqual({ games: 2, players: 2, avg_score: 4000 });
    });
  });
});
