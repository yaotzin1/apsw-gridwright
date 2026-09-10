import type { ReactNode } from 'react';
import type { ColumnEditOptions, CommitEdit } from './plugins/InlineEdit';
import type { BubbleMenuItem, BubbleMenuTrigger } from './plugins/BubbleMenu';
import type { LoadChildrenContext, TreeChange, TreeController } from '../tree/controller';
import type { LocaleCatalog, MessageCatalog } from '../i18n/messages';
import type { TranslateFn, Translator } from '../i18n/translator';
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
    /**
     * Makes the column editable in place. Opt-in per column: a grid where every cell turns into a
     * text box on click is a grid nobody can read.
     */
    readonly edit?: ColumnEditOptions<TRow, TValue>;
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
    readonly treeExpand: string;
    readonly treeCollapse: string;
    readonly treeLoadFailed: string;
    readonly treeCycle: string;
    readonly treeChildCount: (count: number) => string;
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
    /** Replaces the default plugin set. See `corePlugins()` and `treePlugins()`. */
    readonly plugins?: readonly GridPlugin<TRow>[];
    readonly onQueryChange?: (query: GridQuery) => void;
    readonly onSelectionChange?: (ids: readonly RowId[], rows: readonly TRow[]) => void;
    readonly onError?: (error: GridState<TRow>['error']) => void;
}

/** Turns the grid into a tree. Every other option keeps working on top of it. */
export interface GridTreeOptions<TRow> {
    /** Stable identity of the row. Every placement of it shares this. */
    readonly getRowId: (row: TRow) => RowId;
    /** Children carried on the row. Mutually exclusive with `getParentIds`. */
    readonly getChildren?: (row: TRow) => readonly TRow[] | undefined;
    /** Parents named by the row. The only shape that can express several parents. */
    readonly getParentIds?: (row: TRow) => readonly RowId[] | RowId | null | undefined;
    /** Whether a row has children that have not been loaded. Draws a toggle before they arrive. */
    readonly hasChildren?: (row: TRow) => boolean;
    /** Fetches children on first expand, keyed on the row rather than the placement. */
    readonly loadChildren?: (context: LoadChildrenContext<TRow>) => Promise<readonly TRow[]>;
    readonly maxDepth?: number;
    readonly defaultExpandedDepth?: number;
    /** Persists an edit, an insert, a move or a removal. Omit it and changes stay in memory. */
    readonly onCommit?: (change: TreeChange<TRow>) => Promise<void> | void;
    readonly onExpandedChange?: (nodeIds: readonly string[]) => void;
    /** Which column carries the indentation and the toggle. Default: the first visible one. */
    readonly treeColumnId?: string;
    /** Keep a non-matching row whose descendant matches while filtering. Default true. */
    readonly keepAncestorsOfMatches?: boolean;
    /**
     * Receives the controller once it exists, and `null` when the grid unmounts.
     *
     * Expansion, insertion, moving and removal live on the controller, so a page that enables the
     * tree by prop still needs a way to reach it. The controller's identity is stable for the life
     * of the grid, so this fires once rather than on every state change.
     */
    readonly controllerRef?: (controller: TreeController<TRow> | null) => void;
}

/** Renders only the rows on screen. Works over a flat grid and over a tree alike. */
export interface GridVirtualOptions {
    /** Fixed row height in pixels. Must match `--gw-row-height`. Default 40. */
    readonly rowHeight?: number;
    /** Extra rows rendered above and below the viewport. Default 6. */
    readonly overscan?: number;
    /** Height of the scrolling area. Default 420. */
    readonly height?: number | string;
}

export interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    /** Drive the grid from an instance created by `useGridwright` instead of props. */
    readonly instance?: GridwrightInstance<TRow>;
    /**
     * Turns the grid into a tree.
     *
     * Switching this on or off on a live grid remounts it, because a tree and a flat list are
     * different grids. Everything else, including virtualization, row actions and editing, keeps
     * working unchanged on top of it.
     */
    readonly tree?: GridTreeOptions<TRow>;
    /**
     * Renders only the rows on screen. `true` for the defaults, or an object to tune them.
     *
     * Replaces the pagination footer, because a scrollbar over the whole result set is already the
     * navigation and two disagreeing ones is worse than either.
     */
    readonly virtual?: boolean | GridVirtualOptions;
    /** Row actions, shown in a floating menu on hover and on focus. */
    readonly rowActions?: readonly BubbleMenuItem<TRow>[];
    readonly rowActionsTrigger?: BubbleMenuTrigger;
    /**
     * Persists an inline edit. Which cells are editable is decided per column, by `edit`.
     *
     * In a tree this is usually `(rowId, columnId, value) => grid.tree.updateRow(rowId, ...)`,
     * which already applies the change optimistically and reverts it if this rejects.
     *
     * With `instance`, this wires the editing context but not the columns: an instance you built
     * yourself carries the columns you gave the hook, so wrap them with `editableColumns()` there.
     * The order is the reason it is not done for you, since in a tree the editor belongs inside
     * the tree cell rather than around it.
     */
    readonly onCellEdit?: CommitEdit;
    /** Rendered for a virtualized row whose data has not arrived yet. */
    readonly renderSkeleton?: (absoluteIndex: number) => ReactNode;
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
