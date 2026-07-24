// In-memory LRU cache for hot read-only endpoints.
//
// Why: site-branding and current-hackathon are queried on every page load
// (SiteBrandingProvider, ActiveHackathonProvider wrap the app) and rarely
// change. Without a cache, every navigation hits Postgres just to read the
// same row.
//
// Usage:
//   const settings = await cache.getOrLoad('site-settings', 60_000, () =>
//     prisma.siteSetting.findFirst(...)
//   )
//   // On write:
//   cache.invalidate('site-settings')
//
// This is in-memory only — multi-instance deployments will see redundant
// hits. Swap for Redis when the project scales to >1 instance. The keys
// stay the same so the call sites do not change.

import { LRUCache } from 'lru-cache'

const store = new LRUCache<string, { value: unknown; expiresAt: number }>({
  max: 200,
  // No global TTL — each entry carries its own.
})

export const cache = {
  async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    // Skip cache entirely in test mode so a previous test's data does not
    // leak into the next one. Tests use AUTH_DISABLED=true and rely on
    // hitting the real DB on every call.
    if (process.env.NODE_ENV === 'test' || process.env.AUTH_DISABLED === 'true') {
      return loader()
    }
    const now = Date.now()
    const hit = store.get(key)
    if (hit && hit.expiresAt > now) {
      return hit.value as T
    }
    const value = await loader()
    store.set(key, { value, expiresAt: now + ttlMs })
    return value
  },

  invalidate(key: string): void {
    store.delete(key)
  },

  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key)
      }
    }
  },

  // For tests / debugging.
  clear(): void {
    store.clear()
  },
}
