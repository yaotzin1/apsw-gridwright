/**
 * The data source behind the employees grid: a paginating REST endpoint, `/api/people`.
 *
 * The one idea to take away is `capabilities`. The source says which parts of the query the server
 * applied, and the grid applies whatever is left in the browser. The page's "the server resolves"
 * switches change both at once, so the server really does stop sorting when you untick sort.
 *
 * To point this at your own API, replace the URL and the parameter names in `fetcher` and
 * `fetchAll`. Nothing else on the page changes.
 */
import { core } from '../shared/package.js';

const { createRemoteDataSource } = core;

/**
 * What the server would be storing. An edit is written here and applied to every row the endpoint
 * answers with, so an edit over a remote source survives the next fetch instead of being undone.
 */
export const edits = new Map();

/**
 * Sort, filters and search, as `/api/people` reads them. Shared by the page request and the
 * export of every row, so a file holds exactly the rows the grid says match.
 */
function setQueryParams(params, query) {
    if (query.sort.length > 0) {
        params.set('sort', query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(','));
    }
    if (query.filters.length > 0) params.set('filters', JSON.stringify(query.filters));
    if (query.search.trim() !== '') params.set('search', query.search);
}

/**
 * @param {object} options
 * @param {number} options.latency      artificial delay, in milliseconds
 * @param {{ sort: boolean, filter: boolean, search: boolean, paginate: boolean }} options.serverDoes
 * @param {boolean} options.withTotal   false to make the server omit the row count
 * @param {number} options.attempt      bumped by "fail the next request", to force a new source
 * @param {boolean} options.fullExport  whether the source can hand over every matching row
 */
export function createEmployeeSource({ latency, serverDoes, withTotal, attempt, fullExport }) {
    const applied = Object.keys(serverDoes).filter((facet) => serverDoes[facet]);

    const source = createRemoteDataSource({
        retry: { attempts: 0 },
        // A new kind per failure armed, so the grid sees a different source and asks again.
        kind: `employees-${attempt}`,
        capabilities: {
            sort: serverDoes.sort,
            filter: serverDoes.filter,
            search: serverDoes.search,
            paginate: serverDoes.paginate,
        },
        fetcher: async ({ query, signal }) => {
            const params = new URLSearchParams({
                page: String(query.pagination.pageIndex + 1),
                pageSize: String(query.pagination.pageSize),
                latency: String(latency),
                serverDoes: applied.join(','),
            });
            if (!withTotal) params.set('withTotal', 'false');
            setQueryParams(params, query);

            const response = await fetch(`/api/people?${params}`, { signal });
            const body = await response.json();
            if (!response.ok) throw Object.assign(new Error(body.message), { status: response.status });

            const rows = body.data.map((row) => (edits.has(row.id) ? { ...row, ...edits.get(row.id) } : row));

            // No total from the server means no total here. A count worked out from one page is a
            // number somebody would act on, and it would be wrong.
            return body.total === undefined ? { rows } : { rows, totalRows: body.total };
        },
    });

    if (!fullExport) return source;

    return {
        ...source,
        /**
         * Every matching row, for "All matching rows" in the export menu. Without this, a source
         * that pages can only export the page or the selection, and the menu says so.
         */
        fetchAll: async ({ query, signal }) => {
            const params = new URLSearchParams({
                latency: String(latency),
                // The same request with paging left out, so the server answers with everything.
                serverDoes: applied.filter((facet) => facet !== 'paginate').join(','),
            });
            setQueryParams(params, query);

            const response = await fetch(`/api/people?${params}`, { signal });
            const body = await response.json();
            return { rows: body.data.map((row) => (edits.has(row.id) ? { ...row, ...edits.get(row.id) } : row)) };
        },
    };
}
