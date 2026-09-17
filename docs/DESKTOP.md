# Desktop build (Windows .exe installer)

The desktop app wraps the exact same Vite bundle in **Electron** and packages it
with **electron-builder** into an NSIS installer (`Text Analysis-Setup-<version>.exe`).

## Layout

| Path | Purpose |
|---|---|
| `electron/main.cjs` | Main process: creates the window, serves `dist/` over a secure `app://` origin (stable localStorage / IndexedDB), opens external links in the system browser, single-instance lock. |
| `electron/preload.cjs` | Sandboxed bridge exposing only `window.desktop = { isDesktop, platform, versions }`. |
| `scripts/electron-dev.mjs` | Starts Vite (via `process.execPath`, no shell), waits for the port, launches Electron against it with DevTools, and filters known-harmless DevTools noise. |
| `build/` | Installer assets (`icon.ico`, `icon.png`), generated from `public/favicon.svg`. |
| `package.json → "build"` | electron-builder config (appId, NSIS options, targets). Output goes to `release/` (git-ignored). |
| `.github/workflows/desktop-windows.yml` | Builds the installer on `windows-latest`; uploads it as an artifact and attaches it to the GitHub Release for `v*` tags. |

`vite.config.ts` uses `base: './'` so the built assets resolve relative to
`index.html` regardless of origin — required for the `app://` loader.

## Build locally (Windows)

Prerequisites: Node 22 (see `.mise.toml`). No Visual Studio / Python needed —
there are no native modules.

```powershell
npm install
npm run electron:dev   # run the desktop app against the Vite dev server
npm run dist:win       # → release\Text Analysis-Setup-1.0.0.exe
npm run dist:dir       # unpacked app only (fast sanity check, no installer)
```

Notes:
- First run downloads the Electron binary (~100 MB) into the npm cache.
- If `npm install` ends with `npm warn install-scripts … electron@… postinstall`,
  npm skipped that postinstall, so `node_modules/electron` has no binary and
  `electron:dev` / `dist:win` fail with *"Electron failed to install correctly"*.
  Approve the two scripts and re-run the install:

  ```powershell
  npm install-scripts approve electron
  npm install-scripts approve electron-winstaller
  npm install
  npx electron --version   # prints a version once the binary is really there
  ```

  (`node node_modules/electron/install.js` re-downloads just the binary if you
  don't want to reinstall everything.)
- `ReadError: The server aborted pending request` inside `node install.js` is a
  truncated download from GitHub, not a project problem — retry, or point
  `ELECTRON_MIRROR` at a mirror your network handles better.
- `build/` (installer icons: `icon.ico`, `icon.png`) is git-ignored, so a fresh
  clone falls back to Electron's default icon. Regenerate it from
  `public/favicon.svg` before shipping a branded installer.
- `npm run electron:dev` reuses a dev server already listening on the port, so
  it is safe to run alongside a `npm run dev` in another terminal.
- If symlink errors appear during `dist:win`, enable Developer Mode in Windows
  or run the terminal as Administrator (electron-builder's code-sign tooling
  extracts symlinks).
- Building the Windows installer from macOS/Linux also works (`npm run dist:win`
  uses Wine only if you enable code signing / icons need conversion).

## Harmless messages you can ignore

A healthy `npm run electron:dev` prints the Vite banner and nothing else. Two
messages used to show up and are **not** errors in this project:

| Message | Cause | Status |
|---|---|---|
| `(node:…) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true …` | The launcher spawned `npx vite` with `shell: true`. | **Fixed** — it now runs Vite's CLI directly with `process.execPath`, no shell. |
| `ERROR:CONSOLE … "Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}"` (and `Autofill.setAddresses`) | The bundled Chrome DevTools frontend requests CDP `Autofill.*` domains that Electron does not implement. Upstream, cosmetic, only appears while DevTools is open. | **Filtered** from Electron's stderr by the launcher. |

Escape hatches:

```powershell
$env:ELECTRON_DEV_VERBOSE=1; npm run electron:dev   # show all stderr, unfiltered
$env:ELECTRON_DEVTOOLS=0;    npm run electron:dev   # start without DevTools
```

Only the two Autofill patterns are suppressed — genuine renderer errors and
crashes still print.

## Build in CI

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The `Desktop (Windows installer)` workflow runs `typecheck` + `test`, builds the
installer, uploads it as the `TextAnalysis-windows-installer` artifact and
attaches the `.exe` to the release. It can also be run manually from the Actions
tab (`workflow_dispatch`) — the artifact is then available on the run page.

## Icon

`build/icon.ico` (16–256 px) and `build/icon.png` (512 px) are rendered from
`public/favicon.svg`. To regenerate after changing the SVG:

```bash
npm i -D @resvg/resvg-js png-to-ico   # one-off, not kept in package.json
node -e "const {Resvg}=require('@resvg/resvg-js'),ico=require('png-to-ico'),fs=require('fs');const svg=fs.readFileSync('public/favicon.svg');const r=w=>new Resvg(svg,{fitTo:{mode:'width',value:w}}).render().asPng();fs.writeFileSync('build/icon.png',r(512));ico([16,24,32,48,64,128,256].map(r)).then(b=>fs.writeFileSync('build/icon.ico',b))"
```

## Code signing (optional, recommended for distribution)

The installer is **unsigned** by default. Windows SmartScreen will show
"Windows protected your PC / Unknown publisher" on first run; users must click
*More info → Run anyway*. Some corporate AV policies block unsigned installers
outright.

The workflow already passes `CSC_LINK` and `CSC_KEY_PASSWORD` through to
electron-builder. To sign, add those two repository secrets (`CSC_LINK` =
base64-encoded `.pfx`, `CSC_KEY_PASSWORD` = its password) — no code or config
change is needed. For Azure Trusted Signing or an HSM-backed EV cert, set
`build.win.signtoolOptions` / `azureSignOptions` in `package.json` instead.

## Security model

- Renderer: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
  (also in workers/subframes), `webviewTag: false`, DevTools disabled when packaged.
- No IPC channels. Preload exposes only `window.desktop = { isDesktop, platform, versions }`.
- `app://app/*` handler only serves files inside `dist/` (host check + normalised
  path clamp) and attaches a Content-Security-Policy to HTML responses. The only
  remote origin allowed by the CSP is Google Fonts (from `src/index.css`).
- Navigation is locked to the app origin. `window.open`:
  `http(s)` → system browser; `blob:` from the app origin and `about:blank`
  (attachment preview, print preview) → sandboxed child window with navigation
  denied; anything else → denied.
- All permission requests are denied except `clipboard-sanitized-write`
  (used by "Copy query").

## What CI verifies on a real Windows runner

`.github/workflows/desktop-windows.yml` (runs on PRs touching desktop files,
`v*` tags and manual dispatch):

1. `typecheck`, `test`, `smoke`, `dist:win` (installer produced).
2. Launches the unpacked app with `--smoke-test` twice: checks `app://` origin,
   React mounted, CSS applied, secure context, no Node globals in the renderer,
   preload surface is exactly `isDesktop,platform,versions`, localStorage and
   IndexedDB writable, and that both **persist across restart**.
3. Silent-installs the NSIS `.exe`, checks install dir
   (`%LOCALAPPDATA%\Programs\Text Analysis`, per-user), Desktop + Start Menu
   shortcuts, HKCU uninstall entry and version, launches the installed app
   (same `%APPDATA%\Text Analysis` user data).
4. Single-instance lock (second process exits, first keeps running).
5. Silent uninstall: binaries and shortcuts removed, user data **preserved**.
6. Uploads the installer artifact; attaches to the release only on tag pushes.

`--smoke-test` / `--smoke-out=<file>` are diagnostic flags and are a no-op in
normal launches.

## Data locations (per-user install)

| What | Where |
|---|---|
| Program files | `%LOCALAPPDATA%\Programs\Text Analysis\` |
| User data (localStorage, IndexedDB, caches) | `%APPDATA%\Text Analysis\` |
| Uninstall entry | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\` |

Uninstalling never deletes `%APPDATA%\Text Analysis` (`deleteAppDataOnUninstall: false`).

## Bump the version

The installer's version comes from `package.json → version`. Bump it before
tagging (`npm version minor`), since NSIS uses it for upgrade detection.
