import type { ColumnValue, GridApi, GridState, ResolvedColumn } from '../core/types';
import type { AddonMessages } from '../i18n/messages';
import type { TranslateValues } from '../i18n/translator';
import type { AnnouncementContributor } from './behaviour/announcement';
import type { Attrs, ViewNode } from './node';

/**
 * The neutral add-on contract: one feature of the table, written once and drawn by any adapter.
 *
 * It is a separate contract from the React `GridAddon`, not an alias of it (spec C-4): a React add-on
 * is typed over React's events, elements and hooks, and a neutral one over plain data. The React
 * renderer accepts both in one grid (C-7) by adapting a `ViewAddon` into a `GridAddon`.
 *
 * The contribution grows with the migration. It holds the slots the migrated add-ons need, and each
 * further slot arrives with the add-on that first needs it, as an additive minor. A slot that does
 * not exist here yet is one the React contract still owns.
 */

/** A translate function scoped to one add-on's strings. */
export type ViewTranslate = (key: string, values?: TranslateValues) => string;

/**
 * What a neutral add-on may read of the grid while it is drawn.
 *
 * Plain values and functions, so an adapter builds one from whatever it holds: React from its context,
 * another framework from its own.
 */
export interface ViewGrid<TRow> {
    readonly api: GridApi<TRow>;
    readonly state: GridState<TRow>;
    /** One add-on's strings, resolved against the grid's translator, its messages and the locale pack. */
    readonly messages: (addon: string, fallback?: AddonMessages) => ViewTranslate;
}

/**
 * What a slot that draws sees: the grid, plus what only exists while something is being drawn.
 * Attribute functions get the plain `ViewGrid`, because they run outside a render in some adapters.
 */
export interface ViewRenderGrid<TRow> extends ViewGrid<TRow> {
    /**
     * What a header cell shows for a column: the header text, or what the column's own renderer draws.
     * A renderer written in the adapter's framework comes back as a `component` node, which is the one
     * place a built-in add-on meets native content it did not write.
     */
    readonly headerContent: (column: ResolvedColumn<TRow, ColumnValue>) => ViewNode;
    /**
     * `-1` while keyboard navigation moves focus to the header cell, so a control inside it leaves the
     * Tab order; `undefined` otherwise. Navigation owns the cursor, and the adapter reads it for the
     * add-ons that draw controls.
     */
    readonly headerControlTabIndex: -1 | undefined;
}

export interface ViewAddonSetupContext {
    /** Every add-on name in this grid, in order. */
    readonly addons: readonly string[];
}

/** Attributes a neutral add-on puts on an element it does not own, through the same allowlist. */
export type ViewAttributes = Attrs;

/** Everything a neutral add-on can contribute, over the node type its adapter draws. Every field is optional. */
export interface ViewAddonContribution<TRow, TNode = ViewNode> {
    /** Add-ons whose rendering this one replaces. Their configure, plugins and messages still apply. */
    readonly suppresses?: readonly string[];
    /** `window` when the reader moves by scrolling rather than by pages. Default `pages`. */
    readonly navigation?: 'pages' | 'window';
    /** The header cell's main content: the sort button, or a replacement for it. One add-on owns it. */
    readonly headerLabel?: (column: ResolvedColumn<TRow, ColumnValue>, grid: ViewRenderGrid<TRow>) => TNode;
    /** Attributes on a header cell, after the shell's own, through the allowlist. */
    readonly headerAttributes?: (column: ResolvedColumn<TRow, ColumnValue>, grid: ViewGrid<TRow>) => ViewAttributes;
    /** Sentences for the grid's single live region. */
    readonly announce?: readonly AnnouncementContributor<TRow>[];
    /** Read through `ViewGrid.messages(name)`. */
    readonly messages?: AddonMessages;
}

/** Brand carried by every neutral add-on, so an adapter can tell one from a React add-on (C-7). */
export const VIEW_ADDON: unique symbol = Symbol.for('apsw-gridwright.view-addon');

export interface ViewAddon<TRow = unknown, TNode = ViewNode> {
    readonly [VIEW_ADDON]?: true;
    /** Unique within one grid, namespaced like a plugin: `gridwright:sorting`, `acme:heatmap`. */
    readonly name: string;
    /** Add-ons that must be present in the same grid. */
    readonly requires?: readonly string[];
    /** Add-ons this one is placed after when both are listed. */
    readonly after?: readonly string[];
    /** Add-ons this one is placed before when both are listed. */
    readonly before?: readonly string[];
    /**
     * Called by the adapter whenever it needs the contribution (the React adapter: on every render, in
     * add-on order), so it must be a pure function of what the add-on closed over. It holds no hooks
     * and no framework state.
     *
     * Per-grid state, which `sorting()` has none of, is not provided yet: the first add-on that needs
     * it (selection) decides how the adapter hands one `Store` per grid to `setup` (spec C-5).
     */
    readonly setup: (context: ViewAddonSetupContext) => ViewAddonContribution<TRow, TNode> | void;
}

/**
 * Marks an add-on as neutral. It changes nothing about the add-on; the brand is how an adapter that
 * accepts both kinds tells them apart without guessing from shape.
 */
export function defineAddon<TRow = unknown, TNode = ViewNode>(addon: ViewAddon<TRow, TNode>): ViewAddon<TRow, TNode> {
    return { ...addon, [VIEW_ADDON]: true };
}

export const isViewAddon = (value: unknown): value is ViewAddon<never, never> =>
    typeof value === 'object' && value !== null && (value as { [VIEW_ADDON]?: unknown })[VIEW_ADDON] === true;
