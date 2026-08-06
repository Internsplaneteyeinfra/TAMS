/**
 * Resolve the upstream FastAPI origin for the Next.js /api/v1 proxy.
 * Evaluated at request time so host/port do not need to be hardcoded.
 *
 * Order:
 *   1. BACKEND_URL (explicit override)
 *   2. http://127.0.0.1:$BACKEND_PORT
 *   3. Infer backend port from the frontend port the user opened:
 *      :3000 → :8000, :3002 → :8002, etc.
 */
function frontendPortFromHost(hostHeader, fallback = 3000) {
  const match = String(hostHeader || '').match(/:(\d+)$/)
  if (match) return Number(match[1])
  const envPort = Number(process.env.PORT || process.env.FRONTEND_PORT || fallback)
  return Number.isFinite(envPort) && envPort > 0 ? envPort : fallback
}

function inferBackendPort(frontendPort) {
  if (process.env.BACKEND_PORT) {
    const parsed = Number(process.env.BACKEND_PORT)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  const fe = Number(frontendPort)
  if (Number.isFinite(fe) && fe >= 3000 && fe < 4000) {
    return 8000 + (fe - 3000)
  }
  return 8000
}

function resolveBackendOrigin(hostHeader) {
  const explicit = String(process.env.BACKEND_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (explicit) return explicit
  return `http://127.0.0.1:${inferBackendPort(frontendPortFromHost(hostHeader))}`
}

module.exports = {
  frontendPortFromHost,
  inferBackendPort,
  resolveBackendOrigin,
}
