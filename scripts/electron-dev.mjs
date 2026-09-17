// Starts the Vite dev server and launches Electron against it once it is up.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'

const require = createRequire(import.meta.url)
const port = process.env.PORT || '8443'
const url = `http://localhost:${port}`

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const vite = spawn(npx, ['vite', '--port', port], { stdio: 'inherit', shell: process.platform === 'win32' })

function waitForPort(retries = 200) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const socket = net.connect(Number(port), '127.0.0.1')
      socket.once('connect', () => { socket.end(); resolve() })
      socket.once('error', () => {
        socket.destroy()
        if (n <= 0) return reject(new Error(`Vite did not start on ${url}`))
        setTimeout(() => attempt(n - 1), 250)
      })
    }
    attempt(retries)
  })
}

try {
  await waitForPort()
  const electronBin = require('electron')
  const electron = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_DEV_URL: url },
  })
  electron.on('exit', () => { vite.kill(); process.exit(0) })
} catch (err) {
  console.error(err)
  vite.kill()
  process.exit(1)
}
process.on('SIGINT', () => { vite.kill(); process.exit(0) })
