interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const dataCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 300;

/**
 * In-memory TTL cache with in-flight promise deduplication.
 * Prevents duplicate YouTube Music API calls and serves repeat requests in <5ms.
 */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = dataCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.value as T;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher()
    .then((result) => {
      if (dataCache.size >= MAX_ENTRIES) {
        const oldestKey = dataCache.keys().next().value;
        if (oldestKey) dataCache.delete(oldestKey);
      }
      dataCache.set(key, {
        value: result,
        expiresAt: Date.now() + ttlMs,
      });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
