import type { NextApiRequest, NextApiResponse } from 'next'

import { readTokenFromCookieHeader } from '@/lib/auth/cookie'
import { verifyAccessToken } from '@/lib/auth/jwt'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = readTokenFromCookieHeader(req.headers.cookie)
  if (!token) {
    return res.status(401).json({ authenticated: false })
  }

  const payload = await verifyAccessToken(token)
  if (!payload) {
    return res.status(401).json({ authenticated: false })
  }

  return res.status(200).json({
    authenticated: true,
    user: { username: payload.sub, role: payload.role },
  })
}
