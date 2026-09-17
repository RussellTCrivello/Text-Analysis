# Release checklist

Shipping a version of **Text Analysis Manager**. The installer, the in-app
version label and the Add/Remove Programs entry all derive from a single
source — `package.json → version` — so the only version you ever edit is that
one.

## 1. Pre-flight

```bash
npm ci
npm run check        # typecheck + unit tests + SSR smoke (22 views)
npm run smoke:dom    # behavioral DOM harness (48 checks)
npm run build        # production bundle
```

All four must pass with no failures. `npm run check` is the repo's definition of
done; CI runs the same commands plus the Windows installer verification.

## 2. Bump the version

```bash
npm version minor    # or patch / major — writes package.json + a git tag
```

This single number drives:

| Surface | Source |
|---|---|
| Status-bar + About dialog | `__APP_VERSION__` injected by Vite (`src/core/appInfo.ts`) |
| Installer filename | `${version}` in `build.win.artifactName` |
| Add/Remove Programs version | electron-builder, from `package.json` |
| Backup envelope metadata | `src/core/backup.ts` |

Never hardcode a version in the UI or the locale files — the locale strings
carry a `{version}` placeholder that the shell substitutes. CI fails the build
if the registry version and `package.json` disagree.

## 3. Verify the branding

- `npm run icons` if `public/favicon.svg` changed (commits `build/icon.ico` +
  `build/icon.png`).
- Product name lives in `package.json → productName` and is echoed by the
  installer, the shortcut, the window title and the CI assertions.
- The **userData directory is deliberately pinned** to `%APPDATA%\Text Analysis`
  in `electron/main.cjs`, independent of `productName`. Renaming the product
  must never strand an existing user's records — CI asserts this.

## 4. Ship

```bash
git push origin main --follow-tags
```

Pushing a `v*` tag runs `.github/workflows/desktop-windows.yml`, which on a real
Windows runner:

1. runs `typecheck`, `test`, `smoke`, `smoke:dom`;
2. builds the NSIS installer;
3. launches the unpacked app twice and checks the `app://` origin, React mount,
   CSS, secure context, absence of Node globals in the renderer, the exact
   preload surface, and that localStorage + IndexedDB **persist across restart**;
4. silently installs, checking install dir, shortcuts, registry entry and
   version match, then launches the installed app against the same userData;
5. verifies the single-instance lock;
6. silently uninstalls, confirming binaries and shortcuts are gone and **user
   data is preserved**;
7. uploads the installer artifact and attaches it to the GitHub Release.

## 5. Post-release

- Update `CHANGELOG.md` (Keep a Changelog format).
- The installer is **unsigned** unless `CSC_LINK` / `CSC_KEY_PASSWORD` secrets
  are set; without them Windows SmartScreen warns on first run. See
  [DESKTOP.md → Code signing](DESKTOP.md#code-signing-optional-recommended-for-distribution).

## Known constraints

- **Storage quota.** The workspace lives in `localStorage` (records) and
  IndexedDB (attachment blobs). Browsers cap `localStorage` at ~5 MB per origin;
  `src/core/persist.ts` raises a typed quota error and the UI surfaces it. Very
  large workspaces should be split or archived via backup files. The desktop
  build has the same cap but a private origin, so it is unaffected by other
  sites.
- **Fonts.** `src/index.css` imports Google Fonts. Offline, the app falls back
  to system fonts — layout is unaffected. No other network access exists.
- **Browser support.** Evergreen Chromium/Firefox/Safari; the desktop build
  pins the Chromium shipped with Electron 38.
