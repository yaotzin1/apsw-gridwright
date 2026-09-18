import type { GridQuery, Unsubscribe } from '../../core/types';

/** One part of the query the URL can carry: `q`, `sort`, `f`, `page` and `size` respectively. */
export type UrlSyncFacet = 'search' | 'sort' | 'filters' | 'page' | 'size';

/** `push` adds a history entry, so Back returns to the view before it; `replace` does not. */
export type UrlSyncHistoryMode = 'push' | 'replace';

/** What `serializeGridQuery` and `parseGridQuery` share. */
export interface GridQueryParamsOptions {
    /** Put before every parameter name, so two grids on one page do not collide: `gw_page=2`. Default ''. */
    readonly prefix?: string;
    /** Which parts of the query are read and written. Default all five. */
    readonly facets?: readonly UrlSyncFacet[];
    /**
     * The grid's own starting query. A facet equal to it is left out of the URL, and a facet missing
     * from the URL means this value. Default `createQuery()`.
     */
    readonly baseline?: GridQuery;
}

export interface ParseGridQueryOptions extends GridQueryParamsOptions {
    /**
     * The largest `size` a URL may ask for. Default the larger of 100 and the baseline's page size.
     *
     * A link is written by whoever sent it, and `size=1000000` would otherwise make the grid render a
     * million rows or ask the server for them.
     */
    readonly maxPageSize?: number;
}

/**
 * Where the parameters live. The default is the browser's `location` and `history`; pass your own to
 * go through a router, which then stays the one thing that changes the URL.
 *
 *     const [params, setParams] = useSearchParams();           // React Router
 *     const adapter: UrlSyncAdapter = {
 *         getParams: () => params,
 *         setParams: (next, mode) => setParams(next, { replace: mode === 'replace' }),
 *     };
 */
export interface UrlSyncAdapter {
    /**
     * The current parameters, all of them. Read on every render of the grid, so a router that
     * re-renders with new parameters needs no `subscribe`. Keep it cheap, and do not mutate what it
     * returns: the add-on copies before it changes anything.
     */
    getParams(): URLSearchParams;
    /** Writes the complete parameters: the grid's own and every other one, unchanged. */
    setParams(params: URLSearchParams, mode: UrlSyncHistoryMode): void;
    /**
     * Calls back when the parameters change from outside the grid: Back, Forward, a link. Needed only
     * where that change does not re-render the grid; the default adapter listens to `popstate`.
     */
    subscribe?(onChange: () => void): Unsubscribe;
}

export interface UrlSyncOptions {
    /** Default: the browser's `location`, `history` and `popstate`. Reads nothing on the server. */
    readonly adapter?: UrlSyncAdapter;
    /** Put before every parameter name. Default ''. */
    readonly prefix?: string;
    /** Which parts of the query go in the URL. Default all five. */
    readonly facets?: readonly UrlSyncFacet[];
    /**
     * Facets whose change adds a history entry; every other change replaces the current one.
     * Default `['page']`, so Back steps through pages and not through keystrokes.
     */
    readonly push?: readonly UrlSyncFacet[];
    /** Milliseconds of quiet before a replace is written. A push is written at once. Default 300. */
    readonly debounceMs?: number;
    /** See `ParseGridQueryOptions.maxPageSize`. */
    readonly maxPageSize?: number;
}
