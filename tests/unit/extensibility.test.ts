import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { STAGE_ORDER } from '../../src/core/pipeline';
import { corePlugins, sortingPlugin } from '../../src/plugins';
import { createLocalDataSource } from '../../src/data/local';
import type { GridPlugin } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const makeGrid = (plugins?: readonly GridPlugin<Person>[], pageSize = 10) =>
    createGridEngine<Person>({
        columns: personColumns,
        dataSource: createLocalDataSource<Person>(people),
        initialQuery: { pagination: { pageIndex: 0, pageSize } },
        ...(plugins ? { plugins } : {}),
    });

/** A stage that hides inactive people, written the way a consumer would write one. */
const activeOnlyPlugin = (): GridPlugin<Person> => ({
    name: 'test:active-only',
    setup(context) {
        return context.registerStage({
            id: 'test:active-only',
            order: STAGE_ORDER.FILTER + 1,
            capability: 'filter',
            run(rows) {
                const active = rows.filter((row) => row.active);
                return { rows: active, totalRows: active.length };
            },
        });
    },
});

describe('third-party plugins', () => {
    it('narrows the rows and the reported total', () => {
        const api = makeGrid([...corePlugins<Person>(), activeOnlyPlugin()]);
        expect(api.getState().totalRows).toBe(5);
        expect(api.getState().rows.every((row) => row.data.active)).toBe(true);
        api.destroy();
    });

    it('takes effect immediately when added after the first fetch', () => {
        const api = makeGrid();
        expect(api.getState().totalRows).toBe(7);

        api.use(activeOnlyPlugin());
        expect(api.getState().totalRows).toBe(5);
        api.destroy();
    });

    it('is fully removed when its subscription is released', () => {
        const api = makeGrid();
        const remove = api.use(activeOnlyPlugin());
        expect(api.getState().totalRows).toBe(5);

        remove();
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('runs a teardown returned by setup', () => {
        const teardown = vi.fn();
        const api = makeGrid();
        api.use({ name: 'test:teardown', setup: () => teardown });

        api.destroy();
        expect(teardown).toHaveBeenCalledOnce();
    });

    it('refuses two stages with the same id', () => {
        // Silently replacing a stage makes plugin order load-bearing and invisible.
        const api = makeGrid();
        api.use(activeOnlyPlugin());
        const errors: unknown[] = [];
        api.on('plugin:error', ({ error }) => errors.push(error));

        // A different plugin reusing another's stage id: the name is free, the stage id is not.
        api.use({ ...activeOnlyPlugin(), name: 'test:impostor' });
        expect(String(errors[0])).toMatch(/already registered/i);
        api.destroy();
    });

    it('reports a plugin that throws during setup without failing the grid', () => {
        const api = makeGrid();
        const listener = vi.fn();
        api.on('plugin:error', listener);

        api.use({
            name: 'test:broken',
            setup() {
                throw new Error('setup exploded');
            },
        });

        expect(listener).toHaveBeenCalledWith({ plugin: 'test:broken', error: expect.any(Error) });
        expect(api.getState().status).toBe('ready');
        api.destroy();
    });

    it('publishes plugin metadata onto the grid state', () => {
        const api = makeGrid();
        api.use({
            name: 'test:meta',
            setup(context) {
                context.setMeta('answer', 42);
            },
        });

        expect(api.getState().meta['test:meta:answer']).toBe(42);
        api.destroy();
    });

    it('lets a caller drop the built-ins entirely', () => {
        // Only sorting is installed, so filters and pagination are simply never applied.
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createLocalDataSource<Person>(people),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 2 } },
            corePlugins: false,
            plugins: [sortingPlugin<Person>()],
        });
        expect(api.getState().rows).toHaveLength(7);
        api.destroy();
    });

    it('adds plugins to the core set rather than replacing it', () => {
        // Before: passing one plugin silently removed pagination. Now the page is still cut.
        const api = makeGrid([activeOnlyPlugin()], 2);
        expect(api.getState().rows).toHaveLength(2);
        expect(api.getState().totalRows).toBe(5);
        api.destroy();
    });

    it('replaces a core plugin with one of the same name', () => {
        const custom: GridPlugin<Person> = {
            name: 'gridwright:pagination',
            setup: (context) =>
                context.registerStage({ id: 'test:page-of-three', order: STAGE_ORDER.PAGINATE, run: (rows) => rows.slice(0, 3) }),
        };
        const api = makeGrid([custom], 2);
        // The core paginator is not installed, so its page size of two does not apply.
        expect(api.getState().rows).toHaveLength(3);
        api.destroy();
    });

    it('removes a plugin by name, including one installed at creation', () => {
        const api = makeGrid([activeOnlyPlugin()]);
        expect(api.getState().totalRows).toBe(5);

        expect(api.removePlugin('test:active-only')).toBe(true);
        expect(api.getState().totalRows).toBe(7);
        expect(api.removePlugin('test:active-only')).toBe(false);

        // Removed, so the name is free again.
        api.use(activeOnlyPlugin());
        expect(api.getState().totalRows).toBe(5);
        expect(() => api.use(activeOnlyPlugin())).toThrow(/already installed/);
        api.destroy();
    });

    it('refuses two plugins with one name', () => {
        expect(() => makeGrid([activeOnlyPlugin(), activeOnlyPlugin()])).toThrow(/two plugins are named "test:active-only"/);
    });
});

describe('stage suppression and skipping', () => {
    const suppressing = (stageId: string, name = 'test:suppress'): GridPlugin<Person> => ({
        name,
        setup: (context) => context.suppressStage(stageId),
    });

    it('suppresses another plugin\'s stage while installed, and restores it when removed', () => {
        const api = makeGrid(undefined, 2);
        expect(api.getState().rows).toHaveLength(2);

        const remove = api.use(suppressing('core:paginate'));
        expect(api.getState().rows).toHaveLength(7);

        remove();
        expect(api.getState().rows).toHaveLength(2);
        api.destroy();
    });

    it('counts suppressions, so a stage stays off until every suppressor lets go', () => {
        const api = makeGrid(undefined, 2);
        const first = api.use(suppressing('core:paginate', 'test:first'));
        const second = api.use(suppressing('core:paginate', 'test:second'));

        first();
        expect(api.getState().rows).toHaveLength(7);
        second();
        expect(api.getState().rows).toHaveLength(2);
        api.destroy();
    });

    it('suppresses a stage registered after the suppression', () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createLocalDataSource<Person>(people),
            plugins: [suppressing('test:active-only', 'test:early'), activeOnlyPlugin()],
        });
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('lets a stage skip itself per pass', () => {
        let enabled = false;
        const optional: GridPlugin<Person> = {
            name: 'test:optional',
            setup: (context) =>
                context.registerStage({
                    id: 'test:optional',
                    order: STAGE_ORDER.FILTER + 2,
                    skip: () => !enabled,
                    run: (rows) => {
                        const kept = rows.filter((row) => row.department === 'Research');
                        return { rows: kept, totalRows: kept.length };
                    },
                }),
        };
        const api = makeGrid([optional]);
        expect(api.getState().totalRows).toBe(7);

        enabled = true;
        api.invalidatePipeline();
        expect(api.getState().totalRows).toBe(3);
        api.destroy();
    });

    it('treats a skip predicate that throws as a failing plugin, not an empty grid', () => {
        const errors = vi.fn();
        const broken: GridPlugin<Person> = {
            name: 'test:broken-skip',
            setup: (context) =>
                context.registerStage({
                    id: 'test:broken-skip',
                    order: STAGE_ORDER.FILTER + 3,
                    skip: () => {
                        throw new Error('predicate exploded');
                    },
                    run: () => [],
                }),
        };
        const api = makeGrid([broken]);
        api.on('plugin:error', errors);
        api.invalidatePipeline();
        expect(api.getState().totalRows).toBe(7);
        expect(errors).toHaveBeenCalledWith(expect.objectContaining({ plugin: 'test:broken-skip' }));
        api.destroy();
    });

    it('keeps a listener that throws from stopping the others', () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createLocalDataSource<Person>(people),
            selectionMode: 'multiple',
        });
        const second = vi.fn();
        api.on('selection:change', () => {
            throw new Error('listener exploded');
        });
        api.on('selection:change', second);

        api.toggleRowSelection(1);
        expect(second).toHaveBeenCalledOnce();
        api.destroy();
    });
});
