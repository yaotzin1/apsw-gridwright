import { GridwrightError } from '../core/errors';
import type { ColumnValue, DataSourceCapabilities, DataSourceResult, GridQuery, ResolvedColumn } from '../core/types';
import type { RemoteDataSource, RetryPolicy } from './remote';
import { createRemoteDataSource } from './remote';

export type RestParams = Record<string, string>;

export interface RestDataSourceOptions<TRow> {
    readonly url: string;
    /** GET puts the query in the URL; POST puts it in a JSON body. Default GET. */
    readonly method?: 'GET' | 'POST';
    readonly headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
    readonly credentials?: RequestCredentials;
    /** Injected in tests, and useful for wrapping fetch with auth refresh in an app. */
    readonly fetchImpl?: typeof fetch;
    readonly capabilities?: Partial<DataSourceCapabilities>;
    /** Replace the whole parameter vocabulary when the server speaks a different one. */
    readonly buildParams?: (query: GridQuery, columns: readonly ResolvedColumn<TRow, ColumnValue>[]) => RestParams;
    readonly parseResponse?: (payload: unknown, response: Response) => DataSourceResult<TRow>;
    readonly retry?: RetryPolicy;
    readonly kind?: string;
}

/**
 * The default wire format.
 *
 * Written down rather than inferred, because a grid and a server that disagree about whether
 * `page` is zero-based produce an off-by-one nobody notices until page two is missing a row.
 *
 * - `page` is **one-based**
 * - `pageSize` is the row count
 * - `sort` is `column:asc,other:desc`, in tie-break order
 * - `search` is the raw term, omitted when empty
 * - `filters` is a JSON array of `{ columnId, operator, value }`, omitted when empty
 */
export function defaultBuildParams(query: GridQuery): RestParams {
    const params: RestParams = {
        page: String(query.pagination.pageIndex + 1),
        pageSize: String(query.pagination.pageSize),
    };

    if (query.sort.length > 0) {
        params.sort = query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(',');
    }
    if (query.search.trim() !== '') {
        params.search = query.search;
    }
    if (query.filters.length > 0) {
        params.filters = JSON.stringify(query.filters);
    }

    return params;
}

const TOTAL_KEYS = ['totalRows', 'total', 'totalCount', 'total_count', 'count', 'recordsTotal'] as const;
const ROWS_KEYS = ['data', 'rows', 'items', 'results', 'records', 'content'] as const;

/**
 * Reads rows and a total out of the envelope shapes REST APIs actually return.
 *
 * A bare array, `{ data, total }`, `{ items, count }`, a nested `meta.total`, or a total that only
 * exists in the `X-Total-Count` header: all of them appear in real services, and none of them is
 * worth a bespoke parser in every project. Pass `parseResponse` for anything stranger.
 */
export function defaultParseResponse<TRow>(payload: unknown, response: Response): DataSourceResult<TRow> {
    const headerTotal = readNumber(response.headers?.get?.('X-Total-Count'));

    if (Array.isArray(payload)) {
        return headerTotal === undefined
            ? { rows: payload as TRow[] }
            : { rows: payload as TRow[], totalRows: headerTotal };
    }

    if (payload && typeof payload === 'object') {
        const envelope = payload as Record<string, unknown>;

        const rowsKey = ROWS_KEYS.find((key) => Array.isArray(envelope[key]));
        const rows = (rowsKey ? envelope[rowsKey] : []) as TRow[];

        const meta = (envelope.meta ?? envelope.pagination ?? {}) as Record<string, unknown>;
        const total =
            firstNumber(envelope, TOTAL_KEYS) ?? firstNumber(meta, TOTAL_KEYS) ?? headerTotal;

        return total === undefined ? { rows } : { rows, totalRows: total };
    }

    throw new GridwrightError('The server answered with a payload the grid could not read.', {
        retryable: false,
    });
}

/**
 * A REST endpoint as a data source, with the parameter encoding and envelope handling supplied.
 *
 * Defaults to declaring all four capabilities, so the pipeline does nothing in memory and the
 * server owns the query. Narrow `capabilities` for an endpoint that only pages, and the pipeline
 * takes over sorting and filtering for the page it received.
 */
export function createRestDataSource<TRow>(
    options: RestDataSourceOptions<TRow>,
): RemoteDataSource<TRow> {
    const method = options.method ?? 'GET';
    const buildParams = options.buildParams ?? defaultBuildParams;
    const parseResponse = options.parseResponse ?? defaultParseResponse<TRow>;

    return createRemoteDataSource<TRow>({
        kind: options.kind ?? 'rest',
        ...(options.capabilities ? { capabilities: options.capabilities } : {}),
        ...(options.retry ? { retry: options.retry } : {}),
        async fetcher(request) {
            const doFetch = options.fetchImpl ?? globalThis.fetch;
            if (typeof doFetch !== 'function') {
                throw new GridwrightError(
                    'No fetch implementation is available. Pass fetchImpl to createRestDataSource.',
                    { retryable: false },
                );
            }

            const params = buildParams(request.query, request.columns);
            const headers: Record<string, string> = {
                Accept: 'application/json',
                ...(typeof options.headers === 'function' ? await options.headers() : options.headers ?? {}),
            };

            const url = new URL(options.url, baseUrl());
            let body: string | undefined;

            if (method === 'GET') {
                for (const [key, value] of Object.entries(params)) {
                    url.searchParams.set(key, value);
                }
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(request.query);
            }

            const response = await doFetch(url.toString(), {
                method,
                headers,
                signal: request.signal,
                ...(options.credentials ? { credentials: options.credentials } : {}),
                ...(body !== undefined ? { body } : {}),
            });

            if (!response.ok) {
                throw new GridwrightError(await readErrorMessage(response), {
                    status: response.status,
                });
            }

            return parseResponse(await readJson(response), response);
        },
    });
}

/** `new URL` needs an absolute base for a relative path; in Node there is no ambient location. */
function baseUrl(): string | undefined {
    const location = (globalThis as { location?: { href?: string } }).location;
    return location?.href;
}

async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.trim() === '') return [];
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new GridwrightError('The server answered with something other than JSON.', {
            retryable: false,
            status: response.status,
            cause: error,
        });
    }
}

/**
 * Surfaces the server's own sentence when it wrote one.
 *
 * "Request failed with status 403" tells the reader nothing they can act on, while "Your session
 * expired" tells them exactly what to do. Most APIs send the second and most clients discard it.
 */
async function readErrorMessage(response: Response): Promise<string> {
    try {
        const text = await response.text();
        if (text.trim() === '') return `The server answered ${response.status}.`;

        const payload: unknown = JSON.parse(text);
        if (payload && typeof payload === 'object') {
            const envelope = payload as Record<string, unknown>;
            for (const key of ['message', 'error', 'detail', 'title'] as const) {
                const value = envelope[key];
                if (typeof value === 'string' && value.trim() !== '') return value;
            }
        }
        return `The server answered ${response.status}.`;
    } catch {
        return `The server answered ${response.status}.`;
    }
}

function readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function firstNumber(source: Record<string, unknown>, keys: readonly string[]): number | undefined {
    for (const key of keys) {
        const parsed = readNumber(source[key]);
        if (parsed !== undefined) return parsed;
    }
    return undefined;
}
