/** Returns `count` distinct items in random order (Fisher–Yates on a copy). */
export function pickTargets<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  if (count > items.length) {
    throw new Error(`Cannot pick ${count} targets from a pool of ${items.length}`);
  }
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Rounds in a game: every available target for "all", otherwise capped by the pool size. */
export function roundCount(roundsPerGame: number | "all", available: number): number {
  return roundsPerGame === "all" ? available : Math.min(roundsPerGame, available);
}
