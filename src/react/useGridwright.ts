import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createGridEngine } from '../core/engine';
import { GridwrightError } from '../core/errors';
import { createQuery } from '../core/query';
import type { LocalDataSource } from '../data/local';
import { createLocalDataSource } from '../data/local';
import { corePlugins } from '../plugins';
import type { ColumnValue, DataSource, GridApi, GridPlugin } from '../core/types';
import { orderAddons, resolveContributions } from './addons/resolve';
import type { AddonContribution, ResolvedAddon } from './addons/types';
import { coreAddons } from './core-addons';
import { createAnnouncer } from './a11y/announcer';
import type { GridwrightColumn, GridwrightInstance, UseGridwrightOptions } from './types';

/**
 * Cheap identity for a column set.
 *
 * Column arrays are almost always written inline, so their reference changes on every render.
 * Rebuilding the engine's columns on reference alone would loop: setColumns publishes state, the
 * state publishes a render, the render makes a new array. Only the parts the engine actually
 * reads take part in this signature; renderers are read from the definitions at render time instead.
 */
export function columnSignature<TRow>(columns: readonly GridwrightColumn<TRow, ColumnValue>[]): string {
    return columns
        .map((column) =>
            [
                column.id,
                column.header ?? '',
                typeof column.accessor === 'function' ? 'fn' : String(column.accessor ?? ''),
                column.sortable === false ? '0' : '1',
                column.filterable === false ? '0' : '1',
                column.searchable === false ? '0' : '1',
                column.hidden ? '1' : '0',
            ].join('~'),
        )
        .join('|');
}

/** The names of a grid's add-ons, in order: what `<Gridwright />` keys itself on. */
export function addonNamesOf<TRow>(options: Pick<UseGridwrightOptions<TRow>, 'addons' | 'coreAddons'>): string {
    return orderAddons<TRow>(options.coreAddons, () => coreAddons<TRow>(), options.addons)
        .map((addon) => addon.name)
        .join('\n');
}

/**
 * Creates and owns a grid engine for a React tree, with its add-ons.
 *
 * Use it directly when you want to compose the parts yourself, or let `<Gridwright />` call it for
 * you. Either way the engine outlives renders, and the component re-renders through
 * `useSyncExternalStore`, so a state change reaches concurrent-mode React without tearing.
 *
 * Every add-on's `setup` runs here, on every render and in order, so the list of add-on names must
 * not change for the life of the component: key the component on it, as `<Gridwright />` does.
 */
export function useGridwright<TRow>(options: UseGridwrightOptions<TRow>): GridwrightInstance<TRow> {
    const addons = orderAddons<TRow>(options.coreAddons, () => coreAddons<TRow>(), options.addons);
    const names = addons.map((addon) => addon.name);

    // Changing the list would call a different set of hooks than the previous render did, which
    // React reports as an unrelated-looking hook order error somewhere inside an add-on.
    const mountedNames = useRef(names.join('\n'));
    if (mountedNames.current !== names.join('\n')) {
        throw new GridwrightError(
            '[gridwright] the add-ons of a mounted grid changed. Give the component that calls useGridwright a `key` built from the add-on names, so it remounts; <Gridwright /> does this for you.',
            { retryable: false },
        );
    }

    // Each add-on sees the options as the add-ons before it left them.
    let configured = options;
    const resolved: ResolvedAddon<TRow>[] = [];
    for (const addon of addons) {
        const contribution: AddonContribution<TRow> = addon.setup({ options: configured, addons: names }) ?? {};
        if (contribution.configure) configured = contribution.configure(configured);
        resolved.push({ name: addon.name, contribution });
    }
    const contributions = resolveContributions(resolved);

    if (configured.data !== undefined && configured.dataSource !== undefined) {
        throw new Error(
            '[gridwright] pass either `data` for an in-memory array or `dataSource` for anything else, not both.',
        );
    }

    // Add-on plugins first, then the consumer's, all on top of the core set.
    const plugins: readonly GridPlugin<TRow>[] = [
        ...resolved.flatMap(({ contribution }) => contribution.plugins ?? []),
        ...(configured.plugins ?? []),
    ];

    const latest = useRef(configured);
    latest.current = configured;
    const latestPlugins = useRef(plugins);
    latestPlugins.current = plugins;

    // Owned by this hook, so it is also disposed by this hook. A source passed in by the caller
    // belongs to the caller and is never disposed here.
    const ownedLocalSource = useRef<LocalDataSource<TRow> | null>(null);

    const resolveSource = useCallback((): DataSource<TRow> => {
        const current = latest.current;
        if (current.dataSource) return current.dataSource;
        if (!ownedLocalSource.current) {
            ownedLocalSource.current = createLocalDataSource<TRow>(current.data ?? []);
        }
        return ownedLocalSource.current;
    }, []);

    // Which plugin names each engine was built or reconciled with. Per engine, because Strict Mode
    // replaces the engine and the replacement starts from the plugins it was created with.
    const installed = useRef(new WeakMap<GridApi<TRow>, Set<string>>());

    const createEngine = useCallback((): GridApi<TRow> => {
        const current = latest.current;
        const baseQuery = createQuery(current.initialQuery);
        const extra = latestPlugins.current;

        const api = createGridEngine<TRow>({
            columns: current.columns,
            dataSource: resolveSource(),
            ...(current.getRowId ? { getRowId: current.getRowId } : {}),
            initialQuery: current.pageSize
                ? { ...baseQuery, pagination: { ...baseQuery.pagination, pageSize: current.pageSize } }
                : baseQuery,
            ...(current.selectionMode ? { selectionMode: current.selectionMode } : {}),
            ...(current.keepPreviousData !== undefined ? { keepPreviousData: current.keepPreviousData } : {}),
            ...(current.queryDebounceMs !== undefined ? { queryDebounceMs: current.queryDebounceMs } : {}),
            ...(current.corePlugins === false ? { corePlugins: false } : {}),
            plugins: extra,
        });
        installed.current.set(api, new Set(extra.map((plugin) => plugin.name)));
        return api;
    }, [resolveSource]);

    const [api, setApi] = useState<GridApi<TRow>>(createEngine);
    const [announcer] = useState(createAnnouncer);

    // What the engine is actually attached to. Comparing a new prop against `resolveSource()`
    // would compare it against itself, which is always equal, so the swap never happened.
    const attachedSource = useRef<DataSource<TRow> | null>(configured.dataSource ?? null);

    useEffect(() => {
        // Strict Mode runs effects twice on mount and destroys the engine in between. Rebuilding
        // when that happens is what keeps a double-invoked mount from leaving a dead grid.
        if (api.destroyed) {
            attachedSource.current = latest.current.dataSource ?? null;
            setApi(createEngine());
            return;
        }
        return () => {
            api.destroy();
        };
    }, [api, createEngine]);

    useEffect(
        () => () => {
            ownedLocalSource.current?.dispose?.();
            ownedLocalSource.current = null;
        },
        [],
    );

    const state = useSyncExternalStore(api.subscribe, api.getState, api.getState);

    // Plugins are reconciled by name, never by identity: an inline array is new on every render, and
    // reinstalling on identity would recompute the pipeline on every render, which renders again.
    const pluginKey = plugins.map((plugin) => plugin.name).join('\n');
    useEffect(() => {
        if (api.destroyed) return;
        const wanted = latestPlugins.current;
        const wantedNames = new Set(wanted.map((plugin) => plugin.name));
        const current = installed.current.get(api) ?? new Set<string>();
        const core = latest.current.corePlugins === false ? [] : corePlugins<TRow>();

        for (const name of [...current]) {
            if (wantedNames.has(name)) continue;
            api.removePlugin(name);
            current.delete(name);
            // A plugin that stood in for a core one leaves the core one behind it.
            const original = core.find((plugin) => plugin.name === name);
            if (original) api.use(original);
        }
        for (const plugin of wanted) {
            if (current.has(plugin.name)) continue;
            // A replacement for a core plugin that is already running takes its place.
            if (core.some((candidate) => candidate.name === plugin.name)) api.removePlugin(plugin.name);
            api.use(plugin);
            current.add(plugin.name);
        }
        installed.current.set(api, current);
    }, [api, pluginKey]);

    // Keyed on the signature, not the array reference: see columnSignature above. Add-ons that read
    // options of their own from a column add them, so a change to one reaches the engine too.
    const signature =
        columnSignature(configured.columns) +
        resolved
            .map(({ contribution }) =>
                contribution.columnSignature ? '#' + configured.columns.map(contribution.columnSignature).join('|') : '',
            )
            .join('');
    useEffect(() => {
        api.setColumns(latest.current.columns);
    }, [api, signature]);

    const data = configured.data;
    useEffect(() => {
        if (data === undefined) return;
        const source = ownedLocalSource.current;
        if (!source || source.getRows() === data) return;
        source.setRows(data);
    }, [api, data]);

    const dataSource = configured.dataSource;
    useEffect(() => {
        if (!dataSource) return;
        if (attachedSource.current === dataSource) return;
        attachedSource.current = dataSource;
        api.setDataSource(dataSource);
    }, [api, dataSource]);

    const selectionMode = configured.selectionMode;
    useEffect(() => {
        if (selectionMode && selectionMode !== api.getSelectionMode()) {
            api.setSelectionMode(selectionMode);
        }
    }, [api, selectionMode]);

    const pageSize = configured.pageSize;
    useEffect(() => {
        if (pageSize && pageSize !== api.getState().query.pagination.pageSize) {
            api.setPageSize(pageSize);
        }
    }, [api, pageSize]);

    useEffect(() => {
        const offQuery = api.on('query:change', ({ query }) => latest.current.onQueryChange?.(query));
        const offSelection = api.on('selection:change', ({ selectedIds }) =>
            latest.current.onSelectionChange?.(selectedIds, api.getSelectedRows()),
        );
        const offError = api.on('fetch:error', ({ error }) => latest.current.onError?.(error));

        return () => {
            offQuery();
            offSelection();
            offError();
        };
    }, [api]);

    // Built from this render's columns rather than memoised: the renderers on them are what the
    // parts call, and an add-on that wraps a column builds a fresh wrapper each render. A memo keyed
    // on the signature is exactly the stale copy that once kept a hidden column on screen.
    const definitions = new Map<string, GridwrightColumn<TRow, ColumnValue>>();
    for (const column of configured.columns) definitions.set(column.id, column);

    return {
        api,
        state,
        columns: api.getColumns(),
        definitions,
        contributions,
        announce: announcer.say,
    };
}
