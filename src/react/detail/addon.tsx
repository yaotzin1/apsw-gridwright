import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GridwrightError } from '../../core/errors';
import type { GridRow, RowId } from '../../core/types';
import { addonMessages, useAddonMessages } from '../addons/context';
import { rendersSomething } from '../addons/resolve';
import type { GridAddon, GridContext } from '../addons/types';
import { useGridwrightContext } from '../context';
import { rowDataOf } from '../tree/rowData';
import { TREE_ADDON } from '../tree/messages';
import { VIRTUAL_ADDON } from '../virtual/addon';
import { firstColumnText, RowDetailProvider } from './context';
import { DetailToggleButton } from './GridDetailToggle';
import { GridRowDetail } from './GridRowDetail';
import { ROW_DETAIL_ADDON, rowDetailMessages } from './messages';
import type { RowDetailController, RowDetailOptions } from './types';

/**
 * Expandable rows: a panel under a row holding whatever that row needs — a nested grid, a form, the
 * fields that did not earn a column, a chart, a label.
 *
 * The panel is a row of the table that is deliberately not a row of the grid, so opening one changes
 * nothing about `aria-rowcount` or any row's `aria-rowindex`. See `GridRowDetail` for why.
 *
 * Expansion is not engine state: it changes no query facet, produces no row, and nothing the
 * pipeline computes depends on it. It lives here, keyed on `GridRow.id`, and `initialExpanded` with
 * `onExpandedChange` is the seam for persisting it.
 *
 * Placed after `treeData()`, so `render` receives the consumer's row rather than a tree node.
 */
export function rowDetail<TRow>(options: RowDetailOptions<TRow>): GridAddon<TRow> {
    return {
        name: ROW_DETAIL_ADDON,
        after: [TREE_ADDON],
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useRowDetailSetup({ addons }) {
            return useRowDetailAddon(options, addons);
        },
    };
}

/**
 * The row as `GridRow<TRow>` actually promises it: with the consumer's row inside.
 *
 * Under `treeData()` the engine's rows are `TreeNode<TRow>`, so a callback typed over
 * `GridRow<TRow>` would be handed a node and `row.data.kind` would quietly be `undefined` --
 * the type says one thing and the value is another. Unwrapping here makes the declared type true
 * while `id`, `index` and `selected` keep meaning what they meant.
 *
 * Allocates nothing for a grid that is not a tree: `rowDataOf` returns the same object.
 */
function ownRow<TRow>(row: GridRow<TRow>): GridRow<TRow> {
    const data = rowDataOf(row);
    return data === row.data ? row : { ...row, data };
}

function useRowDetailAddon<TRow>(options: RowDetailOptions<TRow>, addons: readonly string[]) {
    // Before any hook, and unconditionally, so this component either always throws or never does.
    //
    // `useVirtualRows` is fixed-height arithmetic with no per-row measurement: it maps a scroll
    // offset to a row index by multiplication. A panel of the consumer's own height breaks that
    // mapping for every row below it, silently, and the grid scrolls to the wrong place while every
    // test still passes. A named error beats a grid that is subtly wrong.
    if (addons.includes(VIRTUAL_ADDON)) {
        throw new GridwrightError(
            `[gridwright] "${ROW_DETAIL_ADDON}" cannot be listed with "${VIRTUAL_ADDON}": windowing places rows by a fixed row height, and a detail panel is as tall as its content. Use one or the other.`,
            { retryable: false },
        );
    }

    const latest = useRef(options);
    latest.current = options;

    const [expanded, setExpanded] = useState<ReadonlySet<RowId>>(() => new Set(options.initialExpanded ?? []));

    // Read by the controller, so its identity can stay stable for the life of the grid: a consumer
    // handed it through `controllerRef` -- which fires once -- must not be holding the set as it was
    // at mount. Rendering still reacts, because the state above lives in the grid's own hook and
    // every toggle below it re-renders when it changes.
    const expandedRef = useRef(expanded);
    expandedRef.current = expanded;

    // The grid as of the last render, for the controller: `hasDetail` and the row label are asked
    // about a row, and `setup` is handed the options rather than the state. `provide` runs once per
    // render of the grid and is where this is filled in.
    const gridRef = useRef<GridContext<TRow> | null>(null);

    const rowOf = useCallback((rowId: RowId): GridRow<TRow> | undefined => {
        return gridRef.current?.state.rows.find((row) => row.id === rowId);
    }, []);

    const hasDetailOf = useCallback(
        (rowId: RowId): boolean => {
            const grid = gridRef.current;
            const row = rowOf(rowId);
            // A row this page does not hold gets no opinion rather than a guessed one: an expansion
            // restored from storage must survive until the row it names actually arrives.
            if (!grid || !row) return true;
            return latest.current.hasDetail?.(ownRow(row), grid) ?? true;
        },
        [rowOf],
    );

    const labelOf = useCallback(
        (rowId: RowId): string => {
            const grid = gridRef.current;
            if (!grid) return String(rowId);
            const row = rowOf(rowId);
            const custom = latest.current.rowLabel;
            if (custom && row) return custom(rowDataOf(row), grid);
            return firstColumnText(grid, rowId);
        },
        [rowOf],
    );

    const controller = useMemo<RowDetailController>(() => {
        // `allows` is the one rule, asked by the built-in toggle and by anything a consumer builds,
        // so a control cannot offer a change the add-on would refuse.
        const allows = (rowId: RowId, next: boolean): boolean => {
            if (!hasDetailOf(rowId)) return false;
            return latest.current.canToggle?.(rowId, next) ?? true;
        };

        const say = (rowId: RowId, next: boolean): void => {
            const grid = gridRef.current;
            if (!grid) return;
            // Through `announce` rather than an announcement contributor: a contributor is handed
            // `GridState`, and expansion is deliberately not in it, so one could not see this change.
            const t = addonMessages(grid.translator, grid.contributions as never, ROW_DETAIL_ADDON, rowDetailMessages);
            grid.announce(t(next ? 'expanded' : 'collapsed', { row: labelOf(rowId) }));
        };

        const commit = (rowId: RowId, next: boolean): void => {
            if (!allows(rowId, next)) return;
            setExpanded((current) => {
                if (current.has(rowId) === next) return current;
                // `single` is applied here rather than in the toggle, so a consumer calling
                // `expand` through the controller gets the same one-at-a-time behaviour.
                const updated = next && latest.current.single ? new Set<RowId>() : new Set(current);
                if (next) updated.add(rowId);
                else updated.delete(rowId);
                return updated;
            });
            say(rowId, next);
        };

        return {
            get expanded() {
                return [...expandedRef.current];
            },
            isExpanded: (rowId) => expandedRef.current.has(rowId),
            allows,
            expand: (rowId) => commit(rowId, true),
            collapse: (rowId) => commit(rowId, false),
            toggle: (rowId) => commit(rowId, !expandedRef.current.has(rowId)),
            expandAll: () => {
                const grid = gridRef.current;
                if (!grid) return;
                // The rows the grid is holding, and no claim about any other page. There is no
                // "everything is expanded" flag for the same reason there is no invented total.
                const ids = grid.state.rows.filter((row) => allows(row.id, true)).map((row) => row.id);
                if (ids.length === 0) return;
                setExpanded((current) => (latest.current.single ? new Set(ids.slice(-1)) : new Set([...current, ...ids])));
            },
            collapseAll: () => setExpanded((current) => (current.size === 0 ? current : new Set())),
        };
        // Stable: every dependency is a `useCallback` over refs, so `controllerRef` fires once for
        // the life of the grid rather than on every expansion.
    }, [hasDetailOf, labelOf]);

    // Compared by the value rather than counted, because Strict Mode runs a mount effect twice and a
    // "first run" flag would report the initial set as a change on the second.
    const notified = useRef(expanded);
    useEffect(() => {
        if (notified.current === expanded) return;
        notified.current = expanded;
        latest.current.onExpandedChange?.([...expanded]);
    }, [expanded]);

    const controllerRef = options.controllerRef;
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef(controller);
        return () => controllerRef(null);
        // The callback identity is what should re-run this, not every expansion.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controllerRef]);

    const collapseAll = useCallback(() => setExpanded((current) => (current.size === 0 ? current : new Set())), []);

    const placement = options.toggle ?? 'start';
    const panelClassName = options.className;

    return {
        messages: rowDetailMessages,

        provide: (children: ReactNode, grid: GridContext<TRow>) => {
            gridRef.current = grid;
            return (
                <RowDetailProvider controller={controller} rowLabel={labelOf}>
                    {options.persistAcrossPages === false && <ClearOnQueryChange onChange={collapseAll} />}
                    {children}
                </RowDetailProvider>
            );
        },

        ...(placement === 'none'
            ? {}
            : {
                  columns: [
                      {
                          id: ROW_DETAIL_ADDON,
                          placement,
                          className: 'gw-cell--detail',
                          header: () => <DetailColumnHeader />,
                          cell: (row: GridRow<TRow>, grid: GridContext<TRow>) =>
                              (latest.current.hasDetail?.(ownRow(row), grid) ?? true) ? <DetailToggleButton rowId={row.id} columnId={ROW_DETAIL_ADDON} /> : null,
                      },
                  ],
              }),

        rowAfter: (row: GridRow<TRow>, grid: GridContext<TRow>) => {
            if (!expanded.has(row.id)) return undefined;

            const own = ownRow(row);
            if (!(latest.current.hasDetail?.(own, grid) ?? true)) return undefined;

            const content = latest.current.render({
                row: own,
                data: own.data,
                grid,
                close: () => controller.collapse(row.id),
            });

            // A row whose content turned out to be nothing renders no row at all. An empty
            // full-width strip under a row reads as a bug in the consumer's code.
            if (!rendersSomething(content)) return undefined;

            return (
                <GridRowDetail rowId={row.id} {...(panelClassName ? { className: panelClassName } : {})}>
                    {content}
                </GridRowDetail>
            );
        },
    };
}

/** The toggle column's header: named for assistive technology, blank to the eye. */
function DetailColumnHeader() {
    const t = useAddonMessages(ROW_DETAIL_ADDON, rowDetailMessages);
    return <span className="gw-visually-hidden">{t('column')}</span>;
}

/**
 * Drops every expansion when the query changes, for `persistAcrossPages: false`.
 *
 * A component rather than an effect in `setup`, because `setup` is handed the grid's options and not
 * its state, and the query is state.
 */
function ClearOnQueryChange({ onChange }: { readonly onChange: () => void }) {
    const { state } = useGridwrightContext();
    const key = JSON.stringify(state.query);
    const previous = useRef(key);

    useEffect(() => {
        if (previous.current === key) return;
        previous.current = key;
        onChange();
    }, [key, onChange]);

    return null;
}
