/**
 * The speed bonus rule, for explaining it to players. The database computes the ranking score
 * (games.ranking_score); the migration tests check it agrees with these values.
 */
export const SPEED_BONUS_MAX = 0.1;
/** Average time per round at which the bonus has faded to nothing. */
export const SPEED_BONUS_ZERO_MS_PER_ROUND = 30_000;
