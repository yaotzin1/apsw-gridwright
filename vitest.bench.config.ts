import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

/**
 * Wall-clock measurements of the React render. Kept out of the default run because timings are
 * noisy and a gate that flakes teaches people to ignore gates. `npm run bench:render` prints them.
 * Written out rather than merged with vitest.config.ts, because merging concatenates `include`.
 */
export default defineConfig({
    resolve: {
        alias: {
            'apsw-gridwright/react': source('src/react/index.ts'),
            'apsw-gridwright/locales': source('src/locales/index.ts'),
            'apsw-gridwright': source('src/index.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['tests/setup.ts'],
        include: ['tests/bench/**/*.bench-test.{ts,tsx}'],
        testTimeout: 300_000,
    },
});
