interface StoredEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, StoredEntry<unknown>>();
const STORAGE_PREFIX = 'frosh_swr_';

/**
 * Reads cached data from in-memory Map or sessionStorage for instant 0ms UI rendering.
 */
export function getCachedData<T>(
  key: string,
  staleAfterMs = 5 * 60 * 1000,
  maxAgeMs = 60 * 60 * 1000
): { data: T; isStale: boolean } | null {
  const now = Date.now();
  let entry = memoryCache.get(key) as StoredEntry<T> | undefined;

  if (!entry && typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw) {
        entry = JSON.parse(raw) as StoredEntry<T>;
        memoryCache.set(key, entry);
      }
    } catch {
      // ignore storage errors
    }
  }

  if (!entry) return null;
  const age = now - entry.timestamp;
  if (age > maxAgeMs) return null;

  return {
    data: entry.data,
    isStale: age > staleAfterMs,
  };
}

export function setCachedData<T>(key: string, data: T): void {
  const entry: StoredEntry<T> = {
    data,
    timestamp: Date.now(),
  };
  memoryCache.set(key, entry);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // ignore quota errors
    }
  }
}

let cachedSessionPromise: Promise<any> | null = null;

/**
 * Deduplicates /api/auth/session calls across Sidebar, Home, and UserAvatarButton.
 */
export function fetchSessionOnce(): Promise<any> {
  if (!cachedSessionPromise) {
    cachedSessionPromise = fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return cachedSessionPromise;
}

export function invalidateSessionCache(): void {
  cachedSessionPromise = null;
}
