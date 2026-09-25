import { compareValues, createRemoteDataSource, matchesFilter, toText } from 'apsw-gridwright';
import type { DataSourceRequest, DataSourceResult, RemoteDataSource, ResolvedColumn } from 'apsw-gridwright';

/**
 * A server in the browser, so the showcase needs no backend: it sorts, filters, searches and pages
 * a table and answers after a delay, the way an endpoint would.
 *
 * It uses the engine's own value helpers (`compareValues`, `matchesFilter`, `toText`), which is
 * also how a Node endpoint could share the grid's semantics. The switches in the page reach it
 * through `settings`, read on every request, so the data source itself never has to change.
 */
export interface ServerSettings {
    latency: number;
    sendsTotal: boolean;
    failNext: boolean;
}

const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason);
        });
    });

function answer<TRow>(table: readonly TRow[], request: DataSourceRequest<TRow>, paginate: boolean): { rows: TRow[]; total: number } {
    const { query, columns } = request;
    const byId = new Map<string, ResolvedColumn<TRow>>(columns.map((column) => [column.id, column]));

    let rows = table.filter((row) =>
        query.filters.every((filter) => {
            const column = byId.get(filter.columnId);
            return column === undefined || matchesFilter(column.getValue(row), filter);
        }),
    );

    const needle = query.search.trim().toLowerCase();
    if (needle) {
        rows = rows.filter((row) => columns.some((column) => column.searchable && toText(column.getValue(row)).toLowerCase().includes(needle)));
    }

    if (query.sort.length > 0) {
        rows = [...rows].sort((a, b) => {
            for (const spec of query.sort) {
                const column = byId.get(spec.columnId);
                if (!column) continue;
                const result = compareValues(column.getValue(a), column.getValue(b));
                if (result !== 0) return spec.direction === 'asc' ? result : -result;
            }
            return 0;
        });
    }

    const total = rows.length;
    if (paginate) {
        const { pageIndex, pageSize } = query.pagination;
        rows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    }
    return { rows, total };
}

export function createFakeServer<TRow>(table: () => readonly TRow[], settings: () => ServerSettings): RemoteDataSource<TRow> {
    const source = createRemoteDataSource<TRow>({
        // The server resolves all four, so the grid's pipeline stands aside and only renders.
        capabilities: { sort: true, filter: true, search: true, paginate: true },
        retry: { attempts: 0 },
        fetcher: async (request): Promise<DataSourceResult<TRow>> => {
            const { latency, sendsTotal, failNext } = settings();
            await wait(latency, request.signal);
            if (failNext) {
                settings().failNext = false;
                throw new Error('The server did not answer (simulated).');
            }
            const { rows, total } = answer(table(), request, true);
            // Without a total the grid is told only whether another page exists, and says "of many".
            return sendsTotal ? { rows, totalRows: total } : { rows };
        },
    });

    return {
        ...source,
        // Every matching row, for "All matching rows" in the export menu. Without it the menu
        // refuses rather than saving one page under a name that claims to be all of them.
        fetchAll: async (request) => {
            await wait(settings().latency, request.signal);
            return { rows: answer(table(), request, false).rows };
        },
    };
}
