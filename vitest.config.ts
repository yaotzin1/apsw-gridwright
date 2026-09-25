import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

export default defineConfig({
    // The workspace packages import the grid by name, as a consumer does. Here the names resolve to
    // the sources, so a package's suites run against the grid in the same commit and share one
    // engine with the grid's own tests. The smoke configs point the same names at the builds.
    resolve: {
        alias: {
            'apsw-gridwright/react': source('src/react/index.ts'),
            'apsw-gridwright/locales': source('src/locales/index.ts'),
            'apsw-gridwright-mui': source('packages/mui/src/index.ts'),
            'apsw-gridwright': source('src/index.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['tests/setup.ts'],
        include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/react/**/*.test.{ts,tsx}', 'packages/*/tests/**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
            exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
            thresholds: {
                statements: 85,
                branches: 80,
                functions: 85,
                lines: 85,
            },
        },
    },
});
