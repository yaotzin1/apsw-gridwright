import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { GridwrightError } from '../../src/core/errors';
import { STAGE_ORDER } from '../../src/core/pipeline';
import { createLocalDataSource } from '../../src/data/local';
import type { DataSource, DataSourceCapabilities, GridApi } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const ready = (api: GridApi<Person>) => vi.waitFor(() => expect(api.getState().status).toBe('ready'));

const localGrid = () =>
    createGridEngine<Person>({
        columns: personColumns,
        dataSource: createLocalDataSource(people),
        initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
    });

/** A source that pages for itself, optionally able to hand over everything when asked. */
function pagingSource(options: { fetchAll?: boolean } = {}): DataSource<Person> {
    const capabilities: DataSourceCapabilities = {
        sort: true,
        filter: true,
        search: true,
        paginate: true,
    };

    const source: DataSource<Person> = {
        kind: 'test:paging',
        capabilities,
        fetch: ({ query }) => {
            const { pageIndex, pageSize } = query.pagination;
            return {
                rows: people.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
                totalRows: people.length,
            };
        },
    };

    return options.fetchAll ? { ...source, fetchAll: () => ({ rows: people }) } : source;
}

describe('getMatchingRows', () => {
    it('returns every row matching the query, not the page on screen', async () => {
        const api = localGrid();
        await ready(api);

        expect(api.getState().rows).toHaveLength(3);
        expect(api.getMatchingRows().rows).toHaveLength(people.length);
        expect(api.getMatchingRows().isComplete).toBe(true);
        api.destroy();
    });

    it('applies the filter, the search and the sort that shaped the result', async () => {
        const api = localGrid();
        await ready(api);

        api.setFilter('department', { operator: 'eq', value: 'Research' });
        api.toggleSort('name');
        await ready(api);

        const { rows, isComplete } = api.getMatchingRows();

        expect(rows.map((row) => row.name)).toEqual(['Evelyn Boyd', 'Katherine Johnson', 'Mary Jackson']);
        expect(isComplete).toBe(true);
        api.destroy();
    });

    it('runs a third-party stage below pagination and skips one above it', async () => {
        const api = localGrid();
        await ready(api);

        api.use({
            name: 'test:active-only',
            setup: (context) =>
                context.registerStage({
                    id: 'test:active-only',
                    order: STAGE_ORDER.FILTER + 1,
                    capability: 'filter',
                    run: (rows) => {
                        const kept = rows.filter((row) => row.active);
                        return { rows: kept, totalRows: kept.length };
                    },
                }),
        });

        api.use({
            name: 'test:decorate',
            setup: (context) =>
                context.registerStage({
                    id: 'test:decorate',
                    order: STAGE_ORDER.POST,
                    run: () => [],
                }),
        });

        await ready(api);

        // The active-only stage shaped the set; the decorating stage after pagination did not,
        // or an export of "everything" would be empty.
        expect(api.getMatchingRows().rows.map((row) => row.active)).toEqual([true, true, true, true, true]);
        api.destroy();
    });

    it('reports incomplete for a source that pages, whatever the count', async () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: pagingSource(),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        });
        await ready(api);

        const matching = api.getMatchingRows();

        expect(matching.rows).toHaveLength(3);
        // The whole point: three rows are in memory, and they are not the answer to "all rows".
        expect(matching.isComplete).toBe(false);
        api.destroy();
    });
});

describe('fetchAllRows', () => {
    it('resolves from memory when the source does not page', async () => {
        const api = localGrid();
        await ready(api);

        await expect(api.fetchAllRows()).resolves.toHaveLength(people.length);
        api.destroy();
    });

    it('asks a paging source for everything through fetchAll', async () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: pagingSource({ fetchAll: true }),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        });
        await ready(api);

        await expect(api.fetchAllRows()).resolves.toHaveLength(people.length);
        api.destroy();
    });

    it('refuses rather than passing off one page as the whole result', async () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: pagingSource(),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        });
        await ready(api);

        await expect(api.fetchAllRows()).rejects.toBeInstanceOf(GridwrightError);
        await expect(api.fetchAllRows()).rejects.toThrow(/fetchAll/);
        api.destroy();
    });

    it('changes nothing on screen and announces no fetch', async () => {
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: pagingSource({ fetchAll: true }),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        });
        await ready(api);

        const before = api.getState();
        const started = vi.fn();
        api.on('fetch:start', started);

        await api.fetchAllRows();

        expect(started).not.toHaveBeenCalled();
        expect(api.getState().rows).toBe(before.rows);
        expect(api.getState().version).toBe(before.version);
        api.destroy();
    });
});
