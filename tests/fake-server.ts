import { GridwrightError } from '../src/core/errors';
import { createRemoteDataSource } from '../src/data/remote';
import type { DataSource, DataSourceRequest, DataSourceResult } from '../src/core/types';
import type { Person } from './fixtures';
import { deferred } from './fixtures';

type Held = ReturnType<typeof deferred<void>>;

/**
 * A server the test can change the data of, hold a response of, and make fail.
 *
 * It does what a real endpoint does with the query it is sent (filter, search, sort, cut the page) and
 * reports the total, so a grid on top of it behaves as it does against a backend: every change of the
 * query is a request, and the rows that come back are the server's, in the server's order.
 */
export interface FakeServer {
    /** What the server holds now. Assign to change the data a later request sees. */
    rows: Person[];
    readonly dataSource: DataSource<Person>;
    /** Every request received, oldest first. */
    readonly requests: readonly DataSourceRequest<Person>[];
    /** Holds the answers to requests until `release()`. Requests made while held queue up. */
    hold(): void;
    release(): void;
    /** The next request to be answered fails. */
    failNext(status?: number): void;
}

const read = (row: Person, columnId: string): string | number | boolean =>
    (row as unknown as Record<string, string | number | boolean>)[columnId]!;

export function fakeServer(initial: readonly Person[]): FakeServer {
    const requests: DataSourceRequest<Person>[] = [];
    let held: Held | null = null;
    let failure: number | null = null;

    const server: FakeServer = {
        rows: [...initial],
        requests,
        hold: () => {
            held = deferred<void>();
        },
        release: () => {
            held?.resolve();
            held = null;
        },
        failNext: (status = 503) => {
            failure = status;
        },
        dataSource: createRemoteDataSource<Person>({
            retry: { attempts: 0 },
            fetcher: async (request): Promise<DataSourceResult<Person>> => {
                requests.push(request);
                // Snapshot first: the answer is the data as it stood when the request arrived, which is
                // what makes a slow response stale rather than merely late.
                const snapshot = [...server.rows];
                if (held) await held.promise;
                if (failure !== null) {
                    const status = failure;
                    failure = null;
                    throw new GridwrightError('The server is down.', { status });
                }

                const { filters, search, sort, pagination } = request.query;
                let result = snapshot;
                for (const filter of filters) result = result.filter((row) => read(row, filter.columnId) === filter.value);
                // Every column, as the grid's own search does: a term is looked for in what the reader sees.
                if (search) result = result.filter((row) => [row.name, row.department, String(row.salary)].some((text) => text.toLowerCase().includes(search.toLowerCase())));
                for (const spec of [...sort].reverse()) {
                    const sign = spec.direction === 'asc' ? 1 : -1;
                    result = [...result].sort((a, b) => {
                        const left = read(a, spec.columnId);
                        const right = read(b, spec.columnId);
                        return left < right ? -sign : left > right ? sign : 0;
                    });
                }
                const start = pagination.pageIndex * pagination.pageSize;
                return { rows: result.slice(start, start + pagination.pageSize), totalRows: result.length };
            },
        }),
    };
    return server;
}
