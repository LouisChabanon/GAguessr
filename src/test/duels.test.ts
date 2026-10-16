import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DUEL_COUNTDOWN_MS,
  DUEL_GRACE_MS,
  DUEL_LOBBY_TTL_MS,
  DUEL_REVEAL_MS,
  DUEL_ROUND_MS,
  DUEL_TOLERANCE_MS,
} from "@/game/duel/rules";
import { asRole, createTestDb } from "./supabaseDb";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";
const MODE = "fr-nuclear-plants";
const TARGETS = ["gravelines", "penly", "flamanville"];

interface DuelRow {
  id: string;
  code: string;
  status: string;
  guest_id: string | null;
  round_index: number;
  version: number;
  rematch_id: string | null;
  /** Seconds from now, as the database sees it. */
  starts_in: number;
  deadline_in: number;
}

interface GuessRow {
  round_index: number;
  user_id: string;
  score: number;
  lon: number | null;
}

const asServer = <T,>(db: PGlite, fn: () => Promise<T>) => asRole(db, "service_role", null, fn);

async function createDuel(db: PGlite, host = ALICE, targets = TARGETS): Promise<string> {
  const res = await asServer(db, () => db.query<{ code: string }>("select public.create_duel($1, $2, $3) as code", [host, MODE, targets]));
  return res.rows[0].code;
}

async function joinDuel(db: PGlite, code: string, user = BOB) {
  await asServer(db, () => db.query("select public.join_duel($1, $2)", [code, user]));
}

async function duel(db: PGlite, code: string): Promise<DuelRow> {
  const res = await db.query<DuelRow>(
    `select id, code, status, guest_id, round_index, version, rematch_id,
            extract(epoch from round_started_at - now())::float as starts_in,
            extract(epoch from round_deadline - now())::float as deadline_in
     from public.duels where code = $1`,
    [code],
  );
  return res.rows[0];
}

async function guesses(db: PGlite, id: string): Promise<GuessRow[]> {
  const res = await db.query<GuessRow>(
    "select round_index, user_id, score, lon from public.duel_guesses where duel_id = $1 order by round_index, user_id",
    [id],
  );
  return res.rows;
}

/** Shifts the current round's timeline `seconds` into the past, as if that much time had passed. */
async function elapse(db: PGlite, id: string, seconds: number) {
  await db.query(
    `update public.duels set
       round_started_at = round_started_at - make_interval(secs => $2),
       round_deadline = round_deadline - make_interval(secs => $2)
     where id = $1`,
    [id, seconds],
  );
  await db.query("update public.duel_guesses set locked_at = locked_at - make_interval(secs => $2) where duel_id = $1", [id, seconds]);
}

async function lock(db: PGlite, id: string, user: string, round: number, score = 4000) {
  await asServer(db, () =>
    db.query("select public.duel_lock($1, $2, $3::smallint, 2.1, 50.9, 12.5, $4)", [id, user, round, score]),
  );
}

async function tick(db: PGlite, id: string) {
  await asServer(db, () => db.query("select public.duel_tick($1)", [id]));
}

/** A joined duel whose first round has started. */
async function startedDuel(db: PGlite, targets = TARGETS): Promise<DuelRow> {
  const code = await createDuel(db, ALICE, targets);
  await joinDuel(db, code);
  const { id } = await duel(db, code);
  await elapse(db, id, DUEL_COUNTDOWN_MS / 1000);
  return duel(db, code);
}

describe("duels migration", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    for (const id of [ALICE, BOB, CAROL]) await db.query("insert into auth.users (id) values ($1)", [id]);
  });

  it("uses the timings the client displays", async () => {
    const res = await db.query("select * from public.duel_rules()");
    expect(res.rows[0]).toEqual({
      round_s: DUEL_ROUND_MS / 1000,
      grace_s: DUEL_GRACE_MS / 1000,
      reveal_s: DUEL_REVEAL_MS / 1000,
      countdown_s: DUEL_COUNTDOWN_MS / 1000,
      tolerance_s: DUEL_TOLERANCE_MS / 1000,
      lobby_ttl_s: DUEL_LOBBY_TTL_MS / 1000,
    });
  });

  describe("security", () => {
    it("denies every duel function to clients", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        await expect(
          asRole(db, role, ALICE, () => db.query("select public.create_duel($1, $2, $3)", [ALICE, MODE, TARGETS])),
        ).rejects.toThrow(/permission denied/);
        await expect(asRole(db, role, ALICE, () => db.query("select public.duel_tick(gen_random_uuid())"))).rejects.toThrow(
          /permission denied/,
        );
      }
    });

    it("shows a duel's row to its players only, and guesses to nobody", async () => {
      const code = await createDuel(db);
      await joinDuel(db, code);
      const read = (user: string) => asRole(db, "authenticated", user, () => db.query("select id from public.duels"));
      expect((await read(ALICE)).rows).toHaveLength(1);
      expect((await read(BOB)).rows).toHaveLength(1);
      expect((await read(CAROL)).rows).toHaveLength(0);
      await expect(asRole(db, "anon", null, () => db.query("select id from public.duels"))).rejects.toThrow(/permission denied/);
      await expect(asRole(db, "authenticated", ALICE, () => db.query("select * from public.duel_guesses"))).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        asRole(db, "authenticated", ALICE, () => db.query("update public.duels set status = 'finished'")),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("lobby", () => {
    it("opens a lobby with an unambiguous code and cancels the host's previous one", async () => {
      const first = await createDuel(db);
      const second = await createDuel(db);
      expect(second).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect((await duel(db, first)).status).toBe("cancelled");
      expect((await duel(db, second)).status).toBe("lobby");
    });

    it("starts the first round after the countdown when the guest joins", async () => {
      const code = await createDuel(db);
      await joinDuel(db, code);
      const row = await duel(db, code);
      expect(row).toMatchObject({ status: "playing", guest_id: BOB, round_index: 0 });
      expect(row.starts_in).toBeCloseTo(DUEL_COUNTDOWN_MS / 1000, 1);
      expect(row.deadline_in).toBeCloseTo((DUEL_COUNTDOWN_MS + DUEL_ROUND_MS) / 1000, 1);
    });

    it("lets a player rejoin their own duel but turns a third one away", async () => {
      const code = await createDuel(db);
      await joinDuel(db, code, ALICE);
      expect((await duel(db, code)).status).toBe("lobby");
      await joinDuel(db, code);
      await joinDuel(db, code);
      await expect(joinDuel(db, code, CAROL)).rejects.toThrow(/full/);
    });

    it("refuses unknown, cancelled and expired lobbies", async () => {
      await expect(joinDuel(db, "ZZZZZZ")).rejects.toThrow(/not_found/);
      const cancelled = await createDuel(db);
      await createDuel(db);
      await expect(joinDuel(db, cancelled)).rejects.toThrow(/not_found/);
      const old = await createDuel(db, CAROL);
      await db.query("update public.duels set created_at = now() - interval '25 hours' where code = $1", [old]);
      await expect(joinDuel(db, old)).rejects.toThrow(/expired/);
    });
  });

  describe("rounds", () => {
    it("refuses locks before the round starts and from outsiders", async () => {
      const code = await createDuel(db);
      await joinDuel(db, code);
      const { id } = await duel(db, code);
      await expect(lock(db, id, ALICE, 0)).rejects.toThrow(/not_started/);
      await elapse(db, id, DUEL_COUNTDOWN_MS / 1000);
      await expect(lock(db, id, CAROL, 0)).rejects.toThrow(/not_participant/);
      await expect(lock(db, id, ALICE, 1)).rejects.toThrow(/wrong_round/);
    });

    it("leaves the other player the grace period after the first lock", async () => {
      const { id, code } = await startedDuel(db);
      await lock(db, id, ALICE, 0);
      const row = await duel(db, code);
      expect(row.round_index).toBe(0);
      expect(row.deadline_in).toBeCloseTo(DUEL_GRACE_MS / 1000, 1);
      await expect(lock(db, id, ALICE, 0)).rejects.toThrow(/already_locked/);
    });

    it("never extends a deadline that is closer than the grace period", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, DUEL_ROUND_MS / 1000 - 2);
      await lock(db, id, ALICE, 0);
      expect((await duel(db, code)).deadline_in).toBeCloseTo(2, 1);
    });

    it("reveals and moves on as soon as both players lock", async () => {
      const { id, code, version } = await startedDuel(db);
      await lock(db, id, ALICE, 0, 4000);
      await lock(db, id, BOB, 0, 3000);
      const row = await duel(db, code);
      expect(row.round_index).toBe(1);
      expect(row.version).toBeGreaterThan(version);
      expect(row.starts_in).toBeCloseTo(DUEL_REVEAL_MS / 1000, 1);
      expect(await guesses(db, id)).toEqual([
        { round_index: 0, user_id: ALICE, score: 4000, lon: 2.1 },
        { round_index: 0, user_id: BOB, score: 3000, lon: 2.1 },
      ]);
    });

    it("scores 0 for a player who runs out of time, once someone ticks", async () => {
      const { id, code } = await startedDuel(db);
      await lock(db, id, ALICE, 0, 4000);
      await tick(db, id);
      expect((await duel(db, code)).round_index).toBe(0);

      await elapse(db, id, (DUEL_GRACE_MS + DUEL_TOLERANCE_MS) / 1000 + 0.1);
      await tick(db, id);
      const row = await duel(db, code);
      expect(row.round_index).toBe(1);
      // The reveal counts from the deadline, not from the tick.
      expect(row.starts_in).toBeCloseTo(DUEL_REVEAL_MS / 1000 - DUEL_TOLERANCE_MS / 1000 - 0.1, 1);
      expect(await guesses(db, id)).toEqual([
        { round_index: 0, user_id: ALICE, score: 4000, lon: 2.1 },
        { round_index: 0, user_id: BOB, score: 0, lon: null },
      ]);
    });

    it("still takes a lock within the latency slack after the deadline", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, DUEL_ROUND_MS / 1000 + DUEL_TOLERANCE_MS / 2000);
      await lock(db, id, BOB, 0);
      expect((await duel(db, code)).round_index).toBe(0);
    });

    it("catches up on every round that ran out while nobody was there", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, 2 * (DUEL_ROUND_MS + DUEL_REVEAL_MS) / 1000 + DUEL_ROUND_MS / 2000);
      await tick(db, id);
      const row = await duel(db, code);
      expect(row.round_index).toBe(2);
      expect(row.status).toBe("playing");
      expect(await guesses(db, id)).toHaveLength(4);
    });

    it("finishes after the last round and then refuses locks", async () => {
      const { id, code } = await startedDuel(db, ["gravelines"]);
      await lock(db, id, ALICE, 0);
      await lock(db, id, BOB, 0);
      expect((await duel(db, code)).status).toBe("finished");
      await expect(lock(db, id, ALICE, 1)).rejects.toThrow(/not_playing/);
    });
  });

  describe("rematch", () => {
    it("opens one lobby for both players, which the other joins", async () => {
      const { id, code } = await startedDuel(db, ["gravelines"]);
      await expect(
        asServer(db, () => db.query("select public.duel_rematch($1, $2, $3)", [id, BOB, ["penly"]])),
      ).rejects.toThrow(/not_finished/);
      await lock(db, id, ALICE, 0);
      await lock(db, id, BOB, 0);

      const rematch = (user: string) =>
        asServer(db, () => db.query<{ code: string }>("select public.duel_rematch($1, $2, $3) as code", [id, user, ["penly"]]));
      const first = (await rematch(BOB)).rows[0].code;
      const second = (await rematch(ALICE)).rows[0].code;
      expect(second).toBe(first);
      expect((await duel(db, code)).rematch_id).not.toBeNull();
      await expect(rematch(CAROL)).rejects.toThrow(/not_found/);

      await joinDuel(db, first, ALICE);
      expect(await duel(db, first)).toMatchObject({ status: "playing", guest_id: ALICE });
    });
  });
});
