import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dist = (file: string) => fileURLToPath(new URL(`./dist/${file}`, import.meta.url));

/**
 * The smoke suite imports the *built* package through its published entry points, never `src/`.
 * A unit suite proves the code is right; this proves the artifact a consumer installs is usable.
 * Run it with `npm run test:smoke`, which builds first.
 */
export default defineConfig({
    resolve: {
        alias: {
            'apsw-gridwright/react': dist('react/index.js'),
            'apsw-gridwright/locales': dist('locales/index.js'),
            'apsw-gridwright': dist('index.js'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['tests/setup.ts'],
        include: ['tests/smoke/**/*.test.{ts,tsx}'],
    },
});
