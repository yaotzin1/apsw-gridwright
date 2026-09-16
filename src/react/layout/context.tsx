import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColumnValue } from '../../core/types';
import type { GridwrightColumn } from '../types';
import { clampWidth, entryOf, moveInOrder, normalizeLayout, orderedColumns, pixelWidth, withEntry } from './layout';
import type { ColumnLayoutController, ColumnLayoutOptions, ColumnLayoutState, ColumnPin, WidthBounds } from './types';

/** A column that declares no pixel width of its own. */
export const DEFAULT_WIDTH = 150;
/** The floor under every column, whatever its own `minWidth` says. */
export const DEFAULT_MIN_WIDTH = 50;
/** Another add-on's extra column: a checkbox needs room for a checkbox and no more. */
export const DEFAULT_EXTRA_WIDTH = 48;

const ColumnLayoutContext = createContext<ColumnLayoutController | null>(null);

export interface ColumnLayoutProviderProps {
    readonly controller: ColumnLayoutController;
    readonly children: ReactNode;
}

export function ColumnLayoutProvider({ controller, children }: ColumnLayoutProviderProps) {
    return <ColumnLayoutContext.Provider value={controller}>{children}</ColumnLayoutContext.Provider>;
}

/**
 * The layout and everything that changes it, from inside a grid that lists `columnLayout()`.
 *
 *     const layout = useColumnLayout();
 *     <button onClick={() => layout.setPinned('name', layout.pinOf('name') ? null : 'left')}>Pin</button>
 *
 * Throws in a grid that does not list the add-on, because a control that silently does nothing is
 * harder to find than one that says why. Use `useOptionalColumnLayout` where the add-on is genuinely
 * optional.
 */
export function useColumnLayout(): ColumnLayoutController {
    const controller = useContext(ColumnLayoutContext);
    if (!controller) {
        throw new Error('[gridwright] useColumnLayout needs the columnLayout() add-on. Add it to the grid’s `addons`.');
    }
    return controller;
}

/** The same, null where the grid does not list `columnLayout()`. */
export function useOptionalColumnLayout(): ColumnLayoutController | null {
    return useContext(ColumnLayoutContext);
}

/**
 * The layout state and the controller over it.
 *
 * Called from the add-on's `setup`, so it runs on every render of the grid and may call hooks. The
 * controller itself is rebuilt each render rather than memoised: it closes over the column array,
 * which is written inline by nearly every consumer and so is a new array every render anyway, and a
 * memo keyed on something that always changes is a memo that only costs.
 */
export function useColumnLayoutController<TRow>(
    options: ColumnLayoutOptions,
    columns: readonly GridwrightColumn<TRow, ColumnValue>[],
): ColumnLayoutController {
    const [layout, setLayout] = useState<ColumnLayoutState>(() => normalizeLayout(options.initial));

    // The layout this grid mounted with, by identity. `onChange` fires for every layout that is not
    // this one, which is the only test that survives Strict Mode: a flag set on the first effect run
    // is cleared and re-run by the double invocation, and the second run would report the initial
    // layout as a change and overwrite whatever the consumer had saved.
    const mounted = useRef(layout);
    const onChange = useRef(options.onChange);
    onChange.current = options.onChange;

    useEffect(() => {
        if (layout === mounted.current) return;
        onChange.current?.(layout);
    }, [layout]);

    const definitions = new Map<string, GridwrightColumn<TRow, ColumnValue>>();
    for (const column of columns) definitions.set(column.id, column);

    const resizingAllowed = options.resizable !== false;
    const reorderingAllowed = options.reorderable !== false;
    const defaultWidth = options.defaultWidth ?? DEFAULT_WIDTH;
    const extraWidth = options.extraColumnWidth ?? DEFAULT_EXTRA_WIDTH;
    const floor = options.minWidth ?? DEFAULT_MIN_WIDTH;

    const boundsOf = (columnId: string): WidthBounds => {
        const column = definitions.get(columnId);
        // An extra column belongs to another add-on and has no definition to read a floor from, so
        // it is only kept off zero.
        if (!column) return { min: 1, max: Number.POSITIVE_INFINITY };
        const min = Math.max(floor, column.minWidth ?? 0);
        const max = column.layout?.maxWidth ?? Number.POSITIVE_INFINITY;
        // A `maxWidth` under the floor would make the clamp empty and the column unresizable in a
        // way nobody asked for. The floor wins, and the column simply cannot grow.
        return { min, max: Math.max(min, max) };
    };

    const widthOf = (columnId: string): number => {
        const column = definitions.get(columnId);
        const declared = column ? pixelWidth(column.width) : null;
        const fallback = column ? defaultWidth : extraWidth;
        return clampWidth(entryOf(layout.widths, columnId) ?? declared ?? fallback, boundsOf(columnId));
    };

    const pinOf = (columnId: string): ColumnPin | null => {
        const stated = entryOf(layout.pinned, columnId);
        // `null` is the reader having unpinned it, which outranks what the column asked for;
        // `undefined` is nobody having said anything, which leaves the column to speak for itself.
        if (stated !== undefined) return stated;
        return definitions.get(columnId)?.layout?.pinned ?? null;
    };

    const isHidden = (columnId: string): boolean =>
        entryOf(layout.hidden, columnId) ?? definitions.get(columnId)?.hidden === true;

    const visibleCount = columns.reduce((count, column) => count + (isHidden(column.id) ? 0 : 1), 0);

    const canHide = (columnId: string): boolean => {
        if (definitions.get(columnId)?.layout?.hideable === false) return false;
        // The last visible column can be shown, never hidden: a grid of no columns is a grid nobody
        // can get back out of, because the picker it would take is listed by column.
        return isHidden(columnId) || visibleCount > 1;
    };

    const canResize = (columnId: string): boolean =>
        resizingAllowed && definitions.get(columnId)?.layout?.resizable !== false;

    const canMove = (columnId: string): boolean =>
        reorderingAllowed && definitions.get(columnId)?.layout?.movable !== false;

    // Two orders, because a reader counts what they can see and the state has to remember what they
    // cannot. `fullOrder` covers every data column, hidden ones included, and is what `configure`
    // hands the engine; `order` is the visible subset of it, and is what every index in this
    // controller counts. Without the first, hiding a column and then moving another one would leave
    // the hidden column stranded at the end when it came back.
    const fullOrder = orderedColumns(columns, layout.order).map((column) => column.id);
    const order = fullOrder.filter((id) => !isHidden(id));

    const indexOf = (columnId: string): number => order.indexOf(columnId);

    /**
     * Where a column belongs once it is pinned to `side`: the inner end of that side's run.
     *
     * The same answer serves unpinning, because the place just inside a run is also the place just
     * outside it once the column is no longer part of it. A column that was never pinned and is
     * being unpinned has nowhere to go, which is what `null` means here.
     */
    const edgeOfRun = (columnId: string, side: ColumnPin | null): number => {
        if (side === null) return -1;
        const others = order.filter((id) => id !== columnId);
        const run = others.filter((id) => pinOf(id) === side).length;
        return side === 'left' ? run : others.length - run;
    };

    /**
     * Which edge a column landing at `toIndex` belongs to.
     *
     * A column dropped inside a run of pinned columns takes that run's edge, and one dropped outside
     * every run is unpinned. "Inside" means both neighbours at the destination share an edge, so
     * dropping against the outer side of a pinned run leaves the column unpinned rather than
     * swallowing it.
     */
    const pinAfterMove = (columnId: string, toIndex: number): ColumnPin | null => {
        const without = order.filter((id) => id !== columnId);
        const before = toIndex > 0 ? without[toIndex - 1] : undefined;
        const after = without[toIndex];
        const pinBefore = before === undefined ? null : pinOf(before);
        const pinAfter = after === undefined ? null : pinOf(after);

        if (pinBefore !== null && pinBefore === pinAfter) return pinBefore;
        // The ends of the row are runs too: dropping first into a left-pinned run, or last into a
        // right-pinned one, has only one neighbour to agree with.
        if (before === undefined && pinAfter === 'left') return 'left';
        if (after === undefined && pinBefore === 'right') return 'right';
        return null;
    };

    return {
        layout,
        order,
        widthOf,
        pinOf,
        isHidden,
        canHide,
        canResize,
        canMove,
        indexOf,
        boundsOf,
        setWidth: (columnId, width) =>
            setLayout((current) => ({
                ...current,
                widths: withEntry(current.widths, columnId, clampWidth(width, boundsOf(columnId))),
            })),
        // Pinning moves the column to the edge it is pinned to, and unpinning moves it just clear of
        // the run it was in, both in one update.
        //
        // Not two: `setPinned` followed by `moveColumn` would have the second call read the pins from
        // before the first, and `moveColumn` decides a pin from the neighbours it finds, so the move
        // would undo the pin. More importantly, a column frozen in the middle of the row is not what
        // "pinned to the start" means to the reader who asked for it, and one left unpinned between
        // two frozen columns scrolls away and leaves a hole.
        setPinned: (columnId, side) => {
            const at = indexOf(columnId);
            const destination = at === -1 ? -1 : edgeOfRun(columnId, side ?? pinOf(columnId));
            const nextOrder = destination === -1 ? fullOrder : moveInOrder(fullOrder, columnId, destination);

            setLayout((current) => ({
                ...current,
                order: nextOrder === fullOrder ? current.order : nextOrder,
                pinned: withEntry(current.pinned, columnId, side),
            }));
        },
        setHidden: (columnId, hidden) => {
            if (hidden && !canHide(columnId)) return;
            setLayout((current) => ({ ...current, hidden: withEntry(current.hidden, columnId, hidden) }));
        },
        showAll: () =>
            setLayout((current) => ({
                ...current,
                // Every column this grid has, not only the ones the layout has an entry for: a
                // column hidden by its own definition is one the reader can see is missing too.
                hidden: columns.reduce((record, column) => withEntry(record, column.id, false), current.hidden),
            })),
        moveColumn: (columnId, toIndex) => {
            if (!canMove(columnId) || indexOf(columnId) === -1) return;
            const clamped = Math.min(Math.max(Math.trunc(toIndex), 0), order.length - 1);
            // A locked column is a wall, not just an immovable block: nothing may cross it, or a
            // column declared first could be made second by moving another one in front of it.
            const crossed = order.slice(Math.min(indexOf(columnId), clamped), Math.max(indexOf(columnId), clamped) + 1);
            if (crossed.some((id) => id !== columnId && !canMove(id))) return;

            // The move is expressed against what the reader sees, then applied to the full order by
            // taking the place of the visible column currently at that position. Hidden columns keep
            // the neighbours they had.
            const target = order[clamped];
            if (target === undefined) return;
            const nextOrder = moveInOrder(fullOrder, columnId, fullOrder.indexOf(target));
            if (nextOrder === fullOrder) return;
            const side = pinAfterMove(columnId, clamped);

            // The one place `order` and `pinned` are written together, so they cannot disagree about
            // a column that ended up between two frozen ones.
            setLayout((current) => ({
                ...current,
                order: nextOrder,
                pinned: withEntry(current.pinned, columnId, side),
            }));
        },
        reset: () => setLayout(normalizeLayout(options.initial)),
    };
}
