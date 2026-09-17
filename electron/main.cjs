// Electron main process for the Text Analysis desktop build.
//
// In development it loads the Vite dev server (ELECTRON_DEV_URL); in production
// it serves the built `dist/` folder over a custom, privileged `app://` scheme so
// localStorage and IndexedDB get a stable, secure origin (file:// origins are
// unreliable for storage and are treated as insecure by Chromium).
//
// Security posture (see docs/DESKTOP.md):
//   - renderer is sandboxed, contextIsolation on, nodeIntegration off
//   - no IPC channels; preload exposes a read-only info object only
//   - navigation is locked to the app origin; http(s) links go to the OS browser
//   - window.open is only honoured for same-origin blob:/about:blank content
//     (attachment preview / print preview) and inherits the sandboxed prefs
//   - a Content-Security-Policy is attached to every HTML document served
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const DEV_URL = process.env.ELECTRON_DEV_URL // e.g. http://localhost:8443
const DIST_DIR = path.join(__dirname, '..', 'dist')
const APP_ORIGIN = 'app://app'
const APP_INDEX = `${APP_ORIGIN}/index.html`

// `--smoke-test` (used by CI on a real Windows runner) boots the packaged app
// headlessly, probes the renderer, writes a JSON report to --smoke-out=<file>
// and exits with 0/1. It is a no-op for normal launches.
const SMOKE = process.argv.includes('--smoke-test')
const SMOKE_OUT = (process.argv.find((a) => a.startsWith('--smoke-out=')) || '').slice('--smoke-out='.length)

// The app itself only talks to its own origin; the only remote resources are
// the Google Fonts stylesheets referenced from src/index.css (degrade to system
// fonts when offline). Everything else is denied.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "media-src 'self' blob:",
  "frame-src 'self' blob: about:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

function resolveDistPath(pathname) {
  // Reject anything that is not a clean, absolute path inside dist/.
  const rel = path.posix.normalize(pathname.replace(/\\/g, '/'))
  if (!rel.startsWith('/') || rel.includes('\0')) return null
  const target = path.join(DIST_DIR, ...rel.split('/').filter(Boolean))
  const root = DIST_DIR.endsWith(path.sep) ? DIST_DIR : DIST_DIR + path.sep
  if (target !== DIST_DIR && !target.startsWith(root)) return null
  return target
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'app') return new Response('Not found', { status: 404 })
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    const target = resolveDistPath(pathname)
    if (!target) return new Response('Not found', { status: 404 })

    const res = await net.fetch(pathToFileURL(target).toString())
    if (!target.endsWith('.html')) return res
    const headers = new Headers(res.headers)
    headers.set('Content-Security-Policy', CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(res.body, { status: res.status, headers })
  })
}

function isAppUrl(url) {
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(APP_ORIGIN + '/')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111318',
    icon: process.platform === 'linux' ? path.join(__dirname, '..', 'build', 'icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true,
      devTools: Boolean(DEV_URL) || !app.isPackaged,
    },
  })

  win.once('ready-to-show', () => {
    if (!SMOKE) win.show()
  })

  // window.open policy:
  //   http(s)  -> system browser (never rendered inside the app)
  //   blob:/about:blank -> allowed as a child window (attachment preview, print
  //                        preview); inherits sandboxed webPreferences
  //   anything else -> denied
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    if (url === 'about:blank' || url.startsWith('blob:' + APP_ORIGIN) || (DEV_URL && url.startsWith('blob:' + DEV_URL))) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: undefined },
        },
      }
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (/^https?:/i.test(url)) shell.openExternal(url)
  })
  // Child windows (print preview / attachments) must not navigate anywhere.
  win.webContents.on('did-create-window', (child) => {
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    child.webContents.on('will-navigate', (e, url) => {
      e.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    })
  })
  // Belt and braces: never attach a <webview>.
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())

  if (DEV_URL) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL(APP_INDEX)
  }
  return win
}

async function runSmokeTest(win) {
  const report = { ok: false, checks: {}, errors: [] }
  const fail = (msg) => report.errors.push(msg)
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for did-finish-load')), 30_000)
      win.webContents.once('did-finish-load', () => { clearTimeout(t); resolve() })
      win.webContents.once('did-fail-load', (_e, code, desc, url) => {
        clearTimeout(t); reject(new Error(`did-fail-load ${code} ${desc} ${url}`))
      })
    })
    // Give React a moment to mount.
    await new Promise((r) => setTimeout(r, 2500))
    const probe = await win.webContents.executeJavaScript(`(async () => {
      const out = {};
      out.origin = location.origin;
      out.href = location.href;
      out.rootChildren = document.getElementById('root')?.children.length ?? -1;
      out.bodyText = (document.body.innerText || '').slice(0, 80);
      out.stylesheets = [...document.styleSheets].length;
      out.hasCss = getComputedStyle(document.body).margin === '0px';
      out.hasRequire = typeof require !== 'undefined';
      out.hasProcess = typeof process !== 'undefined';
      out.hasNodeBuffer = typeof Buffer !== 'undefined';
      out.desktopKeys = Object.keys(window.desktop || {}).sort();
      out.desktopIsDesktop = window.desktop && window.desktop.isDesktop === true;
      out.isSecureContext = window.isSecureContext;
      out.csp = document.querySelector('meta[http-equiv]') ? 'meta' : 'header-or-none';
      // localStorage persistence marker (checked across two launches)
      const prev = localStorage.getItem('__desktopSmoke');
      out.lsPrevious = prev;
      if (!prev) localStorage.setItem('__desktopSmoke', String(Date.now()));
      out.lsWorks = localStorage.getItem('__desktopSmoke') !== null;
      // IndexedDB persistence marker
      out.idb = await new Promise((resolve) => {
        const req = indexedDB.open('__desktopSmoke', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onerror = () => resolve({ works: false, error: String(req.error) });
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('kv', 'readwrite');
          const st = tx.objectStore('kv');
          const g = st.get('marker');
          g.onsuccess = () => {
            const previous = g.result ?? null;
            if (!previous) st.put(Date.now(), 'marker');
            tx.oncomplete = () => { db.close(); resolve({ works: true, previous }); };
          };
          g.onerror = () => resolve({ works: false, error: String(g.error) });
        };
      });
      return out;
    })()`, true)
    report.checks = probe
    if (!probe.origin.startsWith('app://')) fail(`unexpected origin ${probe.origin}`)
    if (!(probe.rootChildren > 0)) fail('React root did not render')
    if (probe.stylesheets < 1 || !probe.hasCss) fail('stylesheet not applied')
    if (probe.hasRequire || probe.hasProcess || probe.hasNodeBuffer) fail('Node globals leaked into renderer')
    if (probe.desktopKeys.join(',') !== 'isDesktop,platform,versions') fail(`unexpected preload surface: ${probe.desktopKeys}`)
    if (!probe.isSecureContext) fail('app:// is not a secure context')
    if (!probe.lsWorks) fail('localStorage not writable')
    if (!probe.idb.works) fail(`IndexedDB failed: ${probe.idb.error}`)
    report.ok = report.errors.length === 0
  } catch (err) {
    fail(String(err && err.stack || err))
  }
  report.userData = app.getPath('userData')
  report.exePath = app.getPath('exe')
  report.isPackaged = app.isPackaged
  const json = JSON.stringify(report, null, 2)
  if (SMOKE_OUT) fs.writeFileSync(SMOKE_OUT, json)
  process.stdout.write(json + '\n')
  app.exit(report.ok ? 0 : 1)
}

// Single-instance lock: focus the existing window instead of opening another.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    if (!DEV_URL) registerAppProtocol()
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    const win = createWindow()
    if (SMOKE) runSmokeTest(win)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('web-contents-created', (_e, contents) => {
    // Deny every permission except plain clipboard writes (used by "Copy query").
    const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])
    contents.session.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission)),
    )
    contents.session.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
