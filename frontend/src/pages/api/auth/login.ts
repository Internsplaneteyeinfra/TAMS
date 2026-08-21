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

  if (!validateCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  const token = await createAccessToken(username.trim(), 'admin')
  res.setHeader('Set-Cookie', buildAuthCookie(token))
  return res.status(200).json({
    ok: true,
    user: { username: username.trim(), role: 'admin' },
  })
}
