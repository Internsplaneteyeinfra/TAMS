import crypto from 'crypto'

/** Shared password for all allowed local operators (override via env). */
export function getAuthPassword(): string {
  return process.env.TAMS_AUTH_PASSWORD || 'Planeteye@2026'
}

/**
 * Allowed usernames (exact match, case-sensitive).
 * Override with comma-separated TAMS_AUTH_USERNAMES env, e.g.
 * TAMS_AUTH_USERNAMES=Admin,VishalBhor,ShwetaPawar
 */
export function getAllowedUsernames(): string[] {
  const fromEnv = process.env.TAMS_AUTH_USERNAMES
  if (fromEnv && fromEnv.trim()) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  // Legacy single-username env still supported
  const legacy = process.env.TAMS_AUTH_USERNAME?.trim()
  if (legacy) {
    const defaults = ['Admin', 'VishalBhor', 'ShwetaPawar']
    return Array.from(new Set([legacy, ...defaults]))
  }
  return ['Admin', 'VishalBhor', 'ShwetaPawar']
}

/** @deprecated Prefer getAllowedUsernames + getAuthPassword */
export function getFixedCredentials() {
  return {
    username: getAllowedUsernames()[0] || 'Admin',
    password: getAuthPassword(),
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf)
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

export function validateCredentials(username: string, password: string): boolean {
  const user = username.trim()
  const allowed = getAllowedUsernames()
  const userOk = allowed.some((u) => safeEqualString(user, u))
  const passOk = safeEqualString(password, getAuthPassword())
  return userOk && passOk
}
