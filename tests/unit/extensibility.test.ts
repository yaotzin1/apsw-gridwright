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

        api.use(activeOnlyPlugin());
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

    it('lets a caller drop a built-in entirely', () => {
        // Only sorting is installed, so filters and pagination are simply never applied.
        const api = makeGrid([sortingPlugin<Person>()], 2);
        expect(api.getState().rows).toHaveLength(7);
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
