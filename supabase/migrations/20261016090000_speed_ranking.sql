-- Speed-weighted ranking.
--
-- Precision alone barely separates strong players (a 1 km miss costs ~1% of a round), so a
-- game's ranking score adds a speed bonus proportional to its precision: up to +10% at
-- 0 s per round, fading linearly to nothing at 30 s per round. Keep in sync with
-- src/lib/scores/ranking.ts, which only explains the rule to players.

alter table public.games
  add column ranking_score integer generated always as (
    round(total_score * (1 + 0.10 * greatest(0, 1 - time_ms::numeric / (rounds * 30000))))::integer
  ) stored;

drop index public.games_leaderboard_idx;
create index games_leaderboard_idx on public.games (mode_id, ranking_score desc, time_ms);

drop function public.leaderboard(text, timestamptz, integer);
drop function public.game_standing(uuid);

/** Each named player's best game in a mode since p_since, by ranking score, faster first on ties. */
create function public.leaderboard(p_mode text, p_since timestamptz default '-infinity', p_limit integer default 50)
returns table (rank bigint, pseudo text, ranking_score integer, total_score integer, max_score integer, time_ms integer, played_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.ranking_score, g.total_score, g.max_score, g.time_ms, g.created_at
    from public.games g
    where g.mode_id = p_mode and g.created_at >= p_since
    order by g.user_id, g.ranking_score desc, g.time_ms asc, g.created_at asc
  )
  select
    rank() over (order by b.ranking_score desc, b.time_ms asc),
    p.pseudo, b.ranking_score, b.total_score, b.max_score, b.time_ms, b.created_at
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.ranking_score desc, b.time_ms asc, b.created_at asc
  limit least(greatest(p_limit, 1), 200);
$$;

/**
 * Where one game stands: the share of the mode's games it out-ranks, and the all-time rank
 * its player would hold on the leaderboard with it (named players only).
 */
create function public.game_standing(p_game uuid)
returns table (percentile real, rank bigint, games bigint, ranking_score integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select * from public.games where id = p_game),
  best as (
    select distinct on (g.user_id) g.user_id, g.ranking_score, g.time_ms
    from public.games g, me
    where g.mode_id = me.mode_id and g.user_id <> me.user_id
    order by g.user_id, g.ranking_score desc, g.time_ms asc
  )
  select
    (select count(*) filter (where g.ranking_score < me.ranking_score)::real / greatest(count(*), 1)
       from public.games g where g.mode_id = me.mode_id),
    1 + (select count(*) from best b join public.profiles p on p.id = b.user_id
         where b.ranking_score > me.ranking_score
            or (b.ranking_score = me.ranking_score and b.time_ms < me.time_ms)),
    (select count(*) from public.games g where g.mode_id = me.mode_id),
    me.ranking_score
  from me;
$$;

revoke execute on function public.leaderboard(text, timestamptz, integer), public.game_standing(uuid) from public, anon, authenticated;
grant execute on function public.game_standing(uuid) to service_role;
grant execute on function public.leaderboard(text, timestamptz, integer) to anon, authenticated, service_role;
