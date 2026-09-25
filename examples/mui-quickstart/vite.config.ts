import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Vite for the MUI example, using the repository's own dev dependencies: `npm run example:mui` from
 * the root serves it on :5175.
 *
 * **The aliases below do not belong in your project.** This example lives inside the repository that
 * publishes both packages, so the specifiers resolve to their sources and the example type-checks
 * with everything else. In your own project, `npm install apsw-gridwright apsw-gridwright-mui
 * @mui/material @emotion/react @emotion/styled` and the same specifiers resolve from node_modules.
 */
const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    root: root('.'),
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: {
            'apsw-gridwright/react': root('../../src/react/index.ts'),
            'apsw-gridwright/locales': root('../../src/locales/index.ts'),
            'apsw-gridwright/styles.css': root('../../src/styles/styles.css'),
            'apsw-gridwright-mui': root('../../packages/mui/src/index.ts'),
            'apsw-gridwright': root('../../src/index.ts'),
        },
    },
    server: { port: 5175, open: false },
});
