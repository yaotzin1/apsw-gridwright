// @vitest-environment node
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

/**
 * What a consumer's bundler keeps.
 *
 * Every feature being an add-on is only worth something if an application that lists none of them
 * does not ship them. A part that imported an add-on "just to check whether it is on" would pull the
 * whole feature into every bundle while every other test stayed green, so the built entry is bundled
 * here the way an application bundler would, and searched for each feature's own strings.
 */

const bundle = async (source: string): Promise<string> => {
    const result = await build({
        stdin: { contents: source, resolveDir: process.cwd(), loader: 'js' },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        treeShaking: true,
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        logLevel: 'silent',
    });
    return result.outputFiles[0]!.text;
};

/** A string only that feature's code contains. */
const FEATURES = {
    filters: 'gw-filter-dialog',
    export: 'gw-export-menu',
    rowActions: 'gw-bubble',
    inlineEditing: 'gw-edit-trigger',
    tree: 'gw-tree-cell',
    columnLayout: 'gw-resize-handle',
    rowDetail: 'gw-detail-panel',
    virtual: 'gridwright:virtual',
    // The selection checkbox imports `useCellTabIndex` from the navigation context; this proves that
    // brings the context along and not the add-on.
    cellNavigation: 'data-gw-cell',
    // Not the add-on's name: the core search plugin shares it, and that plugin is always bundled.
    search: 'gw-search',
} as const;

describe('tree shaking the built react entry', () => {
    it('leaves every feature add-on out of an application that imports only the grid', async () => {
        const code = await bundle(`import { Gridwright } from './dist/react/index.js'; console.log(Gridwright);`);

        for (const [feature, marker] of Object.entries(FEATURES)) {
            expect(code.includes(marker), `${feature} was bundled`).toBe(false);
        }
        // The core add-ons are the default, so they stay.
        expect(code).toContain('gridwright:sorting');
        expect(code).toContain('gw-pagination');
    });

    it('keeps exactly the add-ons an application imports', async () => {
        const code = await bundle(
            `import { Gridwright, columnFilters } from './dist/react/index.js'; console.log(Gridwright, columnFilters);`,
        );

        expect(code).toContain(FEATURES.filters);
        expect(code).not.toContain(FEATURES.export);
        expect(code).not.toContain(FEATURES.tree);
    });

    it('does not drag the windowed body in behind rowDetail, which only names it to refuse it', async () => {
        const code = await bundle(`import { Gridwright, rowDetail } from './dist/react/index.js'; console.log(Gridwright, rowDetail);`);

        expect(code).toContain(FEATURES.rowDetail);
        // `rowDetail()` reads the virtual add-on's name so it can refuse to be listed beside it.
        // Naming a feature must not mean bundling it.
        expect(code).not.toContain('gw-row--skeleton');
        expect(code).not.toContain(FEATURES.tree);
    });
});
