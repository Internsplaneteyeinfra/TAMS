export interface AuthTokenPayload {
  sub: string
  role: string
  iat: number
  exp: number
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.TAMS_JWT_SECRET || 'tams-local-dev-secret-change-me'
}

function utf8(input: string): ArrayBuffer {
  const u8 = new TextEncoder().encode(input)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

function toBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i])
  const b64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(view).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): ArrayBuffer {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const raw =
    typeof atob === 'function'
      ? atob(b64 + pad)
      : Buffer.from(b64 + pad, 'base64').toString('binary')
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    utf8(getJwtSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signData(data: string): Promise<string> {
  const key = await hmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, utf8(data))
  return toBase64Url(sig)
}

async function signaturesMatch(data: string, signatureB64url: string): Promise<boolean> {
  const key = await hmacKey()
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(data)))
  const actual = new Uint8Array(fromBase64Url(signatureB64url))
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

export async function createAccessToken(
  subject: string,
  role = 'admin',
  expiresInSeconds = 60 * 60 * 8
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload: AuthTokenPayload = {
    sub: subject,
    role,
    iat: now,
    exp: now + expiresInSeconds,
  }
  const h = toBase64Url(utf8(JSON.stringify(header)))
  const p = toBase64Url(utf8(JSON.stringify(payload)))
  const data = `${h}.${p}`
  const signature = await signData(data)
  return `${data}.${signature}`
}

export async function verifyAccessToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, payload, signature] = parts
    const data = `${header}.${payload}`
    if (!(await signaturesMatch(data, signature))) return null
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as AuthTokenPayload
    if (!decoded?.sub || typeof decoded.exp !== 'number') return null
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded
  } catch {
    return null
  }
}
