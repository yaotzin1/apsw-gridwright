import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { GridwrightError } from '../../src/core/errors';
import { createRemoteDataSource } from '../../src/data/remote';
import type { DataSourceCapabilities, DataSourceRequest, GridApi } from '../../src/core/types';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

type Fetcher = (request: DataSourceRequest<Person>) => Promise<{ rows: readonly Person[]; totalRows?: number }>;

function makeRemoteGrid(
    fetcher: Fetcher,
    capabilities?: Partial<DataSourceCapabilities>,
    engineOptions: { keepPreviousData?: boolean; pageSize?: number } = {},
): GridApi<Person> {
    return createGridEngine<Person>({
        columns: personColumns,
        dataSource: createRemoteDataSource<Person>({
            fetcher,
            ...(capabilities ? { capabilities } : {}),
            retry: { attempts: 0 },
        }),
        initialQuery: { pagination: { pageIndex: 0, pageSize: engineOptions.pageSize ?? 3 } },
        ...(engineOptions.keepPreviousData !== undefined
            ? { keepPreviousData: engineOptions.keepPreviousData }
            : {}),
    });
}

const ready = (api: GridApi<Person>) => vi.waitFor(() => expect(api.getState().status).toBe('ready'));

describe('capability negotiation', () => {
    it('leaves the rows untouched when the source resolves everything', async () => {
        // The server already sorted and paged. Re-sorting the page locally would reorder 3 rows
        // by a comparator that cannot see the other 4.
        const page = people.slice(4, 7);
        const api = makeRemoteGrid(async () => ({ rows: page, totalRows: 7 }));
        await ready(api);

        api.toggleSort('name');
        await ready(api);

        expect(api.getState().rows.map((row) => row.data.name)).toEqual(page.map((row) => row.name));
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('applies sorting in memory when the source only pages', async () => {
        const api = makeRemoteGrid(
            async () => ({ rows: people.slice(0, 3), totalRows: 7 }),
            { sort: false, filter: false, search: false, paginate: true },
        );
        await ready(api);

        api.toggleSort('salary');
        await ready(api);

        expect(api.getState().rows.map((row) => row.data.name)).toEqual([
            'Katherine Johnson',
            'Ada Lovelace',
            'Grace Hopper',
        ]);
        api.destroy();
    });

    it('passes the whole query to the source so a server can act on it', async () => {
        const fetcher = vi.fn<Fetcher>(async () => ({ rows: [], totalRows: 0 }));
        const api = makeRemoteGrid(fetcher);
        await ready(api);

        api.setSearch('ada');
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

        const request = fetcher.mock.calls[1]![0];
        expect(request.query.search).toBe('ada');
        expect(request.columns.map((column) => column.id)).toContain('salary');
        expect(request.signal).toBeInstanceOf(AbortSignal);
        api.destroy();
    });
});

describe('totals a server did not send', () => {
    it('marks the total inexact and still offers the next page', async () => {
        const api = makeRemoteGrid(async () => ({ rows: people.slice(0, 3) }));
        await ready(api);

        const state = api.getState();
        expect(state.isTotalExact).toBe(false);
        expect(state.hasNextPage).toBe(true);
        expect(state.totalRows).toBe(3);
        api.destroy();
    });

    it('closes the next page when a short page comes back', async () => {
        const api = makeRemoteGrid(async () => ({ rows: people.slice(0, 2) }));
        await ready(api);

        expect(api.getState().isTotalExact).toBe(false);
        expect(api.getState().hasNextPage).toBe(false);
        api.destroy();
    });
});

describe('overlapping requests', () => {
    it('ignores a slow response that a newer query has superseded', async () => {
        // The classic grid race: type "a", type "ab", and the answer to "a" lands last. Without
        // sequencing the reader ends up looking at results for a search they already replaced.
        const first = deferred<{ rows: readonly Person[]; totalRows: number }>();
        const second = deferred<{ rows: readonly Person[]; totalRows: number }>();
        const responses = [first.promise, second.promise];
        let call = 0;

        const api = makeRemoteGrid(() => responses[call++]!);

        api.setSearch('ab');
        second.resolve({ rows: [people[1]!], totalRows: 1 });
        await ready(api);

        first.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await Promise.resolve();

        expect(api.getState().rows.map((row) => row.data.name)).toEqual(['Grace Hopper']);
        expect(api.getState().totalRows).toBe(1);
        api.destroy();
    });

    it('aborts the in-flight request when a new one starts', async () => {
        const signals: AbortSignal[] = [];
        const api = makeRemoteGrid(async (request) => {
            signals.push(request.signal);
            return { rows: [], totalRows: 0 };
        });
        await ready(api);

        api.setSearch('x');
        await vi.waitFor(() => expect(signals).toHaveLength(2));

        expect(signals[0]!.aborted).toBe(true);
        expect(signals[1]!.aborted).toBe(false);
        api.destroy();
    });

    it('aborts on destroy', async () => {
        let captured: AbortSignal | undefined;
        const pending = deferred<{ rows: readonly Person[] }>();
        const api = makeRemoteGrid((request) => {
            captured = request.signal;
            return pending.promise as Promise<{ rows: readonly Person[]; totalRows?: number }>;
        });

        api.destroy();
        expect(captured?.aborted).toBe(true);
    });
});

describe('failure', () => {
    it('surfaces the source message and marks a 500 retryable', async () => {
        const api = makeRemoteGrid(async () => {
            throw new GridwrightError('The reporting service is down.', { status: 503 });
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        expect(api.getState().error).toMatchObject({
            message: 'The reporting service is down.',
            retryable: true,
            status: 503,
        });
        api.destroy();
    });

    it('marks a 404 as not worth retrying', async () => {
        const api = makeRemoteGrid(async () => {
            throw new GridwrightError('No such report.', { status: 404 });
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        expect(api.getState().error?.retryable).toBe(false);
        api.destroy();
    });

    it('keeps the previous page on screen when a refresh fails', async () => {
        let shouldFail = false;
        const api = makeRemoteGrid(async () => {
            if (shouldFail) throw new Error('network down');
            return { rows: people.slice(0, 3), totalRows: 7 };
        });
        await ready(api);

        shouldFail = true;
        api.setSearch('boom');
        await vi.waitFor(() => expect(api.getState().status).toBe('error'));

        // Blanking the table on a failed refresh loses the reader's place for no benefit.
        expect(api.getState().rows).toHaveLength(3);
        api.destroy();
    });

    it('empties the table on failure when keepPreviousData is off', async () => {
        let shouldFail = false;
        const api = makeRemoteGrid(
            async () => {
                if (shouldFail) throw new Error('network down');
                return { rows: people.slice(0, 3), totalRows: 7 };
            },
            undefined,
            { keepPreviousData: false },
        );
        await ready(api);

        shouldFail = true;
        api.setSearch('boom');
        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        expect(api.getState().rows).toHaveLength(0);
        api.destroy();
    });

    it('recovers on refresh', async () => {
        let shouldFail = true;
        const api = makeRemoteGrid(async () => {
            if (shouldFail) throw new Error('network down');
            return { rows: people.slice(0, 3), totalRows: 7 };
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        shouldFail = false;
        await api.refresh();

        expect(api.getState().status).toBe('ready');
        expect(api.getState().error).toBeNull();
        api.destroy();
    });
});

describe('loading states', () => {
    it('reports refreshing rather than loading once rows are on screen', async () => {
        const gate = deferred<{ rows: readonly Person[]; totalRows: number }>();
        let first = true;
        const api = makeRemoteGrid(async (): Promise<{ rows: readonly Person[]; totalRows: number }> => {
            if (first) {
                first = false;
                return { rows: people.slice(0, 3), totalRows: 7 };
            }
            return gate.promise;
        });
        await ready(api);

        api.setSearch('x');
        await vi.waitFor(() => expect(api.getState().status).toBe('refreshing'));
        expect(api.getState().rows).toHaveLength(3);

        gate.resolve({ rows: [people[0]!], totalRows: 1 });
        await ready(api);
        api.destroy();
    });
});

describe('retry policy', () => {
    it('retries a retryable failure and reports success', async () => {
        let attempts = 0;
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createRemoteDataSource<Person>({
                retry: { attempts: 2, delayMs: 0 },
                fetcher: async () => {
                    attempts += 1;
                    if (attempts < 3) throw new GridwrightError('flaky', { status: 502 });
                    return { rows: people.slice(0, 2), totalRows: 2 };
                },
            }),
        });

        await ready(api);
        expect(attempts).toBe(3);
        expect(api.getState().rows).toHaveLength(2);
        api.destroy();
    });

    it('does not retry a failure that will answer the same way forever', async () => {
        let attempts = 0;
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createRemoteDataSource<Person>({
                retry: { attempts: 3, delayMs: 0 },
                fetcher: async () => {
                    attempts += 1;
                    throw new GridwrightError('gone', { status: 404 });
                },
            }),
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        expect(attempts).toBe(1);
        api.destroy();
    });
});

describe('invalidate', () => {
    it('refetches every attached grid', async () => {
        const fetcher = vi.fn<Fetcher>(async () => ({ rows: people.slice(0, 2), totalRows: 2 }));
        const source = createRemoteDataSource<Person>({ fetcher, retry: { attempts: 0 } });
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });
        await ready(api);

        source.invalidate();
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
        api.destroy();
    });
});
