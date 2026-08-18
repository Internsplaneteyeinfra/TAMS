/**
 * Local Next.js dev server. Port is not hardcoded for GitHub.
 * Order: FRONTEND_PORT env → PORT env → .env.local / .env FRONTEND_PORT → 3000
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function readDotEnvPort() {
  for (const file of ['.env.local', '.env']) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue
    const text = fs.readFileSync(full, 'utf8')
    const match = text.match(/^\s*FRONTEND_PORT\s*=\s*(.+)\s*$/m)
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return null
}

const port = String(process.env.FRONTEND_PORT || process.env.PORT || readDotEnvPort() || 3000)
const nextBin = require.resolve('next/dist/bin/next', { paths: [root] })

const child = spawn(
  process.execPath,
  [nextBin, 'dev', '-H', '0.0.0.0', '-p', port],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
