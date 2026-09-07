import type { NextApiRequest, NextApiResponse } from 'next'

import { validateCredentials } from '@/lib/auth/credentials'
import { buildAuthCookie } from '@/lib/auth/cookie'
import { createAccessToken } from '@/lib/auth/jwt'

type Body = { username?: string; password?: string }

const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function rateLimited(key: string): boolean {
  const now = Date.now()
  const row = attempts.get(key)
  if (!row || now > row.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }
  row.count += 1
  return row.count > 12
}

function backendOrigin(): string {
  return (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
}

/** Prefer PostgreSQL users via backend; fall back to local allow-list if DB is down. */
async function loginAgainstBackend(
  username: string,
  password: string
): Promise<{ ok: true; username: string; role: string } | { ok: false; status?: number; error?: string }> {
  try {
    const res = await fetch(`${backendOrigin()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(12_000),
    })
    if (res.status === 401) {
      return { ok: false, status: 401, error: 'Invalid username or password' }
    }
    if (res.status === 503) {
      return { ok: false, status: 503, error: 'Database unavailable' }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'Backend login failed' }
    }
    const json = (await res.json()) as {
      data?: { user?: { username?: string; role?: string; display_name?: string } }
    }
    const user = json?.data?.user
    const name = user?.username || user?.display_name || username
    const role = (user?.role || 'ADMIN').toLowerCase()
    return { ok: true, username: name, role: role === 'admin' ? 'admin' : role }
  } catch {
    return { ok: false, status: 503, error: 'Backend unreachable' }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = clientKey(req)
  if (rateLimited(key)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' })
  }

  const body = (req.body || {}) as Body
  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const backend = await loginAgainstBackend(username.trim(), password)
  if (backend.ok) {
    const token = await createAccessToken(backend.username, backend.role)
    res.setHeader('Set-Cookie', buildAuthCookie(token))
    return res.status(200).json({
      ok: true,
      source: 'database',
      user: { username: backend.username, role: backend.role },
    })
  }

  // DB rejected credentials — do not fall back to allow-list (avoids bypass)
  if (backend.status === 401) {
    return res.status(401).json({ error: backend.error || 'Invalid username or password' })
  }

  // DB/backend unavailable — emergency local allow-list so app still opens
  if (!validateCredentials(username, password)) {
    return res.status(401).json({
      error: backend.error
        ? `${backend.error}. Local fallback also rejected credentials.`
        : 'Invalid username or password',
    })
  }

  const token = await createAccessToken(username.trim(), 'admin')
  res.setHeader('Set-Cookie', buildAuthCookie(token))
  return res.status(200).json({
    ok: true,
    source: 'fallback',
    user: { username: username.trim(), role: 'admin' },
  })
}
