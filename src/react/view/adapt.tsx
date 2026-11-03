import { useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ColumnValue, GridRow, ResolvedColumn } from '../../core/types';
import { isViewAddon } from '../../view/addon';
import type { ViewAddon, ViewGrid, ViewRenderGrid } from '../../view/addon';
import { component, text } from '../../view/node';
import { createStateScope } from '../../view/store';
import type { Store } from '../../view/store';
import type { ViewNode } from '../../view/node';
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

/** A neutral add-on's view of the grid, from the React grid context. */
function viewGridOf<TRow>(grid: GridContext<TRow>): ViewGrid<TRow> {
    return {
        api: grid.api,
        state: grid.state,
        classNames: grid.classNames,
        messages: (addon, fallback) => {
            const own = grid.contributions.messages.get(addon) ?? fallback;
            return (key, values) => grid.translator.translateAddon(addon, key, values, own);
        },
    };
}

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
 * Draws a node a neutral add-on's extra column, toolbar status or similar slot describes. A component for
 * the same reason as the header label: the grid context and the navigation cursor are hooks.
 */
function NeutralSlot<TRow>({ draw }: { readonly draw: (grid: ViewRenderGrid<TRow>) => ViewNode | null }): ReactNode {
    const grid = useGridwrightContext<TRow>();
    const navigation = useOptionalCellNavigation();
    const node = draw(renderGridOf(grid, navigation, () => text('')));
    return node === null ? null : renderNode(node);
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
            const { columns, tableAttributes, rowAttributes, rowHandlers, tableKeyDown, toolbarStatus } = contribution;
            return {
                ...(contribution.suppresses ? { suppresses: contribution.suppresses } : {}),
                ...(contribution.navigation ? { navigation: contribution.navigation } : {}),
                ...(contribution.messages ? { messages: contribution.messages } : {}),
                ...(contribution.announce ? { announce: contribution.announce } : {}),
                ...(label ? { headerLabel: (column) => <NeutralHeaderLabel<TRow> label={label} column={column} /> } : {}),
                ...(attributes
                    ? // The allowlist runs again in mergeAttributes, so what is typed loosely here still cannot reach the DOM.
                      { headerAttributes: (column, grid) => attributes(column, viewGridOf(grid)) as never }
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
                ...(tableAttributes ? { tableAttributes: (grid) => tableAttributes(viewGridOf(grid)) as never } : {}),
                ...(rowAttributes || rowHandlers
                    ? {
                          rowAttributes: (row, grid) => {
                              const view = viewGridOf(grid);
                              return {
                                  ...(rowAttributes ? rowAttributes(row, view) : {}),
                                  ...(rowHandlers ? handlersOf(rowHandlers(row, view)) : {}),
                              } as never;
                          },
                      }
                    : {}),
                ...(tableKeyDown ? { tableKeyDown: (event, grid) => tableKeyDown(toViewEvent(event), viewGridOf(grid)) } : {}),
                ...(toolbarStatus ? { toolbarStatus: () => <NeutralSlot<TRow> draw={(renderGrid) => toolbarStatus(renderGrid)} /> } : {}),
            };
        },
    };
}

/** Accepts either kind of add-on where the grid lists them. */
export function toGridAddon<TRow>(entry: GridAddon<TRow> | ViewAddon<TRow>): GridAddon<TRow> {
    return isViewAddon(entry) ? adaptViewAddon(entry as ViewAddon<TRow>) : (entry as GridAddon<TRow>);
}
