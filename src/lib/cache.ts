/**
 * Memoizes an async loader by key. A rejected promise is evicted so the next
 * call retries instead of replaying the failure.
 */
export function cachedAsync<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = load(key).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
    return pending;
  };
}

/** `cachedAsync` for loaders without arguments. */
export function onceAsync<V>(load: () => Promise<V>): () => Promise<V> {
  const cached = cachedAsync<null, V>(() => load());
  return () => cached(null);
}
