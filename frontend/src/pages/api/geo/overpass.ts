import type { NextApiRequest, NextApiResponse } from 'next'

const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const PER_ENDPOINT_MS = 28000

async function fetchWithTimeout(
  url: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
  ms: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Server-side Overpass proxy — avoids browser CORS/rate-limit failures.
 * Tries several public mirrors; on total failure returns 200 with empty elements
 * so the UI can fall back to TAMS towers instead of crashing on 502.
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
      const upstream = await fetchWithTimeout(
        ep,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        PER_ENDPOINT_MS
      )
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

  // Soft failure: empty result so client keeps using TAMS GIS fallback
  return res.status(200).json({
    elements: [],
    remark: lastError,
    overpassUnavailable: true,
  })
}
