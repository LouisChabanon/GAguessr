/**
 * Fixed duel timings. The database enforces them (public.duel_rules() in the duels migration); the
 * migration tests check both agree. The round and grace times are per duel: see settings.ts.
 */
/** How long both answers stay on screen before the next round starts. */
export const DUEL_REVEAL_MS = 8_000;
/** Countdown between the guest joining and the first round. */
export const DUEL_COUNTDOWN_MS = 3_000;
/** A lock arriving this long after the deadline still counts, for request latency. */
export const DUEL_TOLERANCE_MS = 1_000;
/** An unjoined lobby can no longer be joined after this long. */
export const DUEL_LOBBY_TTL_MS = 24 * 60 * 60 * 1000;
