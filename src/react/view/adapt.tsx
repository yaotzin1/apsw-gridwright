import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ColumnValue, GridRow, ResolvedColumn } from '../../core/types';
import { isViewAddon } from '../../view/addon';
import type { ViewAddon, ViewGrid, ViewRenderGrid, ViewTranslate } from '../../view/addon';
import { component, sanitizeAttrs, text } from '../../view/node';
import { createStateScope } from '../../view/store';
import type { Store } from '../../view/store';
import type { ViewFocus, ViewNode } from '../../view/node';
import { useGridwrightContext } from '../context';
import type { GridContext, GridAddon } from '../addons/types';
import { cellTabIndex, headerTabIndex } from '../navigation/cell-control';
import { useOptionalCellNavigation } from '../navigation/context';
import { headerContentOf } from '../parts/GridHeader';
import { handlersOf, renderNode } from './render-node';
import { toViewEvent } from './to-view-event';
import type { CellNavigationController } from '../navigation/types';

/** The id under which the adapter hands a column's own React content to a neutral add-on. */
const NATIVE_CONTENT = 'gridwright:native-content';

/**
 * A neutral add-on's view of the grid, from the React grid context.
 *
 * Built once per grid context and looked up after that: this runs for every row and every cell, and the context
 * value is a new object whenever the state changes, so a cached view is never stale. Its translators are cached the
 * same way, because an add-on asks for its own on every cell it draws.
 */
const viewGrids = new WeakMap<object, unknown>();
function viewGridOf<TRow>(grid: GridContext<TRow>): ViewGrid<TRow> {
    const cached = viewGrids.get(grid);
    if (cached) return cached as ViewGrid<TRow>;
    const translators = new Map<string, { readonly fallback: unknown; readonly translate: ViewTranslate }>();
    const view: ViewGrid<TRow> = {
        api: grid.api,
        state: grid.state,
        classNames: grid.classNames,
        messages: (addon, fallback) => {
            const known = translators.get(addon);
            if (known && known.fallback === fallback) return known.translate;
            const own = grid.contributions.messages.get(addon) ?? fallback;
            const translate: ViewTranslate = (key, values) => grid.translator.translateAddon(addon, key, values, own);
            translators.set(addon, { fallback, translate });
            return translate;
        },
    };
    viewGrids.set(grid, view);
    return view;
}

/** Empty header text, for the slots that have no column to ask about. One function, so the render grid below can be shared. */
const NO_HEADER_CONTENT = (): ViewNode => text('');

/**
 * What a slot that draws sees, from the React grid context and the navigation cursor. `headerContent` is
 * the column's own React content when there is one; the slots that have no column to ask about get empty text.
 */
function renderGridOf<TRow>(
    grid: GridContext<TRow>,
    navigation: CellNavigationController | null,
    headerContent: ViewRenderGrid<TRow>['headerContent'],
): ViewRenderGrid<TRow> {
    return {
        ...viewGridOf(grid),
        headerContent,
        headerControlTabIndex: headerTabIndex(navigation),
        cellControlTabIndex: (columnId) => cellTabIndex(navigation, columnId),
    };
}

/** The render grid of the slots with no column, built once per grid context and cursor: one per extra-column cell would be one per row. */
const slotGrids = new WeakMap<object, { readonly navigation: CellNavigationController | null; readonly view: unknown }>();
function slotGridOf<TRow>(grid: GridContext<TRow>, navigation: CellNavigationController | null): ViewRenderGrid<TRow> {
    const cached = slotGrids.get(grid);
    if (cached && cached.navigation === navigation) return cached.view as ViewRenderGrid<TRow>;
    const view = renderGridOf(grid, navigation, NO_HEADER_CONTENT);
    slotGrids.set(grid, { navigation, view });
    return view;
}

/**
 * Draws what a neutral add-on's header label describes. A component, not a call, so the hooks it needs
 * (the grid context and the navigation cursor) run where React expects them.
 */
function NeutralHeaderLabel<TRow>({
    label,
    column,
}: {
    readonly label: (column: ResolvedColumn<TRow, ColumnValue>, grid: ViewRenderGrid<TRow>) => ViewNode;
    readonly column: ResolvedColumn<TRow, ColumnValue>;
}): ReactNode {
    const grid = useGridwrightContext<TRow>();
    const navigation = useOptionalCellNavigation();

    const content = headerContentOf(column, grid);
    const native: ReactNode = content;
    const renderGrid = renderGridOf(grid, navigation, () =>
        typeof native === 'string' || typeof native === 'number'
            ? text(String(native))
            : native === null || native === undefined || typeof native === 'boolean'
              ? text('')
              : component(NATIVE_CONTENT),
    );

    return renderNode(label(column, renderGrid), { components: { [NATIVE_CONTENT]: () => native } });
}

/**
 * Draws a node a neutral add-on's extra column, toolbar status, below-table content or similar slot describes. A
 * component for the same reason as the header label: the grid context and the navigation cursor are hooks.
 *
 * With `settled`, it also gives the add-on its moment after a commit in which the rows or whether another page exists
 * changed, and moves focus if the add-on asks. The element is found by the node `key` the add-on gave it, among the
 * elements this slot drew, so an add-on can focus what it drew and nothing else, in this grid and no other.
 */
function NeutralSlot<TRow>({
    draw,
    settled,
}: {
    readonly draw: (grid: ViewRenderGrid<TRow>) => ViewNode | null;
    readonly settled?: (grid: ViewGrid<TRow>) => ViewFocus | void;
}): ReactNode {
    const grid = useGridwrightContext<TRow>();
    const navigation = useOptionalCellNavigation();
    const drawn = useRef(new Map<string, Element>());
    const node = draw(slotGridOf(grid, navigation));

    const { version, hasNextPage, hasPreviousPage } = grid.state;
    useLayoutEffect(() => {
        if (!settled) return;
        const request = settled(viewGridOf(grid));
        if (request) (drawn.current.get(request.key) as HTMLElement | undefined)?.focus?.();
        // `grid` and `settled` change identity every render and must not be what runs this: the keys below are the
        // moments the add-on is told about.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version, hasNextPage, hasPreviousPage]);

    if (node === null) return null;
    return renderNode(
        node,
        settled
            ? {
                  onKeyedElement: (key, element) => {
                      if (element) drawn.current.set(key, element);
                      else drawn.current.delete(key);
                  },
              }
            : {},
    );
}

interface StateHolder {
    readonly state: <T>(key: string, initial: T) => Store<T>;
    readonly subscribe: (listener: () => void) => () => void;
    readonly version: () => number;
}

/** The stores of one neutral add-on in one grid, and a counter that moves when any of them does. */
function createHolder(): StateHolder {
    const listeners = new Set<() => void>();
    let version = 0;
    return {
        state: createStateScope(() => {
            version += 1;
            for (const listener of [...listeners]) listener();
        }),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        version: () => version,
    };
}

/**
 * Turns a neutral add-on into the React add-on the grid runs (spec C-7). The two kinds are listed side
 * by side and ordered, suppressed and resolved by the same code; only the slots a neutral add-on
 * fills are drawn by this renderer.
 */
export function adaptViewAddon<TRow>(addon: ViewAddon<TRow>): GridAddon<TRow> {
    return {
        name: addon.name,
        ...(addon.requires ? { requires: addon.requires } : {}),
        ...(addon.after ? { after: addon.after } : {}),
        ...(addon.before ? { before: addon.before } : {}),
        setup: function useViewAddon(context) {
            // One holder per add-on per grid. Two hooks, always, whatever the add-on asks for, so the order
            // of hooks never depends on how many stores it keeps.
            const holder = useRef<StateHolder | null>(null);
            holder.current ??= createHolder();
            const owned = holder.current;
            useSyncExternalStore(owned.subscribe, owned.version, owned.version);
            const contribution = addon.setup({ addons: context.addons, selectionMode: context.options.selectionMode ?? 'none', state: owned.state }) ?? {};
            const label = contribution.headerLabel;
            const attributes = contribution.headerAttributes;
            const { columns, tableAttributes, rowAttributes, rowHandlers, tableKeyDown, toolbarStatus, belowTable, settled } = contribution;
            return {
                ...(contribution.suppresses ? { suppresses: contribution.suppresses } : {}),
                ...(contribution.navigation ? { navigation: contribution.navigation } : {}),
                ...(contribution.messages ? { messages: contribution.messages } : {}),
                ...(contribution.announce ? { announce: contribution.announce } : {}),
                ...(label ? { headerLabel: (column) => <NeutralHeaderLabel<TRow> label={label} column={column} /> } : {}),
                ...(attributes
                    ? // The allowlist runs again in mergeAttributes, so what is typed loosely here still cannot reach the DOM.
                      { headerAttributes: (column, grid) => sanitizeAttrs('th', attributes(column, viewGridOf(grid))) as never }
                    : {}),
                ...(columns
                    ? {
                          columns: columns.map((column) => ({
                              id: column.id,
                              placement: column.placement,
                              ...(column.className ? { className: column.className } : {}),
                              header: () => <NeutralSlot<TRow> draw={(renderGrid) => column.header(renderGrid)} />,
                              cell: (row: GridRow<TRow>) => <NeutralSlot<TRow> draw={(renderGrid) => column.cell(row, renderGrid)} />,
                          })),
                      }
                    : {}),
                ...(tableAttributes ? { tableAttributes: (grid) => sanitizeAttrs('table', tableAttributes(viewGridOf(grid))) as never } : {}),
                ...(rowAttributes || rowHandlers
                    ? {
                          rowAttributes: (row, grid) => {
                              const view = viewGridOf(grid);
                              // Runs once per rendered row: no copy where one add-on slot is all there is to return.
                              // Attributes are checked here and handlers are wrapped here; neither is the add-on's own object any more.
                              if (!rowHandlers) return sanitizeAttrs('tr', rowAttributes!(row, view)) as never;
                              if (!rowAttributes) return handlersOf(rowHandlers(row, view)) as never;
                              return { ...sanitizeAttrs('tr', rowAttributes(row, view)), ...handlersOf(rowHandlers(row, view)) } as never;
                          },
                      }
                    : {}),
                ...(tableKeyDown ? { tableKeyDown: (event, grid) => tableKeyDown(toViewEvent(event), viewGridOf(grid)) } : {}),
                ...(toolbarStatus ? { toolbarStatus: () => <NeutralSlot<TRow> draw={(renderGrid) => toolbarStatus(renderGrid)} /> } : {}),
                ...(belowTable
                    ? { belowTable: () => <NeutralSlot<TRow> draw={(renderGrid) => belowTable(renderGrid)} {...(settled ? { settled } : {})} /> }
                    : {}),
            };
        },
    };
}

/** Accepts either kind of add-on where the grid lists them. */
export function toGridAddon<TRow>(entry: GridAddon<TRow> | ViewAddon<TRow>): GridAddon<TRow> {
    return isViewAddon(entry) ? adaptViewAddon(entry as ViewAddon<TRow>) : (entry as GridAddon<TRow>);
}
