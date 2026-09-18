import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createQuery } from '../../core/query';
import type { GridQuery } from '../../core/types';
import type { AddonContribution, GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import type { UseGridwrightOptions } from '../types';
import { browserUrlAdapter } from './adapter';
import { defaultMaxPageSize, parameterNames, parseGridQuery, serializeGridQuery, URL_SYNC_FACETS } from './codec';
import type { UrlSyncAdapter, UrlSyncFacet, UrlSyncHistoryMode, UrlSyncOptions } from './types';

export const URL_SYNC_ADDON = 'gridwright:url-sync';

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Keeps the grid's search, sort, filters and page in the URL, so a view survives a reload, can be
 * sent as a link, and Back and Forward step through the pages the reader visited.
 *
 *     <Gridwright columns={columns} dataSource={people} addons={[search(), columnFilters(), urlSync()]} />
 *     // /people?q=north&sort=score:desc&f=status:in:open:pending&page=3
 *
 * The linked query is the grid's initial query, so opening a link fetches once, not the default view
 * first. Parameters are validated against the columns; anything the grid cannot use is dropped.
 * Renders nothing and ships no strings.
 */
export function urlSync<TRow>(options: UrlSyncOptions = {}): GridAddon<TRow> {
    return {
        name: URL_SYNC_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useUrlSyncSetup({ options: grid }) {
            return useUrlSync(options, grid);
        },
    };
}

interface Settings {
    readonly adapter: UrlSyncAdapter;
    readonly prefix: string;
    readonly facets: readonly UrlSyncFacet[];
    readonly push: readonly UrlSyncFacet[];
    readonly debounceMs: number;
    readonly maxPageSize: number;
    readonly baseline: GridQuery;
}

interface Start {
    readonly baseline: GridQuery;
    readonly parsed: Partial<GridQuery>;
    /** The grid's own parameters as the URL held them at mount. */
    readonly seen: string;
}

/**
 * The query the grid starts from without a URL, worked out the way `useGridwright` builds its engine:
 * `pageSize` overrides `initialQuery`.
 */
function startingQueryOf<TRow>(grid: UseGridwrightOptions<TRow>): GridQuery {
    const query = createQuery(grid.initialQuery);
    return grid.pageSize ? { ...query, pagination: { ...query.pagination, pageSize: grid.pageSize } } : query;
}

/** The grid's own parameters as one comparable string. Anyone else's parameters are not part of it. */
function ownParameters(params: URLSearchParams, prefix: string): string {
    return parameterNames(prefix)
        .map((name) => (params.has(name) ? `${name}=${params.getAll(name).join('\u0000')}` : ''))
        .join('&');
}

function useUrlSync<TRow>(options: UrlSyncOptions, grid: UseGridwrightOptions<TRow>): AddonContribution<TRow> {
    const adapter = options.adapter ?? browserUrlAdapter;
    const prefix = options.prefix ?? '';
    const facets = options.facets ?? URL_SYNC_FACETS;

    // Read once: the engine is created from this, and a later render must not hand it a different
    // initial query than the one it was created with.
    const [start] = useState<Start>(() => {
        const baseline = startingQueryOf(grid);
        const params = adapter.getParams();
        const parsed = parseGridQuery(params, grid.columns, {
            prefix,
            facets,
            baseline,
            maxPageSize: options.maxPageSize ?? defaultMaxPageSize(baseline),
        });
        return { baseline, parsed, seen: ownParameters(params, prefix) };
    });

    const settings: Settings = {
        adapter,
        prefix,
        facets,
        push: options.push ?? ['page'],
        debounceMs: Math.max(0, options.debounceMs ?? DEFAULT_DEBOUNCE_MS),
        maxPageSize: options.maxPageSize ?? defaultMaxPageSize(start.baseline),
        baseline: start.baseline,
    };
    // Read on every render: a router delivers new parameters by rendering, not by an event.
    const current = ownParameters(adapter.getParams(), prefix);

    return {
        configure: (configured) => {
            const { parsed } = start;
            if (Object.keys(parsed).length === 0) return configured;
            return {
                ...configured,
                initialQuery: { ...configured.initialQuery, ...parsed },
                // `pageSize` wins over `initialQuery` when the engine is built, so a linked size has to
                // be said there too.
                ...(parsed.pagination ? { pageSize: parsed.pagination.pageSize } : {}),
            };
        },
        provide: (children) => (
            <UrlSyncLifecycle settings={settings} seen={start.seen} current={current}>
                {children}
            </UrlSyncLifecycle>
        ),
    };
}

interface UrlSyncLifecycleProps {
    readonly settings: Settings;
    readonly seen: string;
    readonly current: string;
    readonly children: ReactNode;
}

/** Which facets differ between two queries. */
function changedFacets(previous: GridQuery, next: GridQuery): UrlSyncFacet[] {
    const changed: UrlSyncFacet[] = [];
    const written = (query: GridQuery, facet: UrlSyncFacet) =>
        serializeGridQuery(query, { facets: [facet], baseline: createQuery() }).toString();
    if (previous.search !== next.search) changed.push('search');
    if (written(previous, 'sort') !== written(next, 'sort')) changed.push('sort');
    if (written(previous, 'filters') !== written(next, 'filters')) changed.push('filters');
    if (previous.pagination.pageIndex !== next.pagination.pageIndex) changed.push('page');
    if (previous.pagination.pageSize !== next.pagination.pageSize) changed.push('size');
    return changed;
}

/** The facets this grid syncs right now. */
function activeFacets({ settings, windowed }: { readonly settings: Settings; readonly windowed: boolean }): readonly UrlSyncFacet[] {
    return windowed ? settings.facets.filter((facet) => facet !== 'page') : settings.facets;
}

/**
 * The part that lives as long as the grid: writes query changes to the URL and applies URL changes to
 * the grid. Renders its children and nothing else.
 */
function UrlSyncLifecycle({ settings, seen: initiallySeen, current, children }: UrlSyncLifecycleProps) {
    const { api, contributions } = useGridwrightContext();
    // A windowed body moves the page as the reader scrolls. That is a scroll position, not a place to
    // go back to, and pushing it would fill history with every screenful.
    const windowed = contributions.navigation === 'window';

    const latest = useRef({ settings, windowed });
    latest.current = { settings, windowed };

    /** The grid's own parameters as last written or read. A URL equal to it is already applied. */
    const seen = useRef(initiallySeen);
    /** True while a URL change is being applied, so the change it causes is not written back. */
    const applying = useRef(false);
    const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancel = useCallback(() => {
        if (pending.current !== null) clearTimeout(pending.current);
        pending.current = null;
    }, []);

    const write = useCallback(
        (mode: UrlSyncHistoryMode) => {
            cancel();
            if (api.destroyed) return;
            const { settings: now } = latest.current;
            // A copy: the adapter's own object may be a router's, and is not ours to change.
            const params = new URLSearchParams(now.adapter.getParams());
            for (const name of parameterNames(now.prefix)) params.delete(name);
            serializeGridQuery(api.getState().query, { prefix: now.prefix, facets: activeFacets(latest.current), baseline: now.baseline }).forEach(
                (value, name) => params.append(name, value),
            );
            const own = ownParameters(params, now.prefix);
            if (own === seen.current) return;
            seen.current = own;
            now.adapter.setParams(params, mode);
        },
        [api, cancel],
    );

    useEffect(() => {
        const off = api.on('query:change', ({ query, previous }) => {
            if (applying.current) return;
            const { settings: now } = latest.current;
            const facets = activeFacets(latest.current);
            const changed = changedFacets(previous, query);
            if (!changed.some((facet) => facets.includes(facet))) return;

            // A filter, sort, search or size change moves the page back to the first as well; it
            // is the filter the reader changed, not the page.
            const meaningful = changed.length > 1 ? changed.filter((facet) => facet !== 'page') : changed;
            // The engine clamps a page past the end once the total is known. Pushing that would
            // make Back lead to the same page past the end, and clamp, and push, forever.
            const state = api.getState();
            const corrected =
                changed.length === 1 &&
                changed[0] === 'page' &&
                state.isTotalExact &&
                previous.pagination.pageIndex >= Math.max(1, state.pageCount);

            const push = !corrected && meaningful.some((facet) => now.push.includes(facet) && facets.includes(facet));
            if (push || now.debounceMs === 0) {
                write(push ? 'push' : 'replace');
                return;
            }
            cancel();
            pending.current = setTimeout(() => {
                pending.current = null;
                write('replace');
            }, now.debounceMs);
        });
        // A source that answers synchronously settles while the engine is created, before this effect
        // runs, and the engine's page correction goes by unheard. Anything that moved the query away
        // from the URL by now is written as a replace; a URL that already describes the grid is left
        // exactly as it is.
        write('replace');
        return off;
    }, [api, write, cancel]);

    useEffect(() => cancel, [cancel]);

    const applyFromUrl = useCallback(() => {
        if (api.destroyed) return;
        const { settings: now } = latest.current;
        const params = now.adapter.getParams();
        const own = ownParameters(params, now.prefix);
        if (own === seen.current) return;
        seen.current = own;
        // A replace still waiting would otherwise land on the entry the reader just moved to.
        cancel();

        const facets = activeFacets(latest.current);
        const has = (facet: UrlSyncFacet) => facets.includes(facet);
        const { baseline } = now;
        const parsed = parseGridQuery(params, api.getColumns(), {
            prefix: now.prefix,
            facets,
            baseline,
            maxPageSize: now.maxPageSize,
        });
        const query = api.getState().query;
        // A facet the URL does not name is the grid's starting value: that is what its absence meant
        // when it was written. A facet this grid does not sync keeps whatever it has.
        const target: GridQuery = {
            search: has('search') ? (parsed.search ?? baseline.search) : query.search,
            sort: has('sort') ? (parsed.sort ?? baseline.sort) : query.sort,
            filters: has('filters') ? (parsed.filters ?? baseline.filters) : query.filters,
            pagination: {
                pageIndex: has('page') ? (parsed.pagination?.pageIndex ?? baseline.pagination.pageIndex) : query.pagination.pageIndex,
                pageSize: has('size') ? (parsed.pagination?.pageSize ?? baseline.pagination.pageSize) : query.pagination.pageSize,
            },
        };

        applying.current = true;
        try {
            api.setQuery(target);
            // The engine moves to the first page when the filters or sort change, unless the page
            // changed as well. An entry with a new filter on the same page would land on page one and
            // then be rewritten there, so the page goes in again on its own.
            const landed = api.getState().query.pagination.pageIndex;
            if (has('page') && landed !== target.pagination.pageIndex) api.setPage(target.pagination.pageIndex);
        } finally {
            applying.current = false;
        }
    }, [api, cancel]);

    const { adapter } = settings;
    useEffect(() => adapter.subscribe?.(applyFromUrl), [adapter, applyFromUrl]);

    // New parameters arriving through a render, which is how a router delivers them.
    useEffect(() => {
        applyFromUrl();
    }, [current, applyFromUrl]);

    return <>{children}</>;
}
