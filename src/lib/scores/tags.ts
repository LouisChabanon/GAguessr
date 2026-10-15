/** Cache tags for Supabase-backed reads; Server Actions expire them after writes. */
export const scoresTag = (modeId: string) => `scores:${modeId}`;
export const statsTag = (modeId: string) => `stats:${modeId}`;
/** Pseudos appear on every leaderboard. */
export const PROFILES_TAG = "profiles";
