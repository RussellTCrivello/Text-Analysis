// Starts the Vite dev server and launches Electron against it once it is up.
//
// Notes on the two bits of noise this script deliberately avoids:
//   - Node's DEP0190 warning: we resolve Vite's JS bin and run it with
//     `process.execPath` instead of spawning `npx` through a shell, so no
//     arguments are ever concatenated into a shell command line.
//   - Chromium's "Request Autofill.enable failed" / "Autofill.setAddresses
//     failed" console errors: the bundled DevTools frontend asks for CDP
//     domains Electron does not implement. They are harmless and upstream, so
//     Electron's stderr is filtered rather than left to scare people.
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import net from "node:net"
import path from "node:path"
import readline from "node:readline"

const require = createRequire(import.meta.url)
const port = Number(process.env.PORT || 8443)
const host = "127.0.0.1"
const url = `http://localhost:${port}`

// Known-harmless lines emitted by the DevTools frontend / Chromium in dev.
const NOISE = [
  /Request Autofill\.(enable|setAddresses) failed/,
  /'Autofill\.(enable|setAddresses)' wasn't found/,
  /Autofill\.enable.*wasn't found/,
]
const QUIET = process.env.ELECTRON_DEV_VERBOSE !== "1"

function filterStream(stream, out) {
  readline
    .createInterface({ input: stream, crlfDelay: Infinity })
    .on("line", (line) => {
      if (QUIET && NOISE.some((re) => re.test(line))) return
      out.write(line + "\n")
    })
}

function probePort(timeout = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    const done = (open) => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeout)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

async function waitForPort(retries = 200) {
  for (let i = 0; i < retries; i++) {
    if (await probePort()) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Vite did not start on ${url}`)
}

let vite = null

// Resolve Vite's CLI entry without relying on package `exports` (Vite does not
// export `./bin/vite.js`): locate its package.json, then read the `bin` field.
function resolveViteBin() {
  const pkgPath = require.resolve("vite/package.json")
  const pkg = require(pkgPath)
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.vite
  if (!rel)
    throw new Error("Could not resolve the Vite CLI from node_modules/vite")
  return path.join(path.dirname(pkgPath), rel)
}

function startVite() {
  // The Vite CLI is a plain Node script: run it with this Node, no shell.
  const viteBin = resolveViteBin()
  const child = spawn(
    process.execPath,
    [viteBin, "--port", String(port), "--strictPort"],
    {
      stdio: "inherit",
    },
  )
  child.on("exit", (code) => {
    if (code && code !== 0 && !shuttingDown) {
      console.error(`[electron-dev] Vite exited with code ${code}`)
      shutdown(code)
    }
  })
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (vite && !vite.killed) vite.kill()
  process.exit(code)
}

try {
  if (await probePort()) {
    // Something is already serving the port (e.g. a `npm run dev` in another
    // terminal). Attach to it instead of failing on --strictPort.
    console.log(
      `[electron-dev] Reusing the dev server already listening on ${url}`,
    )
  } else {
    vite = startVite()
    await waitForPort()
  }

  let electronBin
  try {
    electronBin = require("electron")
  } catch (err) {
    if (/failed to install correctly/i.test(String(err && err.message))) {
      throw new Error(
        "The Electron binary is missing (npm skipped its postinstall script).\n" +
          "Fix it with:\n" +
          "  npm install-scripts approve electron\n" +
          "  npm install-scripts approve electron-winstaller\n" +
          "  npm install\n" +
          "  npx electron --version   # should print a version\n" +
          "See docs/DESKTOP.md for details.",
      )
    }
    throw err
  }
  const electron = spawn(electronBin, ["."], {
    stdio: ["inherit", "inherit", QUIET ? "pipe" : "inherit"],
    env: { ...process.env, ELECTRON_DEV_URL: url },
  })
  if (QUIET && electron.stderr) filterStream(electron.stderr, process.stderr)
  electron.on("exit", (code) => shutdown(code ?? 0))
} catch (err) {
  console.error(err)
  shutdown(1)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))
