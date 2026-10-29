interface CacheEntry {
  expiresAt: number
  value: unknown
}

const store = new Map<string, CacheEntry>()

/**
 * Cache in-memory sederhana untuk query baca. Tujuannya mengurangi beban
 * database saat beberapa tab console dibuka bersamaan.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  if (ttlMs <= 0) return load()

  const now = Date.now()
  const entry = store.get(key)
  if (entry && entry.expiresAt > now) return entry.value as T

  const value = await load()
  store.set(key, { value, expiresAt: now + ttlMs })
  return value
}

export function clearCache(): void {
  store.clear()
}
