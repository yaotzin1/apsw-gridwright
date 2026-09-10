import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { GridwrightError } from '../../src/core/errors';
import { createLocalDataSource } from '../../src/data/local';
import { createRemoteDataSource } from '../../src/data/remote';
import { filteringPlugin, paginationPlugin, searchPlugin, sortingPlugin } from '../../src/plugins';
import type { GridApi, GridPlugin } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const gridWith = (plugins: readonly GridPlugin<Person>[]): GridApi<Person> =>
    createGridEngine<Person>({
        columns: personColumns,
        dataSource: createLocalDataSource<Person>(people),
        initialQuery: { pagination: { pageIndex: 0, pageSize: 10 } },
        plugins,
    });

const names = (api: GridApi<Person>): string[] => api.getState().rows.map((row) => row.data.name);

describe('searchPlugin options', () => {
    it('matches substrings by default', () => {
        const api = gridWith([searchPlugin<Person>(), paginationPlugin<Person>()]);
        api.setSearch('research');
        expect(names(api)).toHaveLength(3);
        api.destroy();
    });

    it('matches whole words only when asked', () => {
        // "Ada" appears inside "Vaughan" for a substring search on "a"; whole-word search is for
        // the case where that noise makes the result useless.
        const api = gridWith([searchPlugin<Person>({ wholeWord: true }), paginationPlugin<Person>()]);

        api.setSearch('Ada');
        expect(names(api)).toEqual(['Ada Lovelace']);

        api.setSearch('Lov');
        expect(names(api)).toEqual([]);
        api.destroy();
    });

    it('restricts the search to named columns', () => {
        const api = gridWith([searchPlugin<Person>({ columnIds: ['name'] }), paginationPlugin<Person>()]);

        api.setSearch('research');
        expect(names(api)).toEqual([]);

        api.setSearch('hopper');
        expect(names(api)).toEqual(['Grace Hopper']);
        api.destroy();
    });

    it('skips columns marked unsearchable', () => {
        const api = createGridEngine<Person>({
            columns: [
                { id: 'name' },
                { id: 'department', searchable: false },
            ],
            dataSource: createLocalDataSource<Person>(people),
            plugins: [searchPlugin<Person>()],
        });

        api.setSearch('research');
        expect(api.getState().rows).toHaveLength(0);
        api.destroy();
    });
});

describe('column overrides', () => {
    it('uses a column comparator instead of the default ordering', () => {
        // Sorting by the last name of a "First Last" string: the default comparator cannot know
        // that, which is exactly what a per-column comparator is for.
        const api = createGridEngine<Person>({
            columns: [
                {
                    id: 'name',
                    comparator: (a: string, b: string) =>
                        a.split(' ').at(-1)!.localeCompare(b.split(' ').at(-1)!),
                },
            ],
            dataSource: createLocalDataSource<Person>(people),
            plugins: [sortingPlugin<Person>()],
        });

        api.toggleSort('name');
        expect(names(api)[0]).toBe('Evelyn Boyd');
        api.destroy();
    });

    it('uses a column filterFn instead of the operator vocabulary', () => {
        const api = createGridEngine<Person>({
            columns: [
                { id: 'name' },
                { id: 'salary', filterFn: (value: number) => value > 125_000 },
            ],
            dataSource: createLocalDataSource<Person>(people),
            plugins: [filteringPlugin<Person>()],
        });

        api.setFilter('salary', { operator: 'eq', value: 'ignored by filterFn' });
        expect(names(api)).toEqual(['Grace Hopper', 'Evelyn Boyd']);
        api.destroy();
    });

    it('ignores a sort on a column marked unsortable', () => {
        const api = createGridEngine<Person>({
            columns: [{ id: 'name' }, { id: 'salary', sortable: false }],
            dataSource: createLocalDataSource<Person>(people),
            plugins: [sortingPlugin<Person>()],
        });

        api.toggleSort('salary');
        expect(api.getState().query.sort).toEqual([]);
        expect(names(api)[0]).toBe('Ada Lovelace');
        api.destroy();
    });

    it('drops a stale sort spec for a column that no longer exists', () => {
        // Column sets change at runtime. A leftover sort spec must not blank the grid.
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createLocalDataSource<Person>(people),
            initialQuery: { sort: [{ columnId: 'ghost', direction: 'asc' }] },
        });

        expect(api.getState().rows).toHaveLength(7);
        api.destroy();
    });
});

describe('remote backoff', () => {
    it('waits between attempts and aborts the wait when the grid is destroyed', async () => {
        let attempts = 0;
        const source = createRemoteDataSource<Person>({
            retry: { attempts: 5, delayMs: 50 },
            fetcher: async () => {
                attempts += 1;
                throw new GridwrightError('flaky', { status: 503 });
            },
        });

        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });

        await vi.waitFor(() => expect(attempts).toBeGreaterThanOrEqual(1));
        api.destroy();

        const seenAtDestroy = attempts;
        await new Promise((resolve) => setTimeout(resolve, 200));

        // The abort stops the retry loop rather than letting it run out the clock against a grid
        // that no longer exists.
        expect(attempts).toBeLessThanOrEqual(seenAtDestroy + 1);
        expect(api.getState().status).not.toBe('ready');
    });

    it('refuses to start when the request is already aborted', async () => {
        const fetcher = vi.fn();
        const source = createRemoteDataSource<Person>({ fetcher, retry: { attempts: 0 } });
        const controller = new AbortController();
        controller.abort();

        await expect(
            source.fetch({
                query: { sort: [], filters: [], search: '', pagination: { pageIndex: 0, pageSize: 10 } },
                columns: [],
                signal: controller.signal,
                meta: {},
            }),
        ).rejects.toThrow(/aborted/i);

        expect(fetcher).not.toHaveBeenCalled();
    });
});
