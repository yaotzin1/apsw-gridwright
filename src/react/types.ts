import type { ReactNode } from 'react';
import type { LocaleCatalog } from '../i18n/messages';
import type { MessageOverrides, TranslateFn, Translator } from '../i18n/translator';
import type { GridAddon, ResolvedContributions } from './addons/types';
import type {
    ColumnDef,
    ColumnValue,
    GridPlugin,
    DataSource,
    GridApi,
    GridQuery,
    GridRow,
    GridState,
    ResolvedColumn,
    RowId,
    SelectionMode,
} from '../core/types';

export interface CellContext<TRow, TValue = ColumnValue> {
    readonly value: TValue;
    readonly row: TRow;
    readonly rowId: RowId;
    readonly rowIndex: number;
    readonly column: ResolvedColumn<TRow, TValue>;
    readonly api: GridApi<TRow>;
}

export interface HeaderContext<TRow, TValue = ColumnValue> {
    readonly column: ResolvedColumn<TRow, TValue>;
    readonly api: GridApi<TRow>;
    readonly sortDirection: 'asc' | 'desc' | null;
}

/**
 * A column definition with rendering attached.
 *
 * The core `ColumnDef` deliberately has no renderer: rendering is an adapter's business, and a
 * `ReactNode` in the engine would put React in the dependency graph of a headless package. This
 * type adds the renderers back for React consumers and is otherwise the same object.
 */
export interface GridwrightColumn<TRow, TValue = ColumnValue> extends ColumnDef<TRow, TValue> {
    readonly cell?: (context: CellContext<TRow, TValue>) => ReactNode;
    readonly headerCell?: (context: HeaderContext<TRow, TValue>) => ReactNode;
    /**
     * A glyph rendered before the cell's content, resolved per row.
     *
     * Any node, so any icon library or an inline SVG works. It is marked `aria-hidden`, because an
     * icon that repeats what the text beside it already says is noise to a screen reader; put the
     * meaning in the text or in the cell's own markup.
     */
    readonly icon?: (context: CellContext<TRow, TValue>) => ReactNode;
    // An add-on's own options arrive by module augmentation, from the add-on's module: `edit` from
    // inline editing, `filter` from column filters. The built-in add-ons declare theirs exactly as
    // an add-on of yours would, so neither has a way onto a column that the other lacks.
}

export interface GridwrightClassNames {
    readonly root?: string;
    readonly toolbar?: string;
    readonly search?: string;
    readonly tableWrapper?: string;
    readonly table?: string;
    readonly thead?: string;
    readonly headerRow?: string;
    readonly headerCell?: string;
    readonly tbody?: string;
    readonly row?: string;
    readonly rowSelected?: string;
    readonly cell?: string;
    readonly footer?: string;
    readonly pagination?: string;
    readonly status?: string;
    /** The banner shown when a refresh failed and the previous rows are still on screen. */
    readonly stale?: string;
    /** The filter button in a header cell. */
    readonly filterTrigger?: string;
    /** The dialog a filter button opens. */
    readonly filterDialog?: string;
}

/**
 * Translation inputs, shared by the hook and the component.
 *
 * Normally one prop: `locale={pl}` with a pack from `apsw-gridwright/locales`. The rest are for
 * the cases that pack does not cover.
 */
export interface GridwrightI18nProps {
    /**
     * A BCP 47 tag, or a catalog imported from `apsw-gridwright/locales`.
     *
     * A bare tag sets plural rules, number formatting and text direction while the text stays
     * English, which is what you want for `en-GB` and not what you want for `pl`. Pass the catalog
     * to translate the text as well.
     */
    readonly locale?: string | LocaleCatalog;
    /**
     * Overrides for individual messages, applied over the catalog: the shell's keys, and any
     * add-on's keys as `<add-on name>.<key>`, for example `'gridwright:filters.apply'`.
     */
    readonly messages?: MessageOverrides;
    /**
     * Delegate translation to an existing i18n library. `react-i18next`, `FormatJS` and `Lingui`
     * all expose a function of this shape, so this is usually `translate={t}`.
     */
    readonly translate?: TranslateFn;
    /**
     * Direct label overrides, applied last.
     *
     * The catalog is the translation path; this is the escape hatch for changing one string
     * without shipping a catalog, or for a label that needs logic a message cannot express.
     */
    readonly labels?: Partial<GridwrightLabels>;
}

/**
 * Every string the shell renders: its status rows and its live region.
 *
 * A feature's strings belong to its add-on, and are changed through `messages` under the add-on's
 * name, `translate`, or a locale pack's `addons` section.
 */
export interface GridwrightLabels {
    readonly loading: string;
    readonly empty: string;
    readonly errorTitle: string;
    readonly retry: string;
    /** Announced when a paginated result settles. `exact` false means the source sent no total. */
    readonly rowsShown: (from: number, to: number, total: number, exact: boolean) => string;
    /** Announced when a windowed result settles, where a from-to range describes the scroll position. */
    readonly rowsTotal: (count: number) => string;
}

export interface GridwrightInstance<TRow> {
    readonly api: GridApi<TRow>;
    readonly state: GridState<TRow>;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly definitions: ReadonlyMap<string, GridwrightColumn<TRow, ColumnValue>>;
    /** Every add-on's contribution, resolved and in order. What the parts render from. */
    readonly contributions: ResolvedContributions<TRow>;
    /**
     * Says one sentence through the grid's live region, for something that is not grid state: an
     * export finishing, a row copied. The next change of the grid's own state speaks over it.
     */
    readonly announce: (message: string) => void;
}

export interface UseGridwrightOptions<TRow> {
    readonly columns: readonly GridwrightColumn<TRow, ColumnValue>[];
    /** An in-memory array. Mutually exclusive with `dataSource`. */
    readonly data?: readonly TRow[];
    /** Any data source, remote or otherwise. Mutually exclusive with `data`. */
    readonly dataSource?: DataSource<TRow>;
    readonly getRowId?: (row: TRow, index: number) => RowId;
    readonly initialQuery?: Partial<GridQuery>;
    readonly pageSize?: number;
    readonly selectionMode?: SelectionMode;
    readonly keepPreviousData?: boolean;
    readonly queryDebounceMs?: number;
    /**
     * Engine plugins added to the core set. A plugin named like a core one replaces it.
     *
     * Reconciled by name on a live grid: a name that appears is installed, a name that disappears is
     * removed. A new object under a name already installed is ignored, so an inline array does not
     * reinstall its plugins on every render; rename it to replace it.
     */
    readonly plugins?: readonly GridPlugin<TRow>[];
    /** Default true. False installs no core plugin: filtering, search, sorting and pagination are yours. */
    readonly corePlugins?: boolean;
    /**
     * Features, after the core add-ons: `[search(), columnFilters(), exportMenu()]`.
     *
     * Changing which names are listed remounts the grid, because each add-on's setup calls hooks and
     * React requires the same hooks in the same order.
     */
    readonly addons?: readonly GridAddon<TRow>[];
    /**
     * The add-ons every grid starts with. Default `coreAddons()`: sorting, selection, pagination and
     * the stale-rows notice. Pass a list to change one of them, or `false` for a bare table.
     */
    readonly coreAddons?: readonly GridAddon<TRow>[] | false;
    readonly onQueryChange?: (query: GridQuery) => void;
    readonly onSelectionChange?: (ids: readonly RowId[], rows: readonly TRow[]) => void;
    readonly onError?: (error: GridState<TRow>['error']) => void;
}

export interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    /**
     * Drive the grid from an instance created by `useGridwright` instead of props. The instance
     * carries its own add-ons; `addons` and `coreAddons` here are then ignored.
     */
    readonly instance?: GridwrightInstance<TRow>;
    readonly className?: string;
    readonly classNames?: Partial<GridwrightClassNames>;
    /** Your own toolbar content, after every add-on's. */
    readonly toolbar?: ReactNode;
    /** Rendered after the table and every add-on below it. */
    readonly footer?: ReactNode;
    readonly caption?: ReactNode;
    readonly onRowClick?: (row: GridRow<TRow>) => void;
    readonly 'aria-label'?: string;
}

export type { Translator };
