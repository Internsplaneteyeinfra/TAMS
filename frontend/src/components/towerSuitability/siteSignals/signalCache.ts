/**
 * In-memory signal cache — keyed by lat/lon/geometry hash.
 */

const CACHE = new Map<string, { value: unknown; expiresAt: number }>()

export type CacheTtl = 'short' | 'medium' | 'long'

const TTL_MS: Record<CacheTtl, number> = {
  short: 15 * 60 * 1000,
  medium: 6 * 60 * 60 * 1000,
  long: 24 * 60 * 60 * 1000,
}

export function signalCacheKey(
  prefix: string,
  lat: number,
  lon: number,
  geometryHash?: string | null
): string {
  const la = lat.toFixed(5)
  const lo = lon.toFixed(5)
  return `${prefix}:${la},${lo}${geometryHash ? `:${geometryHash}` : ''}`
}

export function getCachedSignal<T>(key: string): T | null {
  const hit = CACHE.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    CACHE.delete(key)
    return null
  }
  return hit.value as T
}

export function setCachedSignal<T>(key: string, value: T, ttl: CacheTtl = 'medium'): void {
  CACHE.set(key, { value, expiresAt: Date.now() + TTL_MS[ttl] })
}

export function clearSignalCache(prefix?: string): void {
  if (!prefix) {
    CACHE.clear()
    return
  }
  for (const k of CACHE.keys()) {
    if (k.startsWith(`${prefix}:`)) CACHE.delete(k)
  }
}
