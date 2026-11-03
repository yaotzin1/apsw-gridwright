import { createGridEngine } from '../core/engine';
import { createQuery } from '../core/query';
import type { ColumnDef, ColumnValue, DataSource, GridApi, GridQuery, RowId, SelectionMode } from '../core/types';
import { createLocalDataSource } from '../data/local';
import { createTranslator } from '../i18n/translator';
import type { TranslatorOptions } from '../i18n/translator';
import type { AddonMessages } from '../i18n/messages';
import type { ViewAddon, ViewAddonContribution, ViewRenderGrid } from './addon';
import { sorting } from './addons/sorting';
import { mergeLabels } from './labels';
import type { ViewLabels } from './labels';
import { liveRegionKey, createLiveRegion } from './model/live-region';
import type { LiveRegionContributor } from './model/live-region';
import { buildTableModel } from './model/table-model';
import type { TableModel } from './model/table-model';
import { text } from './node';
import { orderAddons, resolveSet } from './resolve';
import type { OptionalAddon } from './resolve';
import { createStateScope } from './store';

/**
 * Everything a grid needs that is not drawing it: the engine, the add-ons resolved and run, their
 * per-grid state, the translator and the live region. It is what `useGridwright` is for React, written
 * once for every adapter that has no hook to lean on.
 *
 *     const host = createGridHost({ columns, data });
 *     host.subscribe(() => redraw(host.getModel()));
 *
 * `getModel()` is the table as plain data; `host.api` is the engine, for the handlers a node carries.
 */
export interface GridHostOptions<TRow> {
    readonly columns: readonly ColumnDef<TRow, ColumnValue>[];
    /** Rows in memory. Pass `dataSource` instead for anything else. */
    readonly data?: readonly TRow[];
    readonly dataSource?: DataSource<TRow>;
    readonly getRowId?: (row: TRow, index: number) => RowId;
    readonly pageSize?: number;
    readonly initialQuery?: Partial<GridQuery>;
    readonly selectionMode?: SelectionMode;
    /** Neutral add-ons after the core ones. `false`, `null` and `undefined` are skipped. */
    readonly addons?: readonly OptionalAddon<ViewAddon<TRow>>[];
    /** The add-ons every grid starts with. Default: sorting. `false` for a bare table. */
    readonly coreAddons?: readonly OptionalAddon<ViewAddon<TRow>>[] | false;
    readonly i18n?: TranslatorOptions;
    readonly labels?: Partial<ViewLabels>;
    readonly caption?: string;
    readonly ariaLabel?: string;
}

export interface GridHost<TRow> {
    readonly api: GridApi<TRow>;
    /** The table now. A new object when anything it is built from changed, the same one otherwise. */
    getModel(): TableModel<TRow>;
    /** Calls the listener after the model changes. Returns the way to stop. */
    subscribe(listener: () => void): () => void;
    /** Stops the engine and every subscription. */
    destroy(): void;
}

export function createGridHost<TRow>(options: GridHostOptions<TRow>): GridHost<TRow> {
    if (options.data !== undefined && options.dataSource !== undefined) {
        throw new Error('[gridwright] pass either `data` for an in-memory array or `dataSource` for anything else, not both.');
    }
    const translator = createTranslator(options.i18n);
    const labels = mergeLabels(translator, options.labels);
    const addons = orderAddons<ViewAddon<TRow>>(
        options.coreAddons,
        () => [sorting<TRow>()],
        options.addons,
    );
    const names = addons.map((addon) => addon.name);

    const baseQuery = createQuery(options.initialQuery);
    const api = createGridEngine<TRow>({
        columns: options.columns,
        dataSource: options.dataSource ?? createLocalDataSource<TRow>([...(options.data ?? [])]),
        ...(options.getRowId ? { getRowId: options.getRowId } : {}),
        initialQuery: options.pageSize ? { ...baseQuery, pagination: { ...baseQuery.pagination, pageSize: options.pageSize } } : baseQuery,
        ...(options.selectionMode ? { selectionMode: options.selectionMode } : {}),
    });

    const listeners = new Set<() => void>();
    let model: TableModel<TRow>;
    let message = '';
    let lastKey = '';
    const region = createLiveRegion();
    const scopes = new Map<string, ReturnType<typeof createStateScope>>();
    const scopeOf = (name: string): ReturnType<typeof createStateScope> => {
        let scope = scopes.get(name);
        if (!scope) {
            scope = createStateScope(() => refresh());
            scopes.set(name, scope);
        }
        return scope;
    };

    const refresh = (): void => {
        const state = api.getState();
        const resolved = addons.map((addon) => ({
            name: addon.name,
            contribution: (addon.setup({ addons: names, state: scopeOf(addon.name) }) ?? {}) as ViewAddonContribution<TRow>,
        }));
        const contributions = resolveSet(resolved);
        const columns = api.getColumns();

        const translate = (addon: string, fallback?: AddonMessages) => {
            const own = contributions.messages.get(addon) ?? fallback;
            return (key: string, values?: Readonly<Record<string, string | number>>) => translator.translateAddon(addon, key, values, own);
        };
        const grid: ViewRenderGrid<TRow> = {
            api,
            state,
            messages: translate,
            headerContent: (column) => text(column.header),
            headerControlTabIndex: undefined,
            cellControlTabIndex: () => undefined,
        };

        const contributors: LiveRegionContributor<TRow>[] = contributions.active.flatMap(({ name, contribution }) =>
            (contribution.announce ?? []).map((contributor) => ({ contributor, t: translate(name) })),
        );
        const key = liveRegionKey(state, contributions.navigation, contributors);
        if (key !== lastKey) {
            const sentence = region.sentence({
                state,
                grid,
                labels,
                paginated: contributions.navigation === 'pages',
                headers: new Map(columns.map((column) => [column.id, column.header])),
                contributors,
            });
            // `undefined` means the rows for this query have not arrived. The key is not spent, so the next
            // publish, which carries them, is asked again; without this a host that is told of every
            // publish (unlike a renderer that batches them) never says what the sort did.
            if (sentence !== undefined) {
                message = sentence;
                lastKey = key;
            }
        }

        model = buildTableModel<TRow>({
            grid,
            columns,
            contributions,
            labels,
            locale: translator.locale,
            direction: translator.direction,
            live: message,
            ...(options.caption !== undefined ? { caption: options.caption } : {}),
            ...(options.ariaLabel !== undefined ? { ariaLabel: options.ariaLabel } : {}),
        });
        for (const listener of [...listeners]) listener();
    };

    refresh();
    const stop = api.subscribe(() => refresh());

    return {
        api,
        getModel: () => model,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        destroy: () => {
            stop();
            listeners.clear();
            api.destroy();
        },
    };
}
