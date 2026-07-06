/**
 * In local dev, the browser calls "/api/*" and Next.js proxies it to the
 * backend (BACKEND_URL, default http://localhost:8000).
 *
 * In production (Render), set NEXT_PUBLIC_API_BASE_URL to the full backend URL
 * (e.g. https://your-app.up.railway.app/api/v1) so the browser calls the
 * Railway backend directly. CORS on the backend allows *.onrender.com.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

const config = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
  },
}

module.exports = config
