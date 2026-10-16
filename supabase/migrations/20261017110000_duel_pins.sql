-- Duel pins: what a player has placed on the map, before they lock it.
--
-- On a slow connection a lock can reach the server after the round's deadline and be refused,
-- although the player clicked in time. So the client also saves each pin as it is placed, and a
-- player who did not lock in time scores their last saved pin instead of nothing. A pin is not a
-- lock: it does not start the grace period, and it does not end the round early.

create table public.duel_pins (
  duel_id uuid not null references public.duels (id) on delete cascade,
  round_index smallint not null check (round_index >= 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  lon double precision not null check (lon between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  distance_km real not null check (distance_km >= 0),
  score integer not null check (score >= 0),
  placed_at timestamptz not null default now(),
  primary key (duel_id, round_index, user_id)
);

alter table public.duel_pins enable row level security;
revoke all on table public.duel_pins from anon, authenticated;

/**
 * Saves p_user's pin for round p_round, scored by the server, while the round takes guesses.
 * Takes no lock on the duel and does not bump its version: pins are frequent and private, so they
 * must neither wait for nor wake anybody. Once the player has locked, a pin is ignored.
 * Raises not_participant, not_playing, wrong_round, not_started or too_late (P0001).
 */
create function public.duel_pin(p_duel uuid, p_user uuid, p_round smallint, p_lon double precision, p_lat double precision, p_distance_km real, p_score integer)
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
  select * into v from public.duels where id = p_duel;
  if not found or not exists (select 1 from public.duel_players where duel_id = p_duel and user_id = p_user) then
    raise exception 'not_participant' using errcode = 'P0001';
  end if;
  if v.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  if v.round_index <> p_round then raise exception 'wrong_round' using errcode = 'P0001'; end if;
  if now() < v.round_started_at then raise exception 'not_started' using errcode = 'P0001'; end if;
  if now() >= v.round_deadline + make_interval(secs => r.tolerance_s) then raise exception 'too_late' using errcode = 'P0001'; end if;
  if exists (select 1 from public.duel_guesses where duel_id = p_duel and round_index = p_round and user_id = p_user) then return; end if;

  insert into public.duel_pins (duel_id, round_index, user_id, lon, lat, distance_km, score)
  values (p_duel, p_round, p_user, p_lon, p_lat, p_distance_km, p_score)
  on conflict (duel_id, round_index, user_id) do update set
    lon = excluded.lon,
    lat = excluded.lat,
    distance_km = excluded.distance_km,
    score = excluded.score,
    placed_at = excluded.placed_at;
end;
$$;

/**
 * Ends every round of a playing duel that is over: every player locked, or the deadline (plus the
 * latency slack) passed. A player who did not lock scores their last saved pin, or 0 without one;
 * either way their answer stays unlocked (locked_at null). The next round starts after the
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

    insert into public.duel_guesses (duel_id, round_index, user_id, lon, lat, distance_km, score)
    select v.id, v.round_index, p.user_id, pin.lon, pin.lat, pin.distance_km, coalesce(pin.score, 0)
    from public.duel_players p
    left join public.duel_pins pin on pin.duel_id = v.id and pin.round_index = v.round_index and pin.user_id = p.user_id
    where p.duel_id = v.id
    on conflict do nothing;
    delete from public.duel_pins where duel_id = v.id and round_index = v.round_index;
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

revoke execute on function public.duel_pin(uuid, uuid, smallint, double precision, double precision, real, integer) from public, anon, authenticated;
grant execute on function public.duel_pin(uuid, uuid, smallint, double precision, double precision, real, integer) to service_role;
