/**
 * Network helpers for a duel on a poor connection: they keep requests from piling up on a slow
 * link, and keep a lock from being lost to a dropped request.
 */

/**
 * Wraps `task` so at most one run is in flight. Calls made meanwhile are merged into a single
 * follow-up run, started once the current one ends, so the last call always sees fresh data.
 * Every caller's promise settles when the run that covers its call ends.
 */
export function singleFlight(task: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | null = null;
  let next: Promise<void> | null = null;

  const start = (): Promise<void> => {
    current = task().finally(() => {
      current = null;
    });
    return current;
  };

  return () => {
    if (!current) return start();
    next ??= current.catch(() => undefined).then(() => {
      next = null;
      return start();
    });
    return next;
  };
}

export interface RetryOptions<T> {
  /** Whether a result is worth another try (a timeout, a dropped connection), not an answer. */
  shouldRetry: (result: T) => boolean;
  /** Client time (ms) after which retrying is pointless. */
  until: () => number;
  /** Waits between tries; the last one repeats. */
  delaysMs?: readonly number[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_DELAYS_MS = [250, 500, 1_000, 2_000] as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `attempt` until it gives an answer, or until `until`; resolves to the last result. */
export async function retryUntil<T>(attempt: () => Promise<T>, options: RetryOptions<T>): Promise<T> {
  const { shouldRetry, until, delaysMs = DEFAULT_DELAYS_MS, now = Date.now, sleep = wait } = options;
  for (let i = 0; ; i++) {
    const result = await attempt();
    const delay = delaysMs[Math.min(i, delaysMs.length - 1)];
    if (!shouldRetry(result) || now() + delay > until()) return result;
    await sleep(delay);
  }
}
