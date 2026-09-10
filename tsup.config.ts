import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'react/index': 'src/react/index.ts',
        // Its own entry so a consumer pays only for the locales they import, rather than carrying
        // every translation in the core bundle.
        'locales/index': 'src/locales/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    // Shared code is extracted into a chunk both entries import. Without it the React entry
    // carries its own copy of the engine, and a consumer importing from both paths ends up with
    // two engines: `instanceof GridwrightError` then fails across the seam.
    splitting: true,
    target: 'es2021',
    // React stays a peer dependency: the core entry must remain importable in Node with no React
    // installed at all, so nothing here may be bundled in.
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    // Copies src/styles/styles.css to dist/styles.css, which `exports["./styles.css"]` publishes.
    publicDir: 'src/styles',
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' };
    },
});
