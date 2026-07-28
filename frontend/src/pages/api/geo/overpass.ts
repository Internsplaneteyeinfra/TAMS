import type { NextApiRequest, NextApiResponse } from 'next'

const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

/**
 * Server-side Overpass proxy — avoids browser CORS/rate-limit failures
 * that left road/water/building distances as n/a.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const query = typeof req.body?.query === 'string' ? req.body.query : ''
  if (!query.trim()) {
    return res.status(400).json({ error: 'query required' })
  }

  let lastError = 'All Overpass endpoints failed'
  for (const ep of ENDPOINTS) {
    try {
      const upstream = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!upstream.ok) {
        lastError = `${ep} → HTTP ${upstream.status}`
        continue
      }
      const json = await upstream.json()
      return res.status(200).json(json)
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  return res.status(502).json({ error: lastError, elements: [] })
}
