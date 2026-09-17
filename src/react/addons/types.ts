import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, RefObject, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import type { ColumnValue, GridError, GridPlugin, GridRow, GridState, ResolvedColumn } from '../../core/types';
import type { AddonMessages } from '../../i18n/messages';
import type { TranslateValues } from '../../i18n/translator';
import type { GridwrightContextValue } from '../context';
import type { GridwrightColumn, UseGridwrightOptions } from '../types';

/**
 * A React add-on: one feature of the table, delivered through the same contract whether it ships in
 * this package or in someone else's.
 *
 *     export const heatmap = (): GridAddon<Row> => ({
 *         name: 'acme:heatmap',
 *         setup: () => ({
 *             cellAttributes: (row, column) => ({ style: { background: shade(row.data[column.id]) } }),
 *         }),
 *     });
 *
 * Every feature this package ships (sorting, selection, pagination, filters, export, the tree,
 * virtualization, row actions, inline editing) is an add-on of exactly this shape, using nothing that
 * is not exported.
 */
export interface GridAddon<TRow = unknown> {
    /**
     * Unique within one grid, namespaced like a plugin: `gridwright:filters`, `acme:heatmap`. It is
     * also the namespace of the add-on's messages and what `suppresses` and `requires` refer to.
     */
    readonly name: string;
    /** Add-ons that must be present in the same grid. A missing one is an error that names both. */
    readonly requires?: readonly string[];
    /**
     * Add-ons this one is placed after when both are listed, whatever order they were listed in.
     *
     * For an add-on whose `configure` has to see another's result: the tree wraps columns, so it goes
     * after anything that wraps a cell's content. A name that is not listed is ignored; a cycle throws.
     */
    readonly after?: readonly string[];
    /** Add-ons this one is placed before when both are listed. The mirror of `after`. */
    readonly before?: readonly string[];
    /**
     * Called on every render of the grid, in add-on order, and may call hooks: a controller that lives
     * as long as the grid, a ref, open or closed state. It returns what the add-on contributes.
     *
     * Slot functions in the contribution are called during rendering and must not call hooks; put
     * state in `setup` or in the components the slots render.
     *
     * When it calls hooks, write it as a named function expression starting with `use`,
     * `setup: function useHeatmap() { ... }`, so the React hooks lint rule checks it like any hook.
     */
    readonly setup: (context: AddonSetupContext<TRow>) => AddonContribution<TRow> | void;
}

export interface AddonSetupContext<TRow> {
    /** The grid's options as the add-ons before this one configured them. */
    readonly options: UseGridwrightOptions<TRow>;
    /** Every add-on name in this grid, in order. */
    readonly addons: readonly string[];
}

/**
 * What every slot function receives: the grid instance, plus the labels, translator and class names
 * the grid renders with.
 */
export type GridContext<TRow> = GridwrightContextValue<TRow>;

/** Content for a slot around or inside the table. Returns elements; never an HTML string. */
export type SlotRender<TRow> = (grid: GridContext<TRow>) => ReactNode;

/** The plain attributes in `CONTRIBUTABLE_ATTRIBUTES`, for the types. */
type ContributableName =
    | 'className'
    | 'style'
    | 'role'
    | 'id'
    | 'title'
    | 'tabIndex'
    | 'hidden'
    | 'dir'
    | 'lang'
    | 'draggable'
    | 'scope'
    | 'colSpan'
    | 'rowSpan'
    | 'abbr'
    | 'headers';

/**
 * Attributes an add-on may put on an element it does not own: event handlers, `aria-*`, `data-*`
 * and a short list of inert attributes.
 *
 * An allowlist, so no children, no markup and no URL attribute can arrive through an extension
 * point. `mergeAttributes` enforces the same list at runtime, because a type is only a courtesy to
 * code that was compiled against it.
 */
export type ContributedAttributes<E, A extends HTMLAttributes<E> = HTMLAttributes<E>> = Pick<A, Extract<keyof A, ContributableName>> & {
    [K in keyof A as K extends `on${string}` | `aria-${string}` ? K : never]?: A[K];
} & {
    readonly [data: `data-${string}`]: string | number | boolean | undefined;
};

/** A column that is not one of the grid's data columns: a selection checkbox, a drag handle. */
export interface ExtraColumn<TRow> {
    /** Unique among the grid's extra columns, and used as the React key. */
    readonly id: string;
    /** Before the data columns or after them. Within a side, add-on order decides. */
    readonly placement: 'start' | 'end';
    readonly header: SlotRender<TRow>;
    readonly cell: (row: GridRow<TRow>, grid: GridContext<TRow>) => ReactNode;
    /** Added to both the header cell and the body cells. */
    readonly className?: string;
}

export interface AnnouncementChange<TRow> {
    /** The previous settled state, or null for the first one. */
    readonly previous: GridState<TRow> | null;
    readonly next: GridState<TRow>;
    /** Header text by column id, so a change can be named by the header the reader sees. */
    readonly headers: ReadonlyMap<string, string>;
    readonly grid: GridContext<TRow>;
    /** The contributing add-on's own strings, resolved exactly as `useAddonMessages` resolves them. */
    readonly t: (key: string, values?: TranslateValues) => string;
}

/**
 * A sentence for the grid's single live region.
 *
 * The shell says "loading" while a fetch is in flight and nothing on error (an alert already speaks).
 * For a settled state every contributor is asked; the highest priority non-null sentence is spoken,
 * and the shell's row range when all return null. Sorting uses 20 and column filters 10.
 */
export interface AnnouncementContributor<TRow> {
    readonly priority: number;
    /**
     * What this contributor's sentence depends on, as a string. The live region is re-evaluated when
     * the shell's own inputs or any contributor's key changes, and not otherwise, so a selection
     * does not repeat the row range. Sorting returns the sort, filters the filters.
     */
    readonly key?: (state: GridState<TRow>) => string;
    readonly describe: (change: AnnouncementChange<TRow>) => string | null;
}

export type { AddonMessages };

export interface TableWrapperContribution {
    readonly ref?: RefObject<HTMLDivElement | null>;
    readonly style?: CSSProperties;
    readonly className?: string;
}

export interface StatusContribution<TRow> {
    readonly loading?: SlotRender<TRow>;
    readonly empty?: SlotRender<TRow>;
    readonly error?: (error: GridError, retry: () => void, grid: GridContext<TRow>) => ReactNode;
}

/**
 * Everything an add-on can contribute. Every field is optional; an add-on contributes only what its
 * feature needs.
 *
 * The functions are typed over the grid's row. An add-on that changes the row type the engine sees
 * (the tree turns rows into nodes) types its own contributions over that row and is responsible for
 * handing the consumer's row back through its own helpers.
 */
export interface AddonContribution<TRow> {
    // --- The engine ----------------------------------------------------------------------------

    /**
     * Transforms the grid's options before the engine is created or updated: wrap the data source,
     * wrap or add columns, choose the row id, set an initial query. Applied in add-on order, so each
     * add-on sees the previous one's result.
     */
    readonly configure?: (options: UseGridwrightOptions<TRow>) => UseGridwrightOptions<TRow>;
    /** Engine plugins added to the grid, after the core plugins and before the consumer's own. */
    readonly plugins?: readonly GridPlugin<TRow>[];
    /**
     * Extra text for the column signature. The engine re-resolves columns only when the signature
     * changes, so an option this add-on reads from a column must be part of it.
     */
    readonly columnSignature?: (column: GridwrightColumn<TRow, ColumnValue>) => string;

    // --- Composition ---------------------------------------------------------------------------

    /**
     * Wraps the grid's content in providers, inside the root element and the grid's own context. The
     * first add-on is outermost.
     */
    readonly provide?: (children: ReactNode, grid: GridContext<TRow>) => ReactNode;
    /**
     * Add-ons whose rendering this one replaces: their slots, status renderers, announcements and
     * providers are ignored. Their `configure`, plugins and messages still apply, because hiding a view
     * must not change the data.
     */
    readonly suppresses?: readonly string[];
    /** `window` when the reader moves by scrolling rather than by pages. Default `pages`. */
    readonly navigation?: 'pages' | 'window';

    // --- Around the table ----------------------------------------------------------------------

    readonly toolbar?: SlotRender<TRow>;
    /**
     * Toolbar content that is never the reason a toolbar appears: a selection count. Rendered after
     * the `toolbar` items only while one of them, or the grid's own `toolbar`, renders something.
     */
    readonly toolbarStatus?: SlotRender<TRow>;
    readonly aboveTable?: SlotRender<TRow>;
    readonly belowTable?: SlotRender<TRow>;
    /** Content inside the root but outside the layout flow: a floating menu, a dialog. */
    readonly overlay?: SlotRender<TRow>;

    // --- The table -----------------------------------------------------------------------------

    readonly tableAttributes?: (grid: GridContext<TRow>) => ContributedAttributes<HTMLTableElement>;
    readonly tableWrapper?: (grid: GridContext<TRow>) => TableWrapperContribution;
    /** Runs in add-on order until one returns true, which also prevents the default. */
    readonly tableKeyDown?: (event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>) => boolean;
    /** A `<tfoot>` after the body: totals, a summary row. */
    readonly tableFooter?: SlotRender<TRow>;

    // --- The header ----------------------------------------------------------------------------

    /**
     * The header cell's main content: the sort button, or a replacement for it. One add-on owns it;
     * without an owner the header text is rendered.
     */
    readonly headerLabel?: (column: ResolvedColumn<TRow, ColumnValue>, grid: GridContext<TRow>) => ReactNode;
    readonly headerBefore?: (column: ResolvedColumn<TRow, ColumnValue>, grid: GridContext<TRow>) => ReactNode;
    /** Beside the label, never inside it: a filter button, a resize handle. */
    readonly headerAfter?: (column: ResolvedColumn<TRow, ColumnValue>, grid: GridContext<TRow>) => ReactNode;
    readonly headerAttributes?: (
        column: ResolvedColumn<TRow, ColumnValue>,
        grid: GridContext<TRow>,
    ) => ContributedAttributes<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>;

    // --- The body ------------------------------------------------------------------------------

    readonly columns?: readonly ExtraColumn<TRow>[];
    /**
     * Attributes on the cells of extra columns, whichever add-on contributed them: pinning the
     * selection column, or making it reachable by a keyboard navigation add-on. `columnId` is the
     * extra column's `id`.
     */
    readonly extraCellAttributes?: (
        row: GridRow<TRow>,
        columnId: string,
        grid: GridContext<TRow>,
    ) => ContributedAttributes<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>;
    /** The same for the extra columns' header cells. */
    readonly extraHeaderAttributes?: (
        columnId: string,
        grid: GridContext<TRow>,
    ) => ContributedAttributes<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>;
    /** Replaces the whole `<tbody>`: a windowed body. One add-on owns it. */
    readonly body?: SlotRender<TRow>;
    readonly rowAttributes?: (row: GridRow<TRow>, grid: GridContext<TRow>) => ContributedAttributes<HTMLTableRowElement>;
    /** Renders a row of its own kind (a group header) instead of the default row. First add-on wins. */
    readonly renderRow?: (row: GridRow<TRow>, grid: GridContext<TRow>) => ReactNode | undefined;
    /**
     * Rows rendered *after* this row, inside the same `<tbody>`: a detail panel, a subtotal, a note.
     *
     *     rowAfter: (row, grid) =>
     *         open.has(row.id) ? (
     *             <tr role="presentation">
     *                 <td role="presentation" colSpan={columnCountOf(grid)}>{detail(row)}</td>
     *             </tr>
     *         ) : undefined,
     *
     * Returns one or more `<tr>` elements, because that is what a `<tbody>` may hold. Unlike
     * `renderRow` this is not owned: every add-on contributing one is asked, in add-on order, and
     * every non-empty result renders. It is asked for a row another add-on rendered through
     * `renderRow` too, so a custom row can still carry a panel.
     *
     * **An extra row is not a grid row unless you make it one.** `aria-rowcount` and every row's
     * `aria-rowindex` count the whole result set rather than what is mounted, so giving an extra row
     * `role="row"` means claiming a position in that set — a number the grid cannot know for rows it
     * has not fetched. Render it `role="presentation"`, with a labelled `role="region"` inside for
     * whatever a reader needs to reach.
     */
    readonly rowAfter?: (row: GridRow<TRow>, grid: GridContext<TRow>) => ReactNode | undefined;
    readonly cellAttributes?: (
        row: GridRow<TRow>,
        column: ResolvedColumn<TRow, ColumnValue>,
        grid: GridContext<TRow>,
    ) => ContributedAttributes<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>;
    /** Replaces the loading, empty and error rows. The last add-on to provide one wins. */
    readonly status?: StatusContribution<TRow>;

    // --- Speech and copy -----------------------------------------------------------------------

    readonly announce?: readonly AnnouncementContributor<TRow>[];
    /** Read by `useAddonMessages(name)`. */
    readonly messages?: AddonMessages;
}

export interface ResolvedAddon<TRow> {
    readonly name: string;
    readonly contribution: AddonContribution<TRow>;
}

/** The add-ons of one grid after ordering, suppression and ownership checks. */
export interface ResolvedContributions<TRow> {
    /** Every add-on name, in order. */
    readonly names: readonly string[];
    /** Add-ons whose rendering is not suppressed, in order. Slots are read from these. */
    readonly active: readonly ResolvedAddon<TRow>[];
    /** Messages of every add-on, suppressed or not, by add-on name. */
    readonly messages: ReadonlyMap<string, AddonMessages>;
    readonly headerLabel: ResolvedAddon<TRow> | null;
    readonly body: ResolvedAddon<TRow> | null;
    readonly navigation: 'pages' | 'window';
}
