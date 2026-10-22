import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { GridwrightError } from '../../src/core/errors';
import { createRemoteDataSource } from '../../src/data/remote';
import type { DataSource, DataSourceRequest, DataSourceResult, GridApi, GridError, GridQuery } from '../../src/core/types';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

/**
 * Overlapping requests, in every order they can land.
 *
 * Each feature is easy to prove alone. What goes wrong is a second query issued while the first is
 * still in flight and the answers arriving out of order: a slow response must never overwrite a newer
 * one, a late failure must never turn a good page into an error, and an aborted request must never
 * be allowed to settle the grid. This file issues every kind of query change, in pairs and in chains,
 * and delivers the responses in every permutation.
 */

type Gate = ReturnType<typeof deferred<DataSourceResult<Person>>>;

interface Harness {
    readonly api: GridApi<Person>;
    readonly calls: readonly { readonly query: GridQuery; readonly signal: AbortSignal; readonly gate: Gate }[];
    readonly errors: readonly GridError[];
    readonly source: () => DataSource<Person>;
    /** Resolves request `index` with one row that names it, so a row on screen says which request it answers. */
    answer(index: number): void;
    fail(index: number, status?: number): void;
}

const TOTAL = 100;
const marker = (index: number): Person => ({ ...people[0]!, id: 1000 + index, name: `request-${index}` });

function harness(options: { pageSize?: number; debounce?: number; keepPreviousData?: boolean } = {}): Harness {
    const calls: Array<{ query: GridQuery; signal: AbortSignal; gate: Gate }> = [];
    const errors: GridError[] = [];

    const make = (): DataSource<Person> =>
        createRemoteDataSource<Person>({
            retry: { attempts: 0 },
            fetcher: (request: DataSourceRequest<Person>) => {
                const gate = deferred<DataSourceResult<Person>>();
                calls.push({ query: request.query, signal: request.signal, gate });
                return gate.promise as Promise<{ rows: readonly Person[]; totalRows?: number }>;
            },
        });

    const api = createGridEngine<Person>({
        columns: personColumns,
        dataSource: make(),
        initialQuery: { pagination: { pageIndex: 0, pageSize: options.pageSize ?? 3 } },
        ...(options.debounce ? { queryDebounceMs: options.debounce } : {}),
        ...(options.keepPreviousData !== undefined ? { keepPreviousData: options.keepPreviousData } : {}),
        onError: (error) => errors.push(error),
    });

    return {
        api,
        calls,
        errors,
        source: make,
        answer: (index) => calls[index]!.gate.resolve({ rows: [marker(index)], totalRows: TOTAL }),
        fail: (index, status = 503) => calls[index]!.gate.reject(new GridwrightError(`down ${index}`, { status })),
    };
}

/** Lets every promise continuation already queued run. */
const flush = async (): Promise<void> => {
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
};

/** Every ordering of 0..n-1. */
function permutations(n: number): number[][] {
    const result: number[][] = [];
    const walk = (prefix: number[], rest: number[]): void => {
        if (rest.length === 0) {
            result.push(prefix);
            return;
        }
        rest.forEach((value, at) => walk([...prefix, value], [...rest.slice(0, at), ...rest.slice(at + 1)]));
    };
    walk([], Array.from({ length: n }, (_, index) => index));
    return result;
}

/**
 * One way to change what the grid asks for. `step` makes each application distinct from the last, so
 * that two of the same kind in a row are still two different queries and two requests.
 */
interface Change {
    readonly name: string;
    apply(h: Harness, step: number): void;
}

const departments = ['Engineering', 'Research', 'Operations', 'Finance', 'Legal', 'Sales'];

const changes: readonly Change[] = [
    { name: 'search', apply: (h, step) => h.api.setSearch(`term-${step}`) },
    {
        name: 'sort',
        // Alternates the column so each step is a different sort, not a toggle back to nothing.
        apply: (h, step) => h.api.setSort([{ columnId: step % 2 ? 'salary' : 'name', direction: step % 3 ? 'asc' : 'desc' }]),
    },
    {
        name: 'filter',
        apply: (h, step) => h.api.setFilter('department', { operator: 'eq', value: departments[step % departments.length] }),
    },
    { name: 'page', apply: (h, step) => h.api.setPage(step) },
    { name: 'page size', apply: (h, step) => h.api.setPageSize(3 + step) },
    { name: 'refresh', apply: (h) => void h.api.refresh() },
    { name: 'data source', apply: (h) => h.api.setDataSource(h.source()) },
    {
        name: 'combined query',
        apply: (h, step) =>
            h.api.setQuery({ search: `combo-${step}`, sort: [{ columnId: 'salary', direction: 'desc' }], pagination: { pageIndex: step, pageSize: 3 } }),
    },
];

const shown = (api: GridApi<Person>): string[] => api.getState().rows.map((row) => row.data.name);

afterEach(() => {
    vi.useRealTimers();
});

describe('two changes while the first load is in flight', () => {
    // Three requests exist: the one the grid made on creation, and one per change.
    const orders = permutations(3);
    const pairs = changes.flatMap((first) => changes.map((second) => [first, second] as const));

    describe.each(pairs)('$0.name, then $1.name', (first, second) => {
        it.each(orders)('shows the newest answer when responses land in order %j', async (...order) => {
            const h = harness();
            first.apply(h, 1);
            second.apply(h, 2);
            expect(h.calls).toHaveLength(3);
            const latest = 2;

            for (const index of order) {
                h.answer(index);
                await flush();

                // Whatever has landed so far, a superseded answer is never what the reader is shown.
                const onScreen = shown(h.api);
                expect(onScreen.filter((name) => name !== `request-${latest}`)).toEqual([]);

                // And it never ends the loading the newer request is still doing.
                const newestLanded = order.slice(0, order.indexOf(index) + 1).includes(latest);
                expect(h.api.getState().status === 'ready').toBe(newestLanded);
            }

            expect(shown(h.api)).toEqual([`request-${latest}`]);
            expect(h.api.getState().totalRows).toBe(TOTAL);
            expect(h.api.getState().error).toBeNull();
            expect(h.api.getState().query).toEqual(h.calls[latest]!.query);
            h.api.destroy();
        });
    });
});

describe('a chain of changes, each superseding the last', () => {
    // Four requests: creation plus three changes of one kind.
    const orders = permutations(4);

    describe.each(changes)('three × $name', (change) => {
        it.each(orders)('settles on the last when responses land in order %j', async (...order) => {
            const h = harness();
            change.apply(h, 1);
            change.apply(h, 2);
            change.apply(h, 3);
            expect(h.calls).toHaveLength(4);

            for (const index of order) {
                h.answer(index);
                await flush();
            }

            expect(shown(h.api)).toEqual(['request-3']);
            expect(h.api.getState().status).toBe('ready');
            h.api.destroy();
        });
    });
});

describe('what the superseded requests are told', () => {
    describe.each(changes)('after $name', (change) => {
        it('aborts every request but the newest', () => {
            const h = harness();
            change.apply(h, 1);
            change.apply(h, 2);

            expect(h.calls.map((call) => call.signal.aborted)).toEqual([true, true, false]);
            h.api.destroy();
        });

        it('aborts the newest as well once the grid is destroyed', () => {
            const h = harness();
            change.apply(h, 1);
            h.api.destroy();

            expect(h.calls.every((call) => call.signal.aborted)).toBe(true);
        });

        it('stays quiet when a destroyed grid is answered', async () => {
            const h = harness();
            change.apply(h, 1);
            const events = vi.fn();
            h.api.on('fetch:success', events);
            h.api.on('fetch:error', events);
            const states = vi.fn();
            h.api.subscribe(states);
            h.api.destroy();

            h.answer(0);
            h.fail(1);
            await flush();

            expect(events).not.toHaveBeenCalled();
            expect(states).not.toHaveBeenCalled();
        });
    });
});

describe('failures landing in every order', () => {
    const orders = permutations(3);

    describe.each(changes)('two × $name', (change) => {
        it.each(orders)('ignores a stale failure when the newest succeeds, in order %j', async (...order) => {
            const h = harness();
            change.apply(h, 1);
            change.apply(h, 2);

            for (const index of order) {
                if (index === 2) h.answer(index);
                else h.fail(index);
                await flush();
            }

            expect(shown(h.api)).toEqual(['request-2']);
            expect(h.api.getState().status).toBe('ready');
            expect(h.api.getState().error).toBeNull();
            // The reader was told nothing about requests they had already replaced.
            expect(h.errors).toEqual([]);
            h.api.destroy();
        });

        it.each(orders)('shows the newest failure and not a stale success, in order %j', async (...order) => {
            const h = harness();
            change.apply(h, 1);
            change.apply(h, 2);

            for (const index of order) {
                if (index === 2) h.fail(index);
                else h.answer(index);
                await flush();
            }

            const state = h.api.getState();
            expect(state.status).toBe('error');
            expect(state.error).toMatchObject({ message: 'down 2', retryable: true, status: 503 });
            // The rows of a superseded request are not rescued onto the screen by the newest one failing.
            expect(shown(h.api).filter((name) => name !== 'request-2')).toEqual([]);
            expect(h.errors).toHaveLength(1);
            h.api.destroy();
        });

        it.each(orders)('reports one error when every request fails, in order %j', async (...order) => {
            const h = harness();
            change.apply(h, 1);
            change.apply(h, 2);

            for (const index of order) {
                h.fail(index, 500 + index);
                await flush();
            }

            expect(h.api.getState().status).toBe('error');
            expect(h.api.getState().error?.status).toBe(502);
            expect(h.errors.map((error) => error.status)).toEqual([502]);
            h.api.destroy();
        });
    });
});

describe('a failed load followed by a change', () => {
    describe.each(changes)('a failure, then $name', (change) => {
        it('clears the error as soon as the retry starts, and the new answer replaces it', async () => {
            const h = harness();
            h.fail(0);
            await flush();
            expect(h.api.getState().status).toBe('error');

            change.apply(h, 1);
            expect(h.api.getState().error).toBeNull();
            expect(h.api.getState().status).not.toBe('error');

            h.answer(1);
            await flush();
            expect(h.api.getState().status).toBe('ready');
            expect(shown(h.api)).toEqual(['request-1']);
            h.api.destroy();
        });
    });
});

describe('the previous page while the next one loads', () => {
    describe.each(changes)('$name', (change) => {
        it('keeps the rows on screen and says it is refreshing', async () => {
            const h = harness();
            h.answer(0);
            await flush();
            expect(shown(h.api)).toEqual(['request-0']);

            change.apply(h, 1);
            expect(h.api.getState().status).toBe('refreshing');
            expect(shown(h.api)).toEqual(['request-0']);

            h.answer(1);
            await flush();
            expect(shown(h.api)).toEqual(['request-1']);
            h.api.destroy();
        });

        it('keeps the rows when the refresh fails, and says so', async () => {
            const h = harness();
            h.answer(0);
            await flush();

            change.apply(h, 1);
            h.fail(1);
            await flush();

            expect(h.api.getState().status).toBe('error');
            expect(shown(h.api)).toEqual(['request-0']);
            h.api.destroy();
        });

        it('keeps nothing when told not to keep the previous page', async () => {
            const h = harness({ keepPreviousData: false });
            h.answer(0);
            await flush();

            change.apply(h, 1);
            expect(h.api.getState().status).toBe('loading');
            h.fail(1);
            await flush();

            expect(h.api.getState().status).toBe('error');
            expect(h.api.getState().rows).toEqual([]);
            h.api.destroy();
        });
    });
});

describe('a burst of changes inside the debounce window', () => {
    describe.each(changes.filter((change) => change.name !== 'refresh' && change.name !== 'data source'))('$name', (change) => {
        it('sends one request carrying the last of them', async () => {
            vi.useFakeTimers();
            const h = harness({ debounce: 100 });
            // The creation fetch is not debounced; the burst after it is.
            expect(h.calls).toHaveLength(1);

            for (let step = 1; step <= 5; step += 1) {
                change.apply(h, step);
                await vi.advanceTimersByTimeAsync(20);
            }
            expect(h.calls).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(100);
            expect(h.calls).toHaveLength(2);
            // The state the burst left behind is the state the one request asked for.
            expect(h.calls[1]!.query).toEqual(h.api.getState().query);
            h.api.destroy();
        });

        it('shows the debounced answer even if the creation request lands after it', async () => {
            vi.useFakeTimers();
            const h = harness({ debounce: 50 });

            change.apply(h, 1);
            await vi.advanceTimersByTimeAsync(60);
            expect(h.calls).toHaveLength(2);

            h.answer(1);
            await vi.advanceTimersByTimeAsync(0);
            h.answer(0);
            await vi.advanceTimersByTimeAsync(0);

            expect(shown(h.api)).toEqual(['request-1']);
            h.api.destroy();
        });

        it('sends nothing at all if the grid is destroyed inside the window', async () => {
            vi.useFakeTimers();
            const h = harness({ debounce: 100 });

            change.apply(h, 1);
            h.api.destroy();
            await vi.advanceTimersByTimeAsync(500);

            expect(h.calls).toHaveLength(1);
        });
    });
});

describe('replacing the data source inside a debounce window', () => {
    it('fetches from the new source at once and lets the waiting timer lapse without a second fetch', async () => {
        vi.useFakeTimers();
        const h = harness({ debounce: 100 });
        h.api.setSearch('typed');
        await vi.advanceTimersByTimeAsync(30);
        expect(h.calls).toHaveLength(1);

        h.api.setDataSource(h.source());
        expect(h.calls).toHaveLength(2);
        // The replacement reads the query as it stands, the typed term included.
        expect(h.calls[1]!.query.search).toBe('typed');

        await vi.advanceTimersByTimeAsync(500);
        expect(h.calls).toHaveLength(2);
        h.api.destroy();
    });
});

describe('a source that tells the grid its data changed', () => {
    function invalidating() {
        const listeners = new Set<() => void>();
        const calls: Gate[] = [];
        const source: DataSource<Person> = {
            kind: 'invalidating',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: () => {
                const gate = deferred<DataSourceResult<Person>>();
                calls.push(gate);
                return gate.promise;
            },
            subscribe: (listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        };
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source, initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } } });
        const answer = (index: number): void => calls[index]!.resolve({ rows: [marker(index)], totalRows: TOTAL });
        return { api, calls, answer, invalidate: () => listeners.forEach((listener) => listener()), listeners };
    }

    describe.each(changes.filter((change) => change.name !== 'data source'))('invalidated around a $name', (change) => {
        it.each(permutations(3))('shows the newest request when responses land in order %j', async (...order) => {
            const s = invalidating();
            const h: Harness = { api: s.api, calls: [], errors: [], source: () => { throw new Error('unused'); }, answer: () => undefined, fail: () => undefined };

            change.apply(h, 1);
            s.invalidate();
            expect(s.calls).toHaveLength(3);

            for (const index of order) {
                s.answer(index);
                await flush();
            }

            expect(shown(s.api)).toEqual(['request-2']);
            s.api.destroy();
        });
    });

    it('stops listening to a source it replaced, so the old one cannot trigger fetches', async () => {
        const first = invalidating();
        const second = invalidating();
        first.api.setDataSource({
            kind: 'other',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: () => ({ rows: [marker(9)], totalRows: 1 }),
        });
        first.invalidate();
        await flush();
        const fetchesAfterReplace = first.calls.length;
        first.invalidate();
        await flush();

        expect(first.calls.length).toBe(fetchesAfterReplace);
        expect(first.listeners.size).toBe(0);
        expect(second.listeners.size).toBe(1);
        first.api.destroy();
        second.api.destroy();
    });

    it('detaches from the source on destroy', () => {
        const s = invalidating();
        expect(s.listeners.size).toBe(1);
        s.api.destroy();
        expect(s.listeners.size).toBe(0);
    });
});
