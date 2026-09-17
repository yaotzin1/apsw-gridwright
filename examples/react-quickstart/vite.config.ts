import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Vite for the quickstart, using the repository's own dev dependencies. There is no nested
 * `package.json` and nothing extra to install: `npm run example:react` from the root serves this.
 *
 * **The aliases below do not belong in your project.** They exist because this example lives inside
 * the package it demonstrates, so the specifiers resolve to `src/` and the example type-checks and
 * lints with the rest of the repository -- which is what stops it drifting away from the real API.
 * In your own project you run `npm install apsw-gridwright` and the same three specifiers resolve
 * from `node_modules` with no configuration at all.
 */
const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    root: root('.'),
    // React's JSX transform, without @vitejs/plugin-react: esbuild does it, and the plugin's extra
    // is Fast Refresh, which an example nobody edits in place does not need.
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: {
            'apsw-gridwright/react': root('../../src/react/index.ts'),
            'apsw-gridwright/locales': root('../../src/locales/index.ts'),
            'apsw-gridwright/styles.css': root('../../src/styles/styles.css'),
            'apsw-gridwright': root('../../src/index.ts'),
        },
    },
    server: { port: 5174, open: false },
});
