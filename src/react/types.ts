import type { ReactNode } from 'react';
import type { LocaleCatalog, MessageCatalog } from '../i18n/messages';
import type { TranslateFn, Translator } from '../i18n/translator';
import type {
    ColumnDef,
    ColumnValue,
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
    /** Overrides for individual message keys, applied over the catalog. */
    readonly messages?: Partial<MessageCatalog>;
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

/** Every string the component can render, so nothing needs to be patched for another language. */
export interface GridwrightLabels {
    readonly searchPlaceholder: string;
    readonly searchAriaLabel: string;
    readonly loading: string;
    readonly empty: string;
    readonly errorTitle: string;
    readonly retry: string;
    readonly selectRow: string;
    readonly selectAll: string;
    readonly selectedCount: (count: number) => string;
    readonly sortAscending: string;
    readonly sortDescending: string;
    readonly clearSort: string;
    readonly previousPage: string;
    readonly nextPage: string;
    readonly rowsPerPage: string;
    readonly pageRange: (from: number, to: number, total: number, exact: boolean) => string;
}

export interface GridwrightInstance<TRow> {
    readonly api: GridApi<TRow>;
    readonly state: GridState<TRow>;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly definitions: ReadonlyMap<string, GridwrightColumn<TRow, ColumnValue>>;
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
    readonly onQueryChange?: (query: GridQuery) => void;
    readonly onSelectionChange?: (ids: readonly RowId[], rows: readonly TRow[]) => void;
    readonly onError?: (error: GridState<TRow>['error']) => void;
}

export interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    /** Drive the grid from an instance created by `useGridwright` instead of props. */
    readonly instance?: GridwrightInstance<TRow>;
    readonly className?: string;
    readonly classNames?: Partial<GridwrightClassNames>;
    /** Renders the built-in search box. Default false. */
    readonly searchable?: boolean;
    readonly toolbar?: ReactNode;
    readonly footer?: ReactNode;
    readonly caption?: ReactNode;
    /** Hides the built-in pagination footer. Default false. */
    readonly hidePagination?: boolean;
    readonly pageSizeOptions?: readonly number[];
    readonly onRowClick?: (row: GridRow<TRow>) => void;
    readonly renderEmpty?: () => ReactNode;
    readonly renderLoading?: () => ReactNode;
    readonly renderError?: (error: NonNullable<GridState<TRow>['error']>, retry: () => void) => ReactNode;
    readonly 'aria-label'?: string;
}

export type { Translator };
