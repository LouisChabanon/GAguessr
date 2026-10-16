-- Duel rooms: 2 to 8 players, and settings the host picks.
--
-- Upgrades the 1v1 duels of 20261017090000_duels.sql:
--   * duels.guest_id gives way to duel_players, one row per seat (seat 0 is the host);
--   * each duel stores its round time, grace time and room size (round_s, grace_s, max_players);
--   * a lobby starts on its own once full, or when its host starts it with at least two players;
--     players may leave a lobby, and the host leaving cancels it;
--   * the first lock of a round leaves everyone else the grace period at most; a round ends once
--     every player has locked, or lazily after its deadline (duel_tick);
--   * duel_tick returns the database's clock, which every duel time is on, so clients are never
--     handed another machine's clock.
-- Existing duels keep their players: the host takes seat 0 and the guest, if any, seat 1.
-- Timings are in seconds and must match src/game/duel/rules.ts and settings.ts; the migration
-- tests check they agree.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table public.duels
  add column round_s smallint not null default 45 check (round_s between 10 and 300),
  add column grace_s smallint not null default 5 check (grace_s between 1 and 60),
  add column max_players smallint not null default 2 check (max_players between 2 and 8),
  add constraint duels_grace_within_round check (grace_s <= round_s);

-- ---------------------------------------------------------------------------
-- Seats
-- ---------------------------------------------------------------------------

/** Who sits in a duel; seat 0 is the host. Seats are only taken while the duel is a lobby. */
create table public.duel_players (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat smallint not null check (seat between 0 and 7),
  joined_at timestamptz not null default now(),
  primary key (duel_id, user_id),
  unique (duel_id, seat)
);

create index duel_players_user_idx on public.duel_players (user_id);

alter table public.duel_players enable row level security;
revoke all on table public.duel_players from anon, authenticated;

insert into public.duel_players (duel_id, user_id, seat, joined_at)
select id, host_id, 0, created_at from public.duels
union all
select id, guest_id, 1, created_at from public.duels where guest_id is not null;

-- ---------------------------------------------------------------------------
-- Read policy: players, not host and guest
-- ---------------------------------------------------------------------------

drop policy "duel participants: read" on public.duels;

/** Whether the current user sits in p_duel; lets the read policy look at duel_players, which clients cannot. */
create function public.is_duel_player(p_duel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.duel_players where duel_id = p_duel and user_id = (select auth.uid()));
$$;

create policy "duel players: read" on public.duels
  for select to authenticated using (public.is_duel_player(id));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Their arguments or results change, so they are replaced rather than redefined. Every function
-- below is (re)defined before guest_id goes, and none of them reads it any more.
drop function public.duel_rules();
drop function public.create_duel(uuid, text, text[]);
drop function public.duel_tick(uuid);

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

/** Fixed timings in seconds: reveal, first-round countdown, latency slack, lobby lifetime. */
create or replace function public.duel_rules()
returns table (reveal_s integer, countdown_s integer, tolerance_s integer, lobby_ttl_s integer)
language sql
immutable
as $$ select 8, 3, 1, 86400 $$;

-- ---------------------------------------------------------------------------
-- Write path (service role only)
-- ---------------------------------------------------------------------------

create or replace function public.duel_new_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
      into v_code
      from generate_series(1, 6);
    exit when not exists (select 1 from public.duels where code = v_code);
  end loop;
  return v_code;
end;
$$;

/** Starts the first round of a lobby after the countdown. The caller holds the row lock. */
create or replace function public.duel_start(p_duel uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_start timestamptz;
begin
  select * into r from public.duel_rules();
  v_start := now() + make_interval(secs => r.countdown_s);
  update public.duels set
    status = 'playing',
    round_index = 0,
    round_started_at = v_start,
    round_deadline = v_start + make_interval(secs => round_s),
    version = version + 1
  where id = p_duel;
end;
$$;

/** Opens a lobby with the host in seat 0; the host's other open lobbies are cancelled. Returns the new duel's code. */
create or replace function public.create_duel(p_host uuid, p_mode text, p_targets text[], p_round_s smallint, p_grace_s smallint, p_max_players smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.duel_new_code();
  v_id uuid;
begin
  update public.duels set status = 'cancelled', version = version + 1
  where host_id = p_host and status = 'lobby';

  insert into public.duels (code, mode_id, target_ids, host_id, round_s, grace_s, max_players)
  values (v_code, p_mode, p_targets, p_host, p_round_s, p_grace_s, p_max_players)
  returning id into v_id;
  insert into public.duel_players (duel_id, user_id, seat) values (v_id, p_host, 0);
  return v_code;
end;
$$;

/**
 * Changes a lobby's settings; p_targets is a fresh draw of the new round count. Only the host,
 * only before the game starts, and never below the players already seated.
 * Raises not_found, started or too_many_players (P0001).
 */
create or replace function public.configure_duel(p_duel uuid, p_user uuid, p_targets text[], p_round_s smallint, p_grace_s smallint, p_max_players smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
begin
  select * into v from public.duels where id = p_duel for update;
  if not found or v.host_id is distinct from p_user or v.status = 'cancelled' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'lobby' then raise exception 'started' using errcode = 'P0001'; end if;
  if p_max_players < (select count(*) from public.duel_players where duel_id = v.id) then
    raise exception 'too_many_players' using errcode = 'P0001';
  end if;

  update public.duels set
    target_ids = p_targets,
    round_s = p_round_s,
    grace_s = p_grace_s,
    max_players = p_max_players,
    version = version + 1
  where id = v.id;
end;
$$;

/**
 * Seats p_user in the lobby p_code; the game starts on its own once the room is full. Joining a
 * duel one already sits in is a no-op. Raises not_found, started, full or expired (P0001).
 */
create or replace function public.join_duel(p_code text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
  r record;
  v_seated integer;
begin
  select * into r from public.duel_rules();
  select * into v from public.duels where code = p_code for update;
  if not found or v.status = 'cancelled' then raise exception 'not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from public.duel_players where duel_id = v.id and user_id = p_user) then return; end if;
  if v.status <> 'lobby' then raise exception 'started' using errcode = 'P0001'; end if;
  if v.created_at < now() - make_interval(secs => r.lobby_ttl_s) then raise exception 'expired' using errcode = 'P0001'; end if;

  select count(*) into v_seated from public.duel_players where duel_id = v.id;
  if v_seated >= v.max_players then raise exception 'full' using errcode = 'P0001'; end if;

  -- The lowest free seat, so a player who left frees theirs.
  insert into public.duel_players (duel_id, user_id, seat)
  select v.id, p_user, min(s) from generate_series(0, 7) as s
  where s not in (select seat from public.duel_players where duel_id = v.id);

  if v_seated + 1 >= v.max_players then
    perform public.duel_start(v.id);
  else
    update public.duels set version = version + 1 where id = v.id;
  end if;
end;
$$;

/** The host starts a lobby before it is full. Raises not_found, started or not_enough_players (P0001). */
create or replace function public.start_duel(p_duel uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
begin
  select * into v from public.duels where id = p_duel for update;
  if not found or v.host_id is distinct from p_user or v.status = 'cancelled' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'lobby' then raise exception 'started' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_players where duel_id = v.id) < 2 then
    raise exception 'not_enough_players' using errcode = 'P0001';
  end if;
  perform public.duel_start(v.id);
end;
$$;

/**
 * Leaves a lobby: a player frees their seat; the host cancels the lobby for everyone. Leaving a
 * started duel is not possible: its rounds just run out. Raises not_found or started (P0001).
 */
create or replace function public.leave_duel(p_duel uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
begin
  select * into v from public.duels where id = p_duel for update;
  if not found or not exists (select 1 from public.duel_players where duel_id = v.id and user_id = p_user) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'lobby' then raise exception 'started' using errcode = 'P0001'; end if;

  if p_user = v.host_id then
    update public.duels set status = 'cancelled', version = version + 1 where id = v.id;
  else
    delete from public.duel_players where duel_id = v.id and user_id = p_user;
    update public.duels set version = version + 1 where id = v.id;
  end if;
end;
$$;

/**
 * Ends every round of a playing duel that is over: every player locked, or the deadline (plus the
 * latency slack) passed. A player who did not lock scores 0. The next round starts after the
 * reveal, counted from when the round really ended, so catching up on a long-idle duel replays
 * the same timeline. The caller holds the row lock. Returns whether anything changed.
 */
create or replace function public.duel_advance(p_duel uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v public.duels;
  r record;
  v_players integer;
  v_locked integer;
  v_ended_at timestamptz;
  v_next_start timestamptz;
  v_changed boolean := false;
begin
  select * into r from public.duel_rules();
  select * into v from public.duels where id = p_duel;
  if v.status <> 'playing' then return false; end if;
  select count(*) into v_players from public.duel_players where duel_id = v.id;

  loop
    select count(*), max(locked_at) into v_locked, v_ended_at
      from public.duel_guesses where duel_id = v.id and round_index = v.round_index;
    if v_locked < v_players then
      exit when now() < v.round_deadline + make_interval(secs => r.tolerance_s);
      v_ended_at := v.round_deadline;
    end if;

    insert into public.duel_guesses (duel_id, round_index, user_id, score)
    select v.id, v.round_index, p.user_id, 0 from public.duel_players p where p.duel_id = v.id
    on conflict do nothing;
    v_changed := true;

    if v.round_index + 1 >= cardinality(v.target_ids) then
      v.status := 'finished';
      v.finished_at := v_ended_at;
      exit;
    end if;
    v_next_start := v_ended_at + make_interval(secs => r.reveal_s);
    v.round_index := v.round_index + 1;
    v.round_started_at := v_next_start;
    v.round_deadline := v_next_start + make_interval(secs => v.round_s);
  end loop;

  if v_changed then
    update public.duels set
      status = v.status,
      finished_at = v.finished_at,
      round_index = v.round_index,
      round_started_at = v.round_started_at,
      round_deadline = v.round_deadline,
      version = version + 1
    where id = v.id;
  end if;
  return v_changed;
end;
$$;

/**
 * Settles rounds whose time is up, and returns the database's clock: every duel time is on it,
 * so the server hands it to clients rather than its own. Safe to call any time, by any player;
 * it only locks the duel when a round is due.
 */
create or replace function public.duel_tick(p_duel uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public.duel_rules();
  if exists (
    select 1 from public.duels
    where id = p_duel and status = 'playing' and now() >= round_deadline + make_interval(secs => r.tolerance_s)
  ) then
    perform 1 from public.duels where id = p_duel for update;
    perform public.duel_advance(p_duel);
  end if;
  return now();
end;
$$;

/**
 * Locks p_user's guess for round p_round, scored by the server. The first lock of a round
 * leaves everyone else the grace period at most. Raises not_found, not_participant,
 * not_playing, wrong_round, not_started or already_locked (P0001).
 */
create or replace function public.duel_lock(p_duel uuid, p_user uuid, p_round smallint, p_lon double precision, p_lat double precision, p_distance_km real, p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
begin
  select * into v from public.duels where id = p_duel for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.duel_players where duel_id = v.id and user_id = p_user) then
    raise exception 'not_participant' using errcode = 'P0001';
  end if;

  perform public.duel_advance(p_duel);
  select * into v from public.duels where id = p_duel;
  if v.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  if v.round_index <> p_round then raise exception 'wrong_round' using errcode = 'P0001'; end if;
  if now() < v.round_started_at then raise exception 'not_started' using errcode = 'P0001'; end if;

  begin
    insert into public.duel_guesses (duel_id, round_index, user_id, lon, lat, distance_km, score, locked_at)
    values (v.id, p_round, p_user, p_lon, p_lat, p_distance_km, p_score, now());
  exception when unique_violation then
    raise exception 'already_locked' using errcode = 'P0001';
  end;

  update public.duels set
    round_deadline = least(round_deadline, now() + make_interval(secs => v.grace_s)),
    version = version + 1
  where id = v.id;
  perform public.duel_advance(p_duel);
end;
$$;

/**
 * Offers a rematch of a finished duel, with the same settings: the first player to ask opens a
 * lobby on p_targets and the others join it. Returns the rematch's code. Raises not_found or
 * not_finished (P0001).
 */
create or replace function public.duel_rematch(p_duel uuid, p_user uuid, p_targets text[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
  v_code text;
begin
  select * into v from public.duels where id = p_duel for update;
  if not found or not exists (select 1 from public.duel_players where duel_id = v.id and user_id = p_user) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'finished' then raise exception 'not_finished' using errcode = 'P0001'; end if;

  if v.rematch_id is not null then
    select code into v_code from public.duels where id = v.rematch_id;
    return v_code;
  end if;

  v_code := public.create_duel(p_user, v.mode_id, p_targets, v.round_s, v.grace_s, v.max_players);
  update public.duels set
    rematch_id = (select id from public.duels where code = v_code),
    version = version + 1
  where id = v.id;
  return v_code;
end;
$$;

revoke execute on function
  public.is_duel_player(uuid),
  public.duel_rules(),
  public.duel_new_code(),
  public.duel_start(uuid),
  public.create_duel(uuid, text, text[], smallint, smallint, smallint),
  public.configure_duel(uuid, uuid, text[], smallint, smallint, smallint),
  public.join_duel(text, uuid),
  public.start_duel(uuid, uuid),
  public.leave_duel(uuid, uuid),
  public.duel_advance(uuid),
  public.duel_tick(uuid),
  public.duel_lock(uuid, uuid, smallint, double precision, double precision, real, integer),
  public.duel_rematch(uuid, uuid, text[])
from public, anon, authenticated;
grant execute on function public.is_duel_player(uuid) to authenticated;
grant execute on function
  public.duel_rules(),
  public.create_duel(uuid, text, text[], smallint, smallint, smallint),
  public.configure_duel(uuid, uuid, text[], smallint, smallint, smallint),
  public.join_duel(text, uuid),
  public.start_duel(uuid, uuid),
  public.leave_duel(uuid, uuid),
  public.duel_tick(uuid),
  public.duel_lock(uuid, uuid, smallint, double precision, double precision, real, integer),
  public.duel_rematch(uuid, uuid, text[])
to service_role;

alter table public.duels drop column guest_id;
