import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    // Declarations are built against the grid's own published declarations (tsconfig.build.json
    // maps the specifiers to ../../dist), so they import its types instead of inlining a copy.
    tsconfig: 'tsconfig.build.json',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2021',
    // Everything this package builds on is a peer. The grid above all: bundling it would give the
    // consumer a second engine, and `instanceof GridwrightError` would fail across the two.
    external: ['apsw-gridwright', 'apsw-gridwright/react', /^@mui\//, /^@emotion\//, 'react', 'react-dom', 'react/jsx-runtime'],
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' };
    },
});
