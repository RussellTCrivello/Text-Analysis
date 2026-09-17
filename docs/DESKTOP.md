# Desktop build (Windows .exe installer)

The desktop app wraps the exact same Vite bundle in **Electron** and packages it
with **electron-builder** into an NSIS installer (`Text Analysis-Setup-<version>.exe`).

## Layout

| Path | Purpose |
|---|---|
| `electron/main.cjs` | Main process: creates the window, serves `dist/` over a secure `app://` origin (stable localStorage / IndexedDB), opens external links in the system browser, single-instance lock. |
| `electron/preload.cjs` | Sandboxed bridge exposing only `window.desktop = { isDesktop, platform, versions }`. |
| `scripts/electron-dev.mjs` | Starts Vite, waits for the port, launches Electron against it with DevTools. |
| `build/` | Installer assets (`icon.ico`, `icon.png`). |
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
- If symlink errors appear during `dist:win`, enable Developer Mode in Windows
  or run the terminal as Administrator (electron-builder's code-sign tooling
  extracts symlinks).
- Building the Windows installer from macOS/Linux also works (`npm run dist:win`
  uses Wine only if you enable code signing / icons need conversion).

## Build in CI

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The `Desktop (Windows installer)` workflow runs `typecheck` + `test`, builds the
installer, uploads it as the `TextAnalysis-windows-installer` artifact and
attaches the `.exe` to the release. It can also be run manually from the Actions
tab (`workflow_dispatch`) — the artifact is then available on the run page.

## Icon

Add `build/icon.ico` (multi-size, include 256×256) and `build/icon.png` (512×512).
Quick way to make them from `public/favicon.svg`:

```bash
npx --yes svg2png-cli public/favicon.svg -w 512 -h 512 -o build/icon.png   # or any SVG rasterizer
npx --yes png-to-ico build/icon.png > build/icon.ico
```

Without them the build still succeeds and uses the default Electron icon.

## Code signing (optional, recommended for distribution)

Unsigned installers trigger the Windows SmartScreen "unknown publisher" prompt.
To sign, provide a certificate to electron-builder via the `CSC_LINK` /
`CSC_KEY_PASSWORD` secrets in the workflow (or `win.signtoolOptions` /
Azure Trusted Signing in the `build` config) — no code changes required.

## Bump the version

The installer's version comes from `package.json → version`. Bump it before
tagging (`npm version minor`), since NSIS uses it for upgrade detection.
