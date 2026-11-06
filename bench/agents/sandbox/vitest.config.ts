import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

// Hidden tests are copied into a trial only at grade time, under __bench__/, so an agent working in
// the trial never sees them.
export default defineConfig({
    resolve: { alias: { 'bench-harness': here('harness/index.ts') } },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [here('harness/setup.ts')],
        include: ['trials/**/__bench__/*.test.tsx'],
        testTimeout: 15_000,
    },
});
