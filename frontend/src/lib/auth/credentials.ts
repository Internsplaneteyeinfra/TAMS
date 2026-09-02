import crypto from 'crypto'

/** Fixed local operator credentials (override via env in production). */
export function getFixedCredentials() {
  return {
    username: process.env.TAMS_AUTH_USERNAME || 'Admin',
    password: process.env.TAMS_AUTH_PASSWORD || 'Planeteye@2026',
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison to reduce timing variance on length mismatch.
    crypto.timingSafeEqual(aBuf, aBuf)
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

export function validateCredentials(username: string, password: string): boolean {
  const fixed = getFixedCredentials()
  const userOk = safeEqualString(username.trim(), fixed.username)
  const passOk = safeEqualString(password, fixed.password)
  return userOk && passOk
}
