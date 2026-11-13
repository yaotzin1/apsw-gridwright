import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    tsconfig: 'tsconfig.build.json',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2021',
    external: ['@apsw/gridwright', '@apsw/gridwright/view', 'vue'],
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' };
    },
});
