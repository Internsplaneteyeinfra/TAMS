/**
 * Next.js config — same-origin /api/v1 is proxied by pages/api/v1/[...path].ts
 * to whatever backend host/port is in use (BACKEND_URL, BACKEND_PORT, or inferred).
 */
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.BACKEND_URL || String(process.env.BACKEND_URL).includes('127.0.0.1'))
) {
  console.warn(
    '[tams] BACKEND_URL is unset or local. On Render, set BACKEND_URL to your Railway https://….up.railway.app or data will not load via /api proxy.'
  )
}

const extraDevOrigins = String(process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const config = {
  reactStrictMode: true,
  swcMinify: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost', ...extraDevOrigins],
  transpilePackages: [
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
  ],
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    NEXT_PUBLIC_HOSTED_API_BASE_URL: process.env.NEXT_PUBLIC_HOSTED_API_BASE_URL || '',
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
    NEXT_PUBLIC_MAPBOX_STYLE_ID: process.env.NEXT_PUBLIC_MAPBOX_STYLE_ID || '',
    NEXT_PUBLIC_IMAGERY_TILE_URL: process.env.NEXT_PUBLIC_IMAGERY_TILE_URL || '',
    NEXT_PUBLIC_CESIUM_ION_TOKEN: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '',
    NEXT_PUBLIC_CESIUM_ASSET_BASE_URL: process.env.NEXT_PUBLIC_CESIUM_ASSET_BASE_URL || '/cesium/',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TAMS Platform',
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  },
}

module.exports = config
