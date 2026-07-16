/**
 * Production start for Render/Railway — always bind 0.0.0.0 and process.env.PORT.
 */
const { spawn } = require('child_process')
const path = require('path')

const port = String(process.env.PORT || 3000)
const nextBin = require.resolve('next/dist/bin/next', {
  paths: [path.join(__dirname, '..')],
})

const child = spawn(
  process.execPath,
  [nextBin, 'start', '--hostname', '0.0.0.0', '--port', port],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
