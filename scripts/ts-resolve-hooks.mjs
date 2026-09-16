/**
 * Node test-runner resolution hook.
 *
 * The application source uses extension-less relative imports (Vite/bundler
 * style). Node's ESM loader requires explicit extensions, so this hook resolves
 * `./foo` → `./foo.ts` for the `node --test` runs. Nothing here ships to the app.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        const url = new URL(candidate, context.parentURL);
        try {
          if (existsSync(fileURLToPath(url))) return nextResolve(candidate, context);
        } catch {
          /* ignore and fall through */
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
