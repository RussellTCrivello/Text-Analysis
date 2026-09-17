/**
 * Shipped application identity.
 *
 * `__APP_VERSION__` / `__APP_NAME__` are injected by Vite (see `define` in
 * vite.config.ts) straight from package.json, which is also what drives the
 * installer filename, the NSIS shortcut and Electron's `app.getVersion()`.
 * Nothing in the UI should hardcode a version string — that is how the shell
 * ended up advertising v2.1.0 while the installer built 1.0.0.
 *
 * The `typeof` guards keep this importable from plain `node --test` and the SSR
 * smoke harnesses, which do not go through the Vite `define` pass.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export const APP_NAME: string = typeof __APP_NAME__ === 'string' ? __APP_NAME__ : 'Text Analysis Manager';

/** Version rendered for display, e.g. `v2.1.0`. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
