import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { DUEL_COUNTDOWN_MS, DUEL_LOBBY_TTL_MS, DUEL_REVEAL_MS, DUEL_TOLERANCE_MS } from "@/game/duel/rules";
import { DUEL_GRACE_SECONDS, DUEL_PLAYERS, DUEL_ROUND_SECONDS } from "@/game/duel/settings";
import { applyMigrationsAfter, asRole, createTestDb } from "./supabaseDb";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";
const DAVE = "00000000-0000-4000-8000-00000000000d";
const MODE = "fr-nuclear-plants";
const TARGETS = ["gravelines", "penly", "flamanville"];
// Seconds; deliberately not the defaults, so the tests prove each duel uses its own.
const ROUND_S = 30;
const GRACE_S = 8;

interface DuelRow {
  id: string;
  code: string;
  status: string;
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

async function call(db: PGlite, sql: string, params: unknown[]) {
  return asServer(db, () => db.query(sql, params));
}

async function createDuel(db: PGlite, { host = ALICE, targets = TARGETS, maxPlayers = 2 } = {}): Promise<string> {
  const res = await asServer(db, () =>
    db.query<{ code: string }>("select public.create_duel($1, $2, $3, $4::smallint, $5::smallint, $6::smallint) as code", [
      host,
      MODE,
      targets,
      ROUND_S,
      GRACE_S,
      maxPlayers,
    ]),
  );
  return res.rows[0].code;
}

const configure = (db: PGlite, id: string, user: string, targets: string[], roundS: number, graceS: number, maxPlayers: number) =>
  call(db, "select public.configure_duel($1, $2, $3, $4::smallint, $5::smallint, $6::smallint)", [id, user, targets, roundS, graceS, maxPlayers]);
const joinDuel = (db: PGlite, code: string, user = BOB) => call(db, "select public.join_duel($1, $2)", [code, user]);
const startDuel = (db: PGlite, id: string, user = ALICE) => call(db, "select public.start_duel($1, $2)", [id, user]);
const leaveDuel = (db: PGlite, id: string, user: string) => call(db, "select public.leave_duel($1, $2)", [id, user]);
const tick = (db: PGlite, id: string) => call(db, "select public.duel_tick($1)", [id]);
const lock = (db: PGlite, id: string, user: string, round: number, score = 4000) =>
  call(db, "select public.duel_lock($1, $2, $3::smallint, 2.1, 50.9, 12.5, $4)", [id, user, round, score]);
const pin = (db: PGlite, id: string, user: string, round: number, score: number, lon = 3.3) =>
  call(db, "select public.duel_pin($1, $2, $3::smallint, $5, 48.1, 99.5, $4)", [id, user, round, score, lon]);

async function duel(db: PGlite, code: string): Promise<DuelRow> {
  const res = await db.query<DuelRow>(
    `select id, code, status, round_index, version, rematch_id,
            extract(epoch from round_started_at - now())::float as starts_in,
            extract(epoch from round_deadline - now())::float as deadline_in
     from public.duels where code = $1`,
    [code],
  );
  return res.rows[0];
}

async function seats(db: PGlite, id: string): Promise<Record<string, number>> {
  const res = await db.query<{ user_id: string; seat: number }>("select user_id, seat from public.duel_players where duel_id = $1", [id]);
  return Object.fromEntries(res.rows.map((r) => [r.user_id, r.seat]));
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

/** A full duel whose first round has started. */
async function startedDuel(db: PGlite, { targets = TARGETS, players = [BOB] } = {}): Promise<DuelRow> {
  const code = await createDuel(db, { targets, maxPlayers: players.length + 1 });
  for (const player of players) await joinDuel(db, code, player);
  const { id } = await duel(db, code);
  await elapse(db, id, DUEL_COUNTDOWN_MS / 1000);
  return duel(db, code);
}

describe("upgrade from 1v1 duels", () => {
  const ONE_V_ONE = "20261017090000_duels.sql";

  it("seats the host and the guest of existing duels, which then play on", async () => {
    const db = await createTestDb({ until: ONE_V_ONE });
    for (const id of [ALICE, BOB, CAROL]) await db.query("insert into auth.users (id) values ($1)", [id]);
    await db.query(
      `insert into public.duels (code, mode_id, target_ids, host_id, guest_id, status, round_started_at, round_deadline)
       values ('AAAAAA', $1, $2, $3, $4, 'playing', now() - interval '10 seconds', now() + interval '35 seconds'),
              ('BBBBBB', $1, $2, $5, null, 'lobby', null, null)`,
      [MODE, TARGETS, ALICE, BOB, CAROL],
    );

    await applyMigrationsAfter(db, ONE_V_ONE);

    const playing = await duel(db, "AAAAAA");
    const lobby = await duel(db, "BBBBBB");
    expect(await seats(db, playing.id)).toEqual({ [ALICE]: 0, [BOB]: 1 });
    expect(await seats(db, lobby.id)).toEqual({ [CAROL]: 0 });
    const settings = await db.query("select round_s, grace_s, max_players from public.duels where code = 'AAAAAA'");
    expect(settings.rows[0]).toEqual({ round_s: DUEL_ROUND_SECONDS.default, grace_s: DUEL_GRACE_SECONDS.default, max_players: 2 });

    // The duel in progress goes on with its two players, and the lobby takes a guest.
    await lock(db, playing.id, ALICE, 0);
    await lock(db, playing.id, BOB, 0);
    expect((await duel(db, "AAAAAA")).round_index).toBe(1);
    await joinDuel(db, "BBBBBB", ALICE);
    expect((await duel(db, "BBBBBB")).status).toBe("playing");
    const read = await asRole(db, "authenticated", BOB, () => db.query("select code from public.duels"));
    expect(read.rows).toEqual([{ code: "AAAAAA" }]);
    // Builds and migrates a database in two steps: slower than the other tests.
  }, 20_000);
});

describe("duels migration", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    for (const id of [ALICE, BOB, CAROL, DAVE]) await db.query("insert into auth.users (id) values ($1)", [id]);
  });

  it("uses the timings and setting bounds the client knows", async () => {
    const res = await db.query("select * from public.duel_rules()");
    expect(res.rows[0]).toEqual({
      reveal_s: DUEL_REVEAL_MS / 1000,
      countdown_s: DUEL_COUNTDOWN_MS / 1000,
      tolerance_s: DUEL_TOLERANCE_MS / 1000,
      lobby_ttl_s: DUEL_LOBBY_TTL_MS / 1000,
    });

    await db.query("insert into public.duels (code, mode_id, target_ids, host_id) values ('AAAAAA', $1, $2, $3)", [MODE, TARGETS, ALICE]);
    const defaults = await db.query("select round_s, grace_s, max_players from public.duels where code = 'AAAAAA'");
    expect(defaults.rows[0]).toEqual({
      round_s: DUEL_ROUND_SECONDS.default,
      grace_s: DUEL_GRACE_SECONDS.default,
      max_players: DUEL_PLAYERS.default,
    });

    const insert = (roundS: number, graceS: number, maxPlayers = 2) =>
      db.query(
        "insert into public.duels (code, mode_id, target_ids, host_id, round_s, grace_s, max_players) values ('BBBBBB', $1, $2, $3, $4, $5, $6)",
        [MODE, TARGETS, ALICE, roundS, graceS, maxPlayers],
      );
    await expect(insert(DUEL_ROUND_SECONDS.min - 1, 1)).rejects.toThrow(/check/);
    await expect(insert(DUEL_ROUND_SECONDS.max + 1, 1)).rejects.toThrow(/check/);
    await expect(insert(30, DUEL_GRACE_SECONDS.max + 1)).rejects.toThrow(/check/);
    await expect(insert(15, 20)).rejects.toThrow(/check/);
    await expect(insert(30, 5, DUEL_PLAYERS.min - 1)).rejects.toThrow(/check/);
    await expect(insert(30, 5, DUEL_PLAYERS.max + 1)).rejects.toThrow(/check/);
    await expect(insert(DUEL_ROUND_SECONDS.min, DUEL_GRACE_SECONDS.min, DUEL_PLAYERS.max)).resolves.toBeDefined();
  });

  describe("security", () => {
    it("denies every duel function to clients", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        await expect(
          asRole(db, role, ALICE, () =>
            db.query("select public.create_duel($1, $2, $3, 45::smallint, 5::smallint, 2::smallint)", [ALICE, MODE, TARGETS]),
          ),
        ).rejects.toThrow(/permission denied/);
        for (const fn of ["duel_tick(gen_random_uuid())", `start_duel(gen_random_uuid(), '${ALICE}')`, `leave_duel(gen_random_uuid(), '${ALICE}')`]) {
          await expect(asRole(db, role, ALICE, () => db.query(`select public.${fn}`))).rejects.toThrow(/permission denied/);
        }
      }
    });

    it("shows a duel's row to its players only, and seats and guesses to nobody", async () => {
      const code = await createDuel(db, { maxPlayers: 3 });
      await joinDuel(db, code, BOB);
      const read = (user: string) => asRole(db, "authenticated", user, () => db.query("select id from public.duels"));
      expect((await read(ALICE)).rows).toHaveLength(1);
      expect((await read(BOB)).rows).toHaveLength(1);
      expect((await read(CAROL)).rows).toHaveLength(0);
      await expect(asRole(db, "anon", null, () => db.query("select id from public.duels"))).rejects.toThrow(/permission denied/);
      for (const table of ["duel_players", "duel_guesses"]) {
        await expect(asRole(db, "authenticated", ALICE, () => db.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
      }
      await expect(asRole(db, "authenticated", ALICE, () => db.query("update public.duels set status = 'finished'"))).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe("lobby", () => {
    it("opens a lobby with the host seated and cancels the host's previous one", async () => {
      const first = await createDuel(db);
      const second = await createDuel(db);
      expect(second).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect((await duel(db, first)).status).toBe("cancelled");
      const { id, status } = await duel(db, second);
      expect(status).toBe("lobby");
      expect(await seats(db, id)).toEqual({ [ALICE]: 0 });
    });

    it("starts on its own once the room is full", async () => {
      const code = await createDuel(db, { maxPlayers: 3 });
      await joinDuel(db, code, BOB);
      expect((await duel(db, code)).status).toBe("lobby");
      await joinDuel(db, code, CAROL);
      const row = await duel(db, code);
      expect(row).toMatchObject({ status: "playing", round_index: 0 });
      expect(row.starts_in).toBeCloseTo(DUEL_COUNTDOWN_MS / 1000, 0);
      expect(row.deadline_in).toBeCloseTo(DUEL_COUNTDOWN_MS / 1000 + ROUND_S, 0);
      expect(await seats(db, row.id)).toEqual({ [ALICE]: 0, [BOB]: 1, [CAROL]: 2 });
      await expect(joinDuel(db, code, DAVE)).rejects.toThrow(/started/);
    });

    it("lets the host start early, with at least two players", async () => {
      const code = await createDuel(db, { maxPlayers: 4 });
      const { id } = await duel(db, code);
      await expect(startDuel(db, id)).rejects.toThrow(/not_enough_players/);
      await joinDuel(db, code, BOB);
      await expect(startDuel(db, id, BOB)).rejects.toThrow(/not_found/);
      await startDuel(db, id);
      expect((await duel(db, code)).status).toBe("playing");
      await expect(startDuel(db, id)).rejects.toThrow(/started/);
    });

    it("frees a seat when a player leaves, and cancels when the host does", async () => {
      const code = await createDuel(db, { maxPlayers: 3 });
      const { id } = await duel(db, code);
      await joinDuel(db, code, BOB);
      await joinDuel(db, code, ALICE);
      await leaveDuel(db, id, BOB);
      await joinDuel(db, code, CAROL);
      expect(await seats(db, id)).toEqual({ [ALICE]: 0, [CAROL]: 1 });
      await expect(leaveDuel(db, id, DAVE)).rejects.toThrow(/not_found/);
      await leaveDuel(db, id, ALICE);
      expect((await duel(db, code)).status).toBe("cancelled");
    });

    it("lets the host change the settings until the game starts, never below the seated players", async () => {
      const code = await createDuel(db, { maxPlayers: 4 });
      const { id, version } = await duel(db, code);
      await joinDuel(db, code, BOB);
      await joinDuel(db, code, CAROL);
      await configure(db, id, ALICE, ["penly"], 60, 10, 3);
      const changed = await db.query("select target_ids, round_s, grace_s, max_players, status from public.duels where id = $1", [id]);
      expect(changed.rows[0]).toEqual({ target_ids: ["penly"], round_s: 60, grace_s: 10, max_players: 3, status: "lobby" });
      expect((await duel(db, code)).version).toBeGreaterThan(version);

      await expect(configure(db, id, ALICE, TARGETS, 60, 10, 2)).rejects.toThrow(/too_many_players/);
      await expect(configure(db, id, BOB, TARGETS, 60, 10, 4)).rejects.toThrow(/not_found/);
      // A room made exactly full waits for the host to start it rather than starting behind their back.
      expect((await duel(db, code)).status).toBe("lobby");
      await configure(db, id, ALICE, TARGETS, 60, 10, 4);
      await joinDuel(db, code, DAVE);
      expect((await duel(db, code)).deadline_in).toBeCloseTo(DUEL_COUNTDOWN_MS / 1000 + 60, 0);
      await expect(configure(db, id, ALICE, TARGETS, 45, 5, 4)).rejects.toThrow(/started/);
    });

    it("lets a player rejoin, but refuses full, unknown, cancelled and expired lobbies", async () => {
      const code = await createDuel(db, { maxPlayers: 3 });
      await joinDuel(db, code, ALICE);
      await joinDuel(db, code, BOB);
      await joinDuel(db, code, BOB);
      expect((await duel(db, code)).status).toBe("lobby");

      await expect(joinDuel(db, "ZZZZZZ")).rejects.toThrow(/not_found/);
      await createDuel(db);
      await expect(joinDuel(db, code, CAROL)).rejects.toThrow(/not_found/);

      const old = await createDuel(db, { host: CAROL });
      await db.query("update public.duels set created_at = now() - interval '25 hours' where code = $1", [old]);
      await expect(joinDuel(db, old, DAVE)).rejects.toThrow(/expired/);

      const small = await createDuel(db, { host: DAVE, maxPlayers: 2 });
      const { id } = await duel(db, small);
      await db.query("insert into public.duel_players (duel_id, user_id, seat) values ($1, $2, 1)", [id, BOB]);
      await expect(joinDuel(db, small, ALICE)).rejects.toThrow(/full/);
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

    it("leaves everyone else the grace period after the first lock", async () => {
      const { id, code } = await startedDuel(db, { players: [BOB, CAROL] });
      await lock(db, id, ALICE, 0);
      const row = await duel(db, code);
      expect(row.round_index).toBe(0);
      expect(row.deadline_in).toBeCloseTo(GRACE_S, 0);
      await expect(lock(db, id, ALICE, 0)).rejects.toThrow(/already_locked/);
    });

    it("never extends a deadline that is closer than the grace period", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, ROUND_S - 2);
      await lock(db, id, ALICE, 0);
      expect((await duel(db, code)).deadline_in).toBeCloseTo(2, 0);
    });

    it("reveals and moves on once every player locks", async () => {
      const { id, code, version } = await startedDuel(db, { players: [BOB, CAROL] });
      await lock(db, id, ALICE, 0, 4000);
      await lock(db, id, BOB, 0, 3000);
      expect((await duel(db, code)).round_index).toBe(0);
      await lock(db, id, CAROL, 0, 2000);
      const row = await duel(db, code);
      expect(row.round_index).toBe(1);
      expect(row.version).toBeGreaterThan(version);
      expect(row.starts_in).toBeCloseTo(DUEL_REVEAL_MS / 1000, 0);
      expect((await guesses(db, id)).map((g) => g.score)).toEqual([4000, 3000, 2000]);
    });

    it("scores 0 for every player who runs out of time, once someone ticks", async () => {
      const { id, code } = await startedDuel(db, { players: [BOB, CAROL] });
      await lock(db, id, ALICE, 0, 4000);
      await tick(db, id);
      expect((await duel(db, code)).round_index).toBe(0);

      await elapse(db, id, GRACE_S + DUEL_TOLERANCE_MS / 1000 + 0.1);
      await tick(db, id);
      const row = await duel(db, code);
      expect(row.round_index).toBe(1);
      // The reveal counts from the deadline, not from the tick.
      expect(row.starts_in).toBeCloseTo(DUEL_REVEAL_MS / 1000 - DUEL_TOLERANCE_MS / 1000 - 0.1, 0);
      expect(await guesses(db, id)).toEqual([
        { round_index: 0, user_id: ALICE, score: 4000, lon: 2.1 },
        { round_index: 0, user_id: BOB, score: 0, lon: null },
        { round_index: 0, user_id: CAROL, score: 0, lon: null },
      ]);
    });

    it("tells the database's clock, which every duel time is on", async () => {
      const { id } = await startedDuel(db);
      const res = await asServer(db, () => db.query<{ lag: number }>("select extract(epoch from now() - public.duel_tick($1))::float as lag", [id]));
      expect(res.rows[0].lag).toBeCloseTo(0, 0);
    });

    it("still takes a lock within the latency slack after the deadline", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, ROUND_S + DUEL_TOLERANCE_MS / 2000);
      await lock(db, id, BOB, 0);
      expect((await duel(db, code)).round_index).toBe(0);
    });

    it("catches up on every round that ran out while nobody was there", async () => {
      const { id, code } = await startedDuel(db);
      await elapse(db, id, 2 * (ROUND_S + DUEL_REVEAL_MS / 1000) + ROUND_S / 2);
      await tick(db, id);
      const row = await duel(db, code);
      expect(row.round_index).toBe(2);
      expect(row.status).toBe("playing");
      expect(await guesses(db, id)).toHaveLength(4);
    });

    it("finishes after the last round and then refuses locks", async () => {
      const { id, code } = await startedDuel(db, { targets: ["gravelines"] });
      await lock(db, id, ALICE, 0);
      await lock(db, id, BOB, 0);
      expect((await duel(db, code)).status).toBe("finished");
      await expect(lock(db, id, ALICE, 1)).rejects.toThrow(/not_playing/);
    });
  });

  describe("pins", () => {
    it("score a player who did not lock in time with their last pin, unlocked", async () => {
      const { id, code } = await startedDuel(db, { players: [BOB, CAROL] });
      await pin(db, id, BOB, 0, 1000, 1.1);
      await pin(db, id, BOB, 0, 2500, 2.2);
      await lock(db, id, ALICE, 0, 4000);
      await elapse(db, id, GRACE_S + DUEL_TOLERANCE_MS / 1000 + 0.1);
      await tick(db, id);

      expect((await duel(db, code)).round_index).toBe(1);
      const res = await db.query<{ user_id: string; score: number; lon: number | null; locked: boolean }>(
        "select user_id, score, lon, locked_at is not null as locked from public.duel_guesses where duel_id = $1 order by user_id",
        [id],
      );
      expect(res.rows).toEqual([
        { user_id: ALICE, score: 4000, lon: 2.1, locked: true },
        { user_id: BOB, score: 2500, lon: 2.2, locked: false },
        { user_id: CAROL, score: 0, lon: null, locked: false },
      ]);
      const left = await db.query("select * from public.duel_pins where duel_id = $1", [id]);
      expect(left.rows).toHaveLength(0);
    });

    it("never start the grace period, end the round, or wake the other players", async () => {
      const { id, code, version, deadline_in } = await startedDuel(db);
      await pin(db, id, ALICE, 0, 3000);
      await pin(db, id, BOB, 0, 3000);
      const row = await duel(db, code);
      expect(row).toMatchObject({ round_index: 0, version });
      expect(row.deadline_in).toBeCloseTo(deadline_in, 0);
    });

    it("lose to a lock, which keeps its own answer", async () => {
      const { id, code } = await startedDuel(db);
      await lock(db, id, ALICE, 0, 4000);
      await pin(db, id, ALICE, 0, 100);
      await lock(db, id, BOB, 0, 3000);
      expect((await duel(db, code)).round_index).toBe(1);
      expect((await guesses(db, id)).map((g) => g.score)).toEqual([4000, 3000]);
    });

    it("are refused outside the current round's time, and from outsiders", async () => {
      const code = await createDuel(db);
      await joinDuel(db, code);
      const { id } = await duel(db, code);
      await expect(pin(db, id, ALICE, 0, 1)).rejects.toThrow(/not_started/);
      await elapse(db, id, DUEL_COUNTDOWN_MS / 1000);
      await expect(pin(db, id, CAROL, 0, 1)).rejects.toThrow(/not_participant/);
      await expect(pin(db, id, ALICE, 1, 1)).rejects.toThrow(/wrong_round/);
      await elapse(db, id, ROUND_S + DUEL_TOLERANCE_MS / 1000 + 0.1);
      await expect(pin(db, id, ALICE, 0, 1)).rejects.toThrow(/too_late/);
    });

    it("are hidden from clients", async () => {
      await expect(asRole(db, "authenticated", ALICE, () => db.query("select * from public.duel_pins"))).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, "authenticated", ALICE, () => db.query("select public.duel_pin(gen_random_uuid(), $1, 0::smallint, 1, 1, 1, 1)", [ALICE])),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("rematch", () => {
    it("opens one lobby with the same settings, which the others join", async () => {
      const { id, code } = await startedDuel(db, { targets: ["gravelines"], players: [BOB, CAROL] });
      const rematch = (user: string) =>
        asServer(db, () => db.query<{ code: string }>("select public.duel_rematch($1, $2, $3) as code", [id, user, ["penly"]]));
      await expect(rematch(BOB)).rejects.toThrow(/not_finished/);
      for (const player of [ALICE, BOB, CAROL]) await lock(db, id, player, 0);

      const first = (await rematch(BOB)).rows[0].code;
      expect((await rematch(ALICE)).rows[0].code).toBe(first);
      expect((await duel(db, code)).rematch_id).not.toBeNull();
      await expect(rematch(DAVE)).rejects.toThrow(/not_found/);

      const settings = await db.query("select host_id, round_s, grace_s, max_players from public.duels where code = $1", [first]);
      expect(settings.rows[0]).toEqual({ host_id: BOB, round_s: ROUND_S, grace_s: GRACE_S, max_players: 3 });
      await joinDuel(db, first, ALICE);
      await joinDuel(db, first, CAROL);
      expect((await duel(db, first)).status).toBe("playing");
    });
  });
});
