import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createRemoteDataSource } from '../../src/data/remote';
import type { DataSource, DataSourceRequest, GridApi } from '../../src/core/types';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

type Answer = { rows: readonly Person[]; totalRows?: number };
type Fetcher = (request: DataSourceRequest<Person>) => Promise<Answer>;
type Debounce = { queryDebounceMs?: number; searchDebounceMs?: number };

const sourceOf = (fetcher: Fetcher) => createRemoteDataSource<Person>({ fetcher, retry: { attempts: 0 } });

function makeGrid(fetcher: Fetcher, debounce: Debounce = {}, keepPreviousData?: boolean): GridApi<Person> {
    return createGridEngine<Person>({
        columns: personColumns,
        dataSource: sourceOf(fetcher),
        initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        ...debounce,
        ...(keepPreviousData !== undefined ? { keepPreviousData } : {}),
    });
}

/** A fetcher that answers at once and remembers every request it was given. */
function recordingFetcher() {
    const requests: DataSourceRequest<Person>[] = [];
    const fetcher: Fetcher = async (request) => {
        requests.push(request);
        return { rows: people.slice(0, 3), totalRows: 7 };
    };
    return { fetcher, requests };
}

const settle = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('debouncing the search term', () => {
    it('sends one request for a burst of keystrokes once the search has been quiet (AC-01)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);
        expect(requests).toHaveLength(1);

        for (const term of ['i', 'in', 'inv', 'invoice']) {
            api.setSearch(term);
            await settle(100);
        }
        expect(requests).toHaveLength(1);

        await settle(300);
        expect(requests).toHaveLength(2);
        expect(requests[1]!.query.search).toBe('invoice');
        api.destroy();
    });

    it('fetches a search change at once when the option is unset (AC-01 default)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher);
        await settle(0);

        api.setSearch('a');
        api.setSearch('ab');
        await settle(0);

        expect(requests.map((request) => request.query.search)).toEqual(['', 'a', 'ab']);
        api.destroy();
    });

    it('lets a page click flush a waiting search, and sends exactly one request (AC-02)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.setSearch('ada');
        await settle(100);
        api.setPage(1);
        await settle(0);

        expect(requests).toHaveLength(2);
        expect(requests[1]!.query.search).toBe('ada');
        expect(requests[1]!.query.pagination.pageIndex).toBe(1);

        await settle(1000);
        expect(requests).toHaveLength(2);
        api.destroy();
    });

    it('does not delay a sort, a filter or a page size change (AC-02)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.toggleSort('name');
        await settle(0);
        api.setFilter('name', { operator: 'contains', value: 'a' });
        await settle(0);
        api.setPageSize(5);
        await settle(0);

        expect(requests).toHaveLength(4);
        api.destroy();
    });

    it('treats a search that moves another facet in the same call as that facet (AC-03)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.setQuery({ search: 'ada', sort: [{ columnId: 'name', direction: 'asc' }] });
        await settle(0);
        expect(requests).toHaveLength(2);

        // A page set explicitly beside a new term is a page change, so it is not delayed either.
        api.setQuery({ search: 'grace', pagination: { pageIndex: 1, pageSize: 3 } });
        await settle(0);
        expect(requests).toHaveLength(3);
        api.destroy();
    });

    it('counts the page reset a new term causes as part of the search change (AC-04)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);
        api.setPage(2);
        await settle(0);
        expect(api.getState().query.pagination.pageIndex).toBe(2);
        expect(requests).toHaveLength(2);

        api.setSearch('ada');
        expect(api.getState().query.pagination.pageIndex).toBe(0);
        await settle(0);
        expect(requests).toHaveLength(2);

        await settle(300);
        expect(requests).toHaveLength(3);
        api.destroy();
    });

    it('keeps queryDebounceMs for every other change when both are set (AC-05)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { queryDebounceMs: 500, searchDebounceMs: 100 });
        await settle(0);

        api.setSearch('a');
        await settle(100);
        expect(requests).toHaveLength(2);

        api.toggleSort('name');
        await settle(400);
        expect(requests).toHaveLength(2);
        await settle(100);
        expect(requests).toHaveLength(3);
        api.destroy();
    });

    it('lets queryDebounceMs alone delay a search as it always has (AC-05)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { queryDebounceMs: 200 });
        await settle(0);

        api.setSearch('a');
        await settle(199);
        expect(requests).toHaveLength(1);
        await settle(1);
        expect(requests).toHaveLength(2);
        api.destroy();
    });

    it.each([Number.NaN, -5, Number.POSITIVE_INFINITY])('reads %s as no delay', async (value) => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: value });
        await settle(0);

        api.setSearch('a');
        await settle(0);

        expect(requests).toHaveLength(2);
        api.destroy();
    });

    it('cancels a pending timer on refresh (AC-06)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.setSearch('ada');
        await api.refresh();
        await settle(1000);

        expect(requests).toHaveLength(2);
        api.destroy();
    });

    it('cancels a pending timer when the source is replaced (AC-06)', async () => {
        const { fetcher } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.setSearch('ada');
        const next = recordingFetcher();
        api.setDataSource(sourceOf(next.fetcher));
        await settle(1000);

        expect(next.requests).toHaveLength(1);
        api.destroy();
    });
});

describe('cancelling and discarding', () => {
    it('aborts the request for the query it leaves as soon as the change is committed (AC-07)', async () => {
        const signals: AbortSignal[] = [];
        const pending = deferred<Answer>();
        let call = 0;
        const api = makeGrid(
            (request) => {
                signals.push(request.signal);
                return call++ === 0 ? Promise.resolve({ rows: [], totalRows: 0 }) : pending.promise;
            },
            { searchDebounceMs: 300 },
        );
        await settle(0);

        api.setPage(1);
        await settle(0);
        expect(signals).toHaveLength(2);
        expect(signals[1]!.aborted).toBe(false);

        // The replacement is 300 ms away, and the page-1 request is already abandoned.
        api.setSearch('ada');
        expect(signals[1]!.aborted).toBe(true);
        expect(signals).toHaveLength(2);
        api.destroy();
    });

    it('discards the answer of a fetcher that ignored its signal (AC-08)', async () => {
        const late = deferred<Answer>();
        let call = 0;
        const api = makeGrid(
            () => (call++ === 0 ? Promise.resolve({ rows: people.slice(0, 3), totalRows: 7 }) : late.promise),
            { searchDebounceMs: 300 },
        );
        await settle(0);
        const settled: boolean[] = [];
        api.on('fetch:settled', ({ ok }) => settled.push(ok));

        api.setPage(1);
        await settle(0);
        api.setSearch('ada');
        // The page-1 answer arrives while the search timer is still running.
        late.resolve({ rows: people.slice(3, 6), totalRows: 7 });
        await settle(0);

        expect(api.getState().rows.map((row) => row.data.name)).toEqual(people.slice(0, 3).map((row) => row.name));
        expect(settled).toEqual([]);
        api.destroy();
    });

    it('ends a superseded request silently, with no error, status or settled event (AC-09)', async () => {
        const first = deferred<Answer>();
        let call = 0;
        const onError = vi.fn();
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: sourceOf(({ signal }) => {
                if (call++ > 0) return Promise.resolve({ rows: people.slice(0, 1), totalRows: 1 });
                signal.addEventListener('abort', () => first.reject(new DOMException('aborted', 'AbortError')));
                return first.promise;
            }),
            onError,
        });
        const errors: unknown[] = [];
        const settled: boolean[] = [];
        api.on('fetch:error', (payload) => errors.push(payload));
        api.on('fetch:settled', ({ ok }) => settled.push(ok));

        api.setSearch('a');
        await settle(0);

        expect(errors).toEqual([]);
        expect(onError).not.toHaveBeenCalled();
        expect(settled).toEqual([true]);
        expect(api.getState().status).toBe('ready');
        api.destroy();
    });

    it('leaves the status and the rows alone while a search waits (AC-10)', async () => {
        const { fetcher } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);
        const before = api.getState().rows;

        api.setSearch('ada');
        await settle(100);

        expect(api.getState().status).toBe('ready');
        expect(api.getState().rows).toBe(before);
        api.destroy();
    });

    it('keeps the previous rows while a superseded request waits for its replacement (AC-10)', async () => {
        const slow = deferred<Answer>();
        let call = 0;
        const api = makeGrid(
            () => (call++ === 0 ? Promise.resolve({ rows: people.slice(0, 3), totalRows: 7 }) : slow.promise),
            { searchDebounceMs: 300 },
            true,
        );
        await settle(0);

        api.setPage(1);
        await settle(0);
        expect(api.getState().status).toBe('refreshing');
        api.setSearch('ada');
        await settle(100);

        expect(api.getState().status).toBe('refreshing');
        expect(api.getState().rows).toHaveLength(3);
        api.destroy();
    });

    it('cancels per engine, so two grids on one source do not abort each other (AC-11)', async () => {
        const signals: AbortSignal[] = [];
        const source = sourceOf(async ({ signal }) => {
            signals.push(signal);
            return { rows: people.slice(0, 3), totalRows: 7 };
        });
        const left = createGridEngine<Person>({ columns: personColumns, dataSource: source });
        const right = createGridEngine<Person>({ columns: personColumns, dataSource: source });
        await settle(0);
        expect(signals).toHaveLength(2);

        left.setSearch('ada');
        await settle(0);

        // The right grid's only request is the second signal; the left grid's search aborted its own.
        expect(signals[1]!.aborted).toBe(false);
        left.destroy();
        right.destroy();
    });

    it('does not cancel an export when the query changes (AC-12)', async () => {
        let exportSignal: AbortSignal | undefined;
        const gate = deferred<void>();
        const source: DataSource<Person> = {
            ...sourceOf(async () => ({ rows: people.slice(0, 3), totalRows: 7 })),
            fetchAll: async ({ signal }) => {
                exportSignal = signal;
                await gate.promise;
                return { rows: people };
            },
        };
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });
        await settle(0);

        const exporting = api.fetchAllRows();
        api.setSearch('ada');
        api.setPage(1);
        await settle(0);
        expect(exportSignal?.aborted).toBe(false);

        gate.resolve();
        await expect(exporting).resolves.toBeDefined();
        api.destroy();
    });

    it('aborts the request and clears the timer on destroy (AC-13)', async () => {
        const { fetcher, requests } = recordingFetcher();
        const api = makeGrid(fetcher, { searchDebounceMs: 300 });
        await settle(0);

        api.setSearch('ada');
        api.destroy();
        await settle(1000);

        expect(requests).toHaveLength(1);
    });
});
