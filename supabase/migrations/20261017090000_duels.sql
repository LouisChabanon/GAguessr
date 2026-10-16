-- Duels: two players race on the same targets, round by round.
--
-- The server owns a duel's state: every transition runs in one of the functions below, under a
-- lock on the duel's row, and clients only ever see what the Next.js server chooses to show.
-- There is no game loop: a round ends when both players have locked a guess, or lazily, the
-- first time anyone touches the duel after its deadline (duel_tick). Timings are in seconds and
-- must match src/game/duel/rules.ts; the migration tests check they agree.
--
-- Participants may read their duel's row so Supabase Realtime can tell them it changed. The row
-- holds no guesses; those stay in duel_guesses, which only the server reads.

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  -- Unambiguous alphabet: no 0/O, 1/I/L.
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  mode_id text not null,
  target_ids text[] not null check (cardinality(target_ids) between 1 and 200),
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete cascade check (guest_id <> host_id),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  round_index smallint not null default 0 check (round_index >= 0),
  -- The current round takes guesses from round_started_at until round_deadline.
  round_started_at timestamptz,
  round_deadline timestamptz,
  -- Bumped by every change, so a Realtime update always fires.
  version integer not null default 0,
  rematch_id uuid references public.duels (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index duels_host_open_idx on public.duels (host_id) where status = 'lobby';

create table public.duel_guesses (
  duel_id uuid not null references public.duels (id) on delete cascade,
  round_index smallint not null check (round_index >= 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- All null when the round ran out before the player locked.
  lon double precision check (lon between -180 and 180),
  lat double precision check (lat between -90 and 90),
  distance_km real check (distance_km >= 0),
  score integer not null check (score >= 0),
  locked_at timestamptz,
  primary key (duel_id, round_index, user_id),
  check ((lon is null) = (lat is null) and (lon is null) = (distance_km is null))
);

alter table public.duels enable row level security;
alter table public.duel_guesses enable row level security;

revoke all on table public.duels, public.duel_guesses from anon, authenticated;
grant select on table public.duels to authenticated;

create policy "duel participants: read" on public.duels
  for select to authenticated using ((select auth.uid()) in (host_id, guest_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.duels;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

/** Timings in seconds: round, grace after the first lock, reveal, first-round countdown, latency slack, lobby lifetime. */
create function public.duel_rules()
returns table (round_s integer, grace_s integer, reveal_s integer, countdown_s integer, tolerance_s integer, lobby_ttl_s integer)
language sql
immutable
as $$ select 45, 5, 8, 3, 1, 86400 $$;

-- ---------------------------------------------------------------------------
-- Write path (service role only)
-- ---------------------------------------------------------------------------

create function public.duel_new_code()
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

/** Opens a lobby; the host's other open lobbies are cancelled. Returns the new duel's code. */
create function public.create_duel(p_host uuid, p_mode text, p_targets text[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.duel_new_code();
begin
  update public.duels set status = 'cancelled', version = version + 1
  where host_id = p_host and status = 'lobby';

  insert into public.duels (code, mode_id, target_ids, host_id)
  values (v_code, p_mode, p_targets, p_host);
  return v_code;
end;
$$;

/**
 * Seats p_user as the guest and starts the first round after a countdown. Joining a duel one
 * already sits in is a no-op. Raises not_found, expired or full (P0001).
 */
create function public.join_duel(p_code text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
  r record;
  v_start timestamptz;
begin
  select * into r from public.duel_rules();
  v_start := now() + make_interval(secs => r.countdown_s);
  select * into v from public.duels where code = p_code for update;
  if not found or v.status = 'cancelled' then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_user in (v.host_id, v.guest_id) then return; end if;
  if v.status <> 'lobby' then raise exception 'full' using errcode = 'P0001'; end if;
  if v.created_at < now() - make_interval(secs => r.lobby_ttl_s) then raise exception 'expired' using errcode = 'P0001'; end if;

  update public.duels set
    guest_id = p_user,
    status = 'playing',
    round_index = 0,
    round_started_at = v_start,
    round_deadline = v_start + make_interval(secs => r.round_s),
    version = version + 1
  where id = v.id;
end;
$$;

/**
 * Ends every round of a playing duel that is over: both players locked, or the deadline (plus the
 * latency slack) passed. A player who did not lock scores 0. The next round starts after the
 * reveal, counted from when the round really ended, so catching up on a long-idle duel replays
 * the same timeline. The caller holds the row lock. Returns whether anything changed.
 */
create function public.duel_advance(p_duel uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v public.duels;
  r record;
  v_locked integer;
  v_ended_at timestamptz;
  v_next_start timestamptz;
  v_changed boolean := false;
begin
  select * into r from public.duel_rules();
  select * into v from public.duels where id = p_duel;
  if v.status <> 'playing' then return false; end if;

  loop
    select count(*), max(locked_at) into v_locked, v_ended_at
      from public.duel_guesses where duel_id = v.id and round_index = v.round_index;
    if v_locked < 2 then
      exit when now() < v.round_deadline + make_interval(secs => r.tolerance_s);
      v_ended_at := v.round_deadline;
    end if;

    insert into public.duel_guesses (duel_id, round_index, user_id, score)
    select v.id, v.round_index, u, 0 from unnest(array[v.host_id, v.guest_id]) as u
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
    v.round_deadline := v_next_start + make_interval(secs => r.round_s);
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

/** Settles rounds whose time is up. Safe to call any time, by either player. */
create function public.duel_tick(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.duels where id = p_duel for update;
  perform public.duel_advance(p_duel);
end;
$$;

/**
 * Locks p_user's guess for round p_round, scored by the server. The first lock of a round
 * leaves the other player the grace period at most. Raises not_found, not_participant,
 * not_playing, wrong_round, not_started or already_locked (P0001).
 */
create function public.duel_lock(p_duel uuid, p_user uuid, p_round smallint, p_lon double precision, p_lat double precision, p_distance_km real, p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.duels;
  r record;
begin
  select * into r from public.duel_rules();
  select * into v from public.duels where id = p_duel for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_user is distinct from v.host_id and p_user is distinct from v.guest_id then
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
    round_deadline = least(round_deadline, now() + make_interval(secs => r.grace_s)),
    version = version + 1
  where id = v.id;
  perform public.duel_advance(p_duel);
end;
$$;

/**
 * Offers a rematch of a finished duel: the first player to ask opens a lobby on p_targets and the
 * other joins it. Returns the rematch's code. Raises not_found or not_finished (P0001).
 */
create function public.duel_rematch(p_duel uuid, p_user uuid, p_targets text[])
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
  if not found or p_user is distinct from v.host_id and p_user is distinct from v.guest_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'finished' then raise exception 'not_finished' using errcode = 'P0001'; end if;

  if v.rematch_id is not null then
    select code into v_code from public.duels where id = v.rematch_id;
    return v_code;
  end if;

  v_code := public.create_duel(p_user, v.mode_id, p_targets);
  update public.duels set
    rematch_id = (select id from public.duels where code = v_code),
    version = version + 1
  where id = v.id;
  return v_code;
end;
$$;

revoke execute on function
  public.duel_rules(),
  public.duel_new_code(),
  public.create_duel(uuid, text, text[]),
  public.join_duel(text, uuid),
  public.duel_advance(uuid),
  public.duel_tick(uuid),
  public.duel_lock(uuid, uuid, smallint, double precision, double precision, real, integer),
  public.duel_rematch(uuid, uuid, text[])
from public, anon, authenticated;
grant execute on function
  public.duel_rules(),
  public.create_duel(uuid, text, text[]),
  public.join_duel(text, uuid),
  public.duel_tick(uuid),
  public.duel_lock(uuid, uuid, smallint, double precision, double precision, real, integer),
  public.duel_rematch(uuid, uuid, text[])
to service_role;
