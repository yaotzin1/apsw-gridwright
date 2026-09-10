import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../src/core/columns';
import { createQuery } from '../../src/core/query';
import { createRestDataSource, defaultBuildParams, defaultParseResponse } from '../../src/data/rest';
import type { DataSourceRequest } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

const columns = resolveColumns<Person>([{ id: 'name' }, { id: 'salary' }]);

const request = (overrides: Partial<DataSourceRequest<Person>> = {}): DataSourceRequest<Person> => ({
    query: createQuery(),
    columns,
    signal: new AbortController().signal,
    meta: {},
    ...overrides,
});

/** Matches the real fetch signature, so `mock.calls[n]` carries a url and an init object. */
const mockFetch = (impl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) =>
    vi.fn(impl);

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });

describe('defaultBuildParams', () => {
    it('sends a one-based page, matching the convention most APIs use', () => {
        const params = defaultBuildParams(createQuery({ pagination: { pageIndex: 2, pageSize: 20 } }));
        expect(params).toMatchObject({ page: '3', pageSize: '20' });
    });

    it('encodes multi-column sort in tie-break order', () => {
        const params = defaultBuildParams(
            createQuery({
                sort: [
                    { columnId: 'department', direction: 'asc' },
                    { columnId: 'salary', direction: 'desc' },
                ],
            }),
        );
        expect(params.sort).toBe('department:asc,salary:desc');
    });

    it('omits search and filters when they are empty', () => {
        const params = defaultBuildParams(createQuery());
        expect(params.search).toBeUndefined();
        expect(params.filters).toBeUndefined();
    });

    it('serialises filters as JSON so operators survive the wire', () => {
        const params = defaultBuildParams(
            createQuery({ filters: [{ columnId: 'salary', operator: 'gte', value: 100_000 }] }),
        );
        expect(JSON.parse(params.filters!)).toEqual([
            { columnId: 'salary', operator: 'gte', value: 100_000 },
        ]);
    });
});

describe('defaultParseResponse', () => {
    it('reads a bare array', () => {
        const result = defaultParseResponse<Person>(people, jsonResponse([]));
        expect(result.rows).toHaveLength(7);
        expect(result.totalRows).toBeUndefined();
    });

    it('reads the data and total envelope', () => {
        const result = defaultParseResponse<Person>({ data: people, total: 42 }, jsonResponse([]));
        expect(result.rows).toHaveLength(7);
        expect(result.totalRows).toBe(42);
    });

    it('reads items and count', () => {
        const result = defaultParseResponse<Person>({ items: people, count: 9 }, jsonResponse([]));
        expect(result.totalRows).toBe(9);
    });

    it('reads a total nested under meta', () => {
        const result = defaultParseResponse<Person>({ data: people, meta: { total: 13 } }, jsonResponse([]));
        expect(result.totalRows).toBe(13);
    });

    it('falls back to the X-Total-Count header', () => {
        const response = jsonResponse([], { headers: { 'X-Total-Count': '55' } });
        const result = defaultParseResponse<Person>(people, response);
        expect(result.totalRows).toBe(55);
    });

    it('refuses a payload that is neither an array nor an object', () => {
        expect(() => defaultParseResponse<Person>('nope', jsonResponse([]))).toThrow(/could not read/i);
    });
});

describe('createRestDataSource', () => {
    it('declares all four capabilities by default', () => {
        const source = createRestDataSource<Person>({ url: 'https://api.test/people' });
        expect(source.capabilities).toEqual({ sort: true, filter: true, search: true, paginate: true });
    });

    it('puts the query in the URL for a GET', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({ data: people, total: 7 }));
        const source = createRestDataSource<Person>({ url: 'https://api.test/people', fetchImpl });

        await source.fetch(request({ query: createQuery({ search: 'ada' }) }));

        const url = new URL(String(fetchImpl.mock.calls[0]![0]));
        expect(url.pathname).toBe('/people');
        expect(url.searchParams.get('search')).toBe('ada');
        expect(url.searchParams.get('page')).toBe('1');
    });

    it('puts the query in the body for a POST', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({ data: [], total: 0 }));
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people/search',
            method: 'POST',
            fetchImpl,
        });

        await source.fetch(request({ query: createQuery({ search: 'grace' }) }));

        const init = fetchImpl.mock.calls[0]![1]!;
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string).search).toBe('grace');
    });

    it('resolves headers lazily, so a token is read at request time', async () => {
        let token = 'first';
        const fetchImpl = mockFetch(async () => jsonResponse({ data: [], total: 0 }));
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people',
            headers: () => ({ Authorization: `Bearer ${token}` }),
            fetchImpl,
        });

        await source.fetch(request());
        token = 'refreshed';
        await source.fetch(request());

        const second = fetchImpl.mock.calls[1]![1]!;
        expect((second.headers as Record<string, string>).Authorization).toBe('Bearer refreshed');
    });

    it('surfaces the message the server wrote rather than the status code alone', async () => {
        // "Request failed with status 403" gives the reader nothing to act on. Most APIs send a
        // usable sentence and most clients throw it away.
        const fetchImpl = mockFetch(async () =>
            jsonResponse({ message: 'Your session expired.' }, { status: 403 }),
        );
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people',
            fetchImpl,
            retry: { attempts: 0 },
        });

        await expect(source.fetch(request())).rejects.toThrow('Your session expired.');
    });

    it('falls back to naming the status when the body has no message', async () => {
        const fetchImpl = mockFetch(async () => new Response('', { status: 500 }));
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people',
            fetchImpl,
            retry: { attempts: 0 },
        });

        await expect(source.fetch(request())).rejects.toThrow(/500/);
    });

    it('reports non-JSON as such instead of a parser stack trace', async () => {
        const fetchImpl = mockFetch(async () => new Response('<html>oops</html>', { status: 200 }));
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people',
            fetchImpl,
            retry: { attempts: 0 },
        });

        await expect(source.fetch(request())).rejects.toThrow(/other than JSON/i);
    });

    it('honours a custom parameter vocabulary', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse([]));
        const source = createRestDataSource<Person>({
            url: 'https://api.test/people',
            fetchImpl,
            buildParams: (query) => ({
                offset: String(query.pagination.pageIndex * query.pagination.pageSize),
                limit: String(query.pagination.pageSize),
            }),
        });

        await source.fetch(request({ query: createQuery({ pagination: { pageIndex: 2, pageSize: 10 } }) }));

        const url = new URL(String(fetchImpl.mock.calls[0]![0]));
        expect(url.searchParams.get('offset')).toBe('20');
        expect(url.searchParams.get('limit')).toBe('10');
        expect(url.searchParams.get('page')).toBeNull();
    });

    it('passes the abort signal through to fetch', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse([]));
        const source = createRestDataSource<Person>({ url: 'https://api.test/people', fetchImpl });
        const controller = new AbortController();

        await source.fetch(request({ signal: controller.signal }));

        const init = fetchImpl.mock.calls[0]![1]!;
        expect(init.signal).toBe(controller.signal);
    });
});
