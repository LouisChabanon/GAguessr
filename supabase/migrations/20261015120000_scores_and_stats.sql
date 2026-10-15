-- Scoreboard, placement heatmaps and usage statistics.
--
-- Security model: clients never touch these tables directly. Games are written by the
-- Next.js server (service role) after it has recomputed every score, and public reads go
-- through the aggregate functions below, which never expose user ids.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (pseudo ~ '^[[:alnum:] _.-]{2,20}$' and pseudo = btrim(pseudo)),
  created_at timestamptz not null default now()
);

create unique index profiles_pseudo_lower_key on public.profiles (lower(pseudo));

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode_id text not null,
  total_score integer not null check (total_score >= 0),
  max_score integer not null check (max_score > 0 and total_score <= max_score),
  time_ms integer not null check (time_ms >= 0),
  rounds smallint not null check (rounds > 0),
  created_at timestamptz not null default now()
);

create index games_leaderboard_idx on public.games (mode_id, total_score desc, time_ms);
create index games_user_mode_idx on public.games (user_id, mode_id, created_at desc);

create table public.guesses (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  mode_id text not null,
  target_id text not null,
  round_index smallint not null check (round_index >= 0),
  lon double precision not null check (lon between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  distance_km real not null check (distance_km >= 0),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, round_index)
);

create index guesses_target_idx on public.guesses (mode_id, target_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.guesses enable row level security;

revoke all on table public.games, public.guesses from anon, authenticated;
revoke all on table public.profiles from anon;

-- A player sees and names only themselves.
create policy "own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: create" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: rename" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Write path (service role only)
-- ---------------------------------------------------------------------------

/**
 * Inserts a game and its guesses atomically. Raises 'too_soon' (P0001) when the same
 * player finished a game of this mode less than p_min_interval ago.
 */
create function public.insert_game(p jsonb, p_min_interval interval)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (p ->> 'user_id')::uuid;
  v_mode text := p ->> 'mode_id';
  v_game uuid;
begin
  -- Serialise a player's submissions so two concurrent ones cannot both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || v_mode, 0));

  if exists (
    select 1 from public.games
    where user_id = v_user and mode_id = v_mode and created_at > now() - p_min_interval
  ) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;

  insert into public.games (user_id, mode_id, total_score, max_score, time_ms, rounds)
  values (
    v_user,
    v_mode,
    (p ->> 'total_score')::integer,
    (p ->> 'max_score')::integer,
    (p ->> 'time_ms')::integer,
    jsonb_array_length(p -> 'guesses')
  )
  returning id into v_game;

  insert into public.guesses (game_id, mode_id, target_id, round_index, lon, lat, distance_km, score)
  select v_game, v_mode, g.target_id, g.round_index, g.lon, g.lat, g.distance_km, g.score
  from jsonb_to_recordset(p -> 'guesses')
    as g(target_id text, round_index smallint, lon double precision, lat double precision, distance_km real, score integer);

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read path (public aggregates)
-- ---------------------------------------------------------------------------

/** Each named player's best game in a mode since p_since, best score first, faster first on ties. */
create function public.leaderboard(p_mode text, p_since timestamptz default '-infinity', p_limit integer default 50)
returns table (rank bigint, pseudo text, total_score integer, max_score integer, time_ms integer, played_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.total_score, g.max_score, g.time_ms, g.created_at
    from public.games g
    where g.mode_id = p_mode and g.created_at >= p_since
    order by g.user_id, g.total_score desc, g.time_ms asc, g.created_at asc
  )
  select
    rank() over (order by b.total_score desc, b.time_ms asc),
    p.pseudo, b.total_score, b.max_score, b.time_ms, b.created_at
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.total_score desc, b.time_ms asc, b.created_at asc
  limit least(greatest(p_limit, 1), 200);
$$;

/**
 * Where one game stands: the share of the mode's games it beats, and the all-time rank
 * its player would hold on the leaderboard with it (named players only).
 */
create function public.game_standing(p_game uuid)
returns table (percentile real, rank bigint, games bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select * from public.games where id = p_game),
  best as (
    select distinct on (g.user_id) g.user_id, g.total_score, g.time_ms
    from public.games g, me
    where g.mode_id = me.mode_id and g.user_id <> me.user_id
    order by g.user_id, g.total_score desc, g.time_ms asc
  )
  select
    (select count(*) filter (where g.total_score < me.total_score)::real / greatest(count(*), 1)
       from public.games g where g.mode_id = me.mode_id),
    1 + (select count(*) from best b join public.profiles p on p.id = b.user_id
         where b.total_score > me.total_score
            or (b.total_score = me.total_score and b.time_ms < me.time_ms)),
    (select count(*) from public.games g where g.mode_id = me.mode_id)
  from me;
$$;

/** How well each site of a mode is known. p_within_km is the mode's score scale. */
create function public.target_stats(p_mode text, p_within_km real)
returns table (target_id text, plays bigint, avg_score real, median_km real, within_share real)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.target_id,
    count(*),
    avg(g.score)::real,
    percentile_cont(0.5) within group (order by g.distance_km)::real,
    (count(*) filter (where g.distance_km <= p_within_km))::real / count(*)
  from public.guesses g
  where g.mode_id = p_mode
  group by g.target_id;
$$;

/** The latest guesses for every site of a mode, at most p_per_target each: heatmap input. */
create function public.mode_guess_sample(p_mode text, p_per_target integer default 300)
returns table (target_id text, lon double precision, lat double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select s.target_id, s.lon, s.lat
  from (
    select g.target_id, g.lon, g.lat,
           row_number() over (partition by g.target_id order by g.created_at desc) as n
    from public.guesses g
    where g.mode_id = p_mode
  ) s
  where s.n <= least(greatest(p_per_target, 1), 300);
$$;

create function public.mode_overview(p_mode text)
returns table (games bigint, players bigint, avg_score real, avg_max_score real)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*), count(distinct user_id), avg(total_score)::real, avg(max_score)::real
  from public.games
  where mode_id = p_mode;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.insert_game(jsonb, interval), public.game_standing(uuid) to service_role;
grant execute on function
  public.leaderboard(text, timestamptz, integer),
  public.target_stats(text, real),
  public.mode_guess_sample(text, integer),
  public.mode_overview(text)
to anon, authenticated, service_role;
