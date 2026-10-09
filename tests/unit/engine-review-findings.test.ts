import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { normalizeQuery, queriesEqual } from '../../src/core/query';
import type { DataSource, DataSourceRequest, DataSourceResult, FilterSpec, GridApi, GridQuery } from '../../src/core/types';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

const capabilities = { sort: false, filter: false, search: false, paginate: false } as const;

/** A source whose answers the test releases by hand. */
function manualSource(extra: Partial<DataSource<Person>> = {}) {
    const pending: Array<{ request: DataSourceRequest<Person>; settle: ReturnType<typeof deferred<DataSourceResult<Person>>> }> = [];
    const source: DataSource<Person> = {
        kind: 'manual',
        capabilities,
        fetch(request) {
            const settle = deferred<DataSourceResult<Person>>();
            pending.push({ request, settle });
            return settle.promise;
        },
        ...extra,
    };
    return { source, pending };
}

const grid = (source: DataSource<Person>, options: Record<string, unknown> = {}): GridApi<Person> =>
    createGridEngine<Person>({ columns: personColumns, dataSource: source, initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } }, ...options });

describe('a result that cannot be applied', () => {
    it('ends in an error instead of leaving the grid loading for ever', async () => {
        const { source, pending } = manualSource();
        const onError = vi.fn();
        let explode = false;
        const api = grid(source, {
            onError,
            getRowId: (row: Person) => {
                if (explode) throw new Error('row id blew up');
                return row.id;
            },
        });
        expect(api.getState().status).toBe('loading');

        explode = true;
        pending[0]!.settle.resolve({ rows: people.slice(0, 3) });
        await vi.waitFor(() => expect(api.getState().status).toBe('error'));

        expect(api.getState().error?.message).toContain('row id blew up');
        expect(onError).toHaveBeenCalledTimes(1);
    });
});

describe('the query a result is read against', () => {
    it('is the one the fetch was sent with, not one still waiting out the debounce', async () => {
        const { source, pending } = manualSource();
        const api = grid(source, { queryDebounceMs: 30 });
        // The first fetch went out for page 0 and has not answered. Moving to page 1 only reaches
        // the query, not the wire, until the debounce runs out.
        expect(pending).toHaveLength(1);
        api.setPage(1);
        expect(api.getState().query.pagination.pageIndex).toBe(1);

        pending[0]!.settle.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        // Not `waitFor`: it polls slower than the 30ms debounce, which would have sent page 1 by then.
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(api.getState().status).toBe('ready');

        // These rows are page 0's, so there is no page before them, and the pager says so.
        expect(api.getState().hasPreviousPage).toBe(false);
        expect(api.getState().rows.map((row) => row.id)).toEqual(people.slice(0, 3).map((row) => row.id));
    });
});

describe('what a source publishes beside its rows', () => {
    it('survives a recompute from the cache', async () => {
        const { source, pending } = manualSource();
        const api = grid(source);
        pending[0]!.settle.resolve({ rows: people.slice(0, 3), meta: { cursor: 'abc' } });
        await vi.waitFor(() => expect(api.getState().status).toBe('ready'));
        expect(api.getState().meta['cursor']).toBe('abc');

        api.invalidatePipeline();

        expect(api.getState().meta['cursor']).toBe('abc');
    });
});

describe('fetchAllRows and destroy', () => {
    it('aborts the request it started, and does not hand rows to a destroyed grid', async () => {
        let signal: AbortSignal | undefined;
        const release = deferred<DataSourceResult<Person>>();
        const { source } = manualSource({
            capabilities: { ...capabilities, paginate: true },
            fetch: async () => ({ rows: people.slice(0, 3), totalRows: 7 }),
            fetchAll: (request) => {
                signal = request.signal;
                return release.promise;
            },
        });
        const api = grid(source);
        await vi.waitFor(() => expect(api.getState().status).toBe('ready'));

        const all = api.fetchAllRows();
        const outcome = all.then(
            () => 'resolved',
            () => 'rejected',
        );
        await vi.waitFor(() => expect(signal).toBeDefined());
        api.destroy();

        expect(signal!.aborted).toBe(true);
        release.resolve({ rows: people });
        expect(await outcome).toBe('rejected');
    });
});

describe('comparing queries', () => {
    const query = (filters: readonly FilterSpec[]): GridQuery =>
        normalizeQuery({ sort: [], filters, search: '', pagination: { pageIndex: 0, pageSize: 10 } });
    const filter = (value: unknown): FilterSpec => ({ columnId: 'salary', operator: 'eq', value }) as FilterSpec;

    it('treats a NaN filter value as equal to itself, so it does not refetch on every render', () => {
        expect(queriesEqual(query([filter(Number.NaN)]), query([filter(Number.NaN)]))).toBe(true);
    });

    it('does not care about the order of an object value\'s keys', () => {
        expect(queriesEqual(query([filter({ min: 1, max: 2 })]), query([filter({ max: 2, min: 1 })]))).toBe(true);
        expect(queriesEqual(query([filter({ min: 1, max: 2 })]), query([filter({ max: 3, min: 1 })]))).toBe(false);
    });

    it('answers "not equal" for a value that refers to itself, instead of overflowing the stack', () => {
        // A filter value is input, and a structure with a cycle used to be caught and refused.
        const cyclic = (): Record<string, unknown> => {
            const value: Record<string, unknown> = { min: 1 };
            value['self'] = value;
            return value;
        };
        expect(() => queriesEqual(query([filter(cyclic())]), query([filter(cyclic())]))).not.toThrow();
        expect(queriesEqual(query([filter(cyclic())]), query([filter(cyclic())]))).toBe(false);
    });

    it('keeps two filters whose column and operator only collide once joined with a separator', () => {
        const a = { columnId: 'a::b', operator: 'c', value: 1 } as unknown as FilterSpec;
        const b = { columnId: 'a', operator: 'b::c', value: 2 } as unknown as FilterSpec;
        expect(query([a, b]).filters).toHaveLength(2);
    });
});
