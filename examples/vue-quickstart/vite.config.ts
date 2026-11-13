import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    root: root('.'),
    resolve: {
        alias: {
            '@apsw/gridwright-vue': root('../../packages/vue/src/index.ts'),
            '@apsw/gridwright/view': root('../../src/view/index.ts'),
            '@apsw/gridwright/styles.css': root('../../src/styles/styles.css'),
            '@apsw/gridwright': root('../../src/index.ts'),
        },
    },
    server: { port: 5176, open: false },
});
