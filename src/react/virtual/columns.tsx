import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { columnOffsets, computeColumnWindow, scrollLeftForColumn } from '../../core/virtual-columns';
import type { ColumnValue, ResolvedColumn } from '../../core/types';
import type {
    AddonContribution,
    ColumnGeometry,
    ColumnWindowEntry,
    ColumnWindowPlan,
    GridAddon,
    GridContext,
} from '../addons/types';
import { pixelWidth } from '../layout/layout';
import { COLUMN_LAYOUT_ADDON } from '../layout/messages';
import { extraColumnsOf } from '../parts/slots';

export const VIRTUAL_COLUMNS_ADDON = 'gridwright:virtual-columns';

/** Renders only the columns on screen, for a grid with more columns than anyone reads at once. */
export interface GridVirtualColumnsOptions {
    /**
     * Width in pixels of a column that declares none, or declares one that is not a pixel count
     * (`'20%'`, `'auto'`). Default 160. Ignored while `columnLayout()` is listed: its widths, and its
     * own `defaultWidth`, are the ones the columns are painted at.
     */
    readonly defaultWidth?: number;
    /** Width in pixels of another add-on's extra column, such as the selection checkbox. Default 48. Same exception. */
    readonly extraColumnWidth?: number;
    /** Columns rendered beyond each edge of the viewport. Default 2. */
    readonly overscan?: number;
}

export interface VirtualColumnScroll {
    /**
     * Scrolls the grid just far enough that the column is in view and mounted, clear of any pinned
     * columns. A column already in view, a pinned column and an id that is not a visible data column
     * move nothing.
     */
    scrollToColumn(columnId: string): void;
}

const VirtualColumnScrollContext = createContext<VirtualColumnScroll | null>(null);

/**
 * Only the columns on screen are in the DOM: a grid of five hundred columns mounts the dozen in view,
 * a couple either side, and any that are pinned.
 *
 * Composes with `virtualRows()`, which windows the other axis; listed together, the grid mounts the
 * rows in view times the columns in view. Each works without the other.
 *
 * The table stays a real table. Each run of columns that is not mounted is one empty cell as wide
 * as all of them, in the header and in every row, so the scrollbar is the width of every column and
 * the mounted cells sit exactly where they would without windowing. Every mounted cell carries its
 * true `aria-colindex`, and the table its `aria-colcount`.
 *
 * Placement is arithmetic over declared widths, so the table is put into fixed layout: a declared
 * width becomes the painted one. With `columnLayout()` listed the widths are the layout's, resizing
 * included; without it the add-on sets them from each column's `width`.
 */
export function virtualColumns<TRow>(options: GridVirtualColumnsOptions = {}): GridAddon<TRow> {
    return {
        name: VIRTUAL_COLUMNS_ADDON,
        // Placed after the layout whatever order they were listed in, because this reads the widths and
        // pins it publishes, and a setup only sees what came before it.
        after: [COLUMN_LAYOUT_ADDON],
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useVirtualColumnsSetup({ columnGeometry }) {
            return useColumnWindow<TRow>(options, columnGeometry);
        },
    };
}

/** The horizontal layout of one render, kept for the scroll handler and for `scrollToColumn`. */
interface Measured {
    readonly ids: readonly string[];
    readonly offsets: readonly number[];
    readonly pinned: readonly boolean[];
    readonly insetStart: number;
    readonly insetEnd: number;
}

interface Viewport {
    readonly scrollLeft: number;
    readonly viewportWidth: number;
}

function useColumnWindow<TRow>(
    options: GridVirtualColumnsOptions,
    geometry: ColumnGeometry | undefined,
): AddonContribution<TRow> {
    const overscan = options.overscan ?? 2;
    const defaultWidth = options.defaultWidth ?? 160;
    const extraColumnWidth = options.extraColumnWidth ?? 48;

    const containerRef = useRef<HTMLDivElement | null>(null);
    // The scroll position lives in a ref and is read while rendering. State only asks for the render,
    // and only when the scroll has carried a column across the window's edge: scrolling within a
    // column changes nothing that is drawn, so it costs nothing.
    const viewport = useRef<Viewport>({ scrollLeft: 0, viewportWidth: 0 });
    const measured = useRef<Measured | null>(null);
    const shown = useRef<{ start: number; end: number } | null>(null);
    const [, rerender] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let frame: number | null = null;

        const read = (): void => {
            viewport.current = { scrollLeft: container.scrollLeft, viewportWidth: container.clientWidth };
            const layout = measured.current;
            const current = shown.current;
            if (layout && current) {
                const next = computeColumnWindow({ offsets: layout.offsets, overscan, ...viewport.current });
                if (next.startIndex === current.start && next.endIndex === current.end) return;
            }
            rerender((count) => count + 1);
        };

        read();

        // Coalesced to one read per frame. A scroll event fires far more often than the screen
        // refreshes, and a vertical scroll fires it too, which this answers by doing nothing.
        const onScroll = (): void => {
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                read();
            });
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
        observer?.observe(container);

        return () => {
            container.removeEventListener('scroll', onScroll);
            observer?.disconnect();
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [overscan]);

    const widthOf = (column: ResolvedColumn<TRow, ColumnValue>): number => {
        if (geometry) return geometry.widthOf(column.id);
        const declared = pixelWidth(column.width) ?? defaultWidth;
        const minimum = pixelWidth(column.minWidth) ?? 0;
        return Math.max(declared, minimum);
    };
    const extraWidthOf = (columnId: string): number => (geometry ? geometry.widthOf(columnId) : extraColumnWidth);

    // Computed lazily, once per render of the grid, then read by the header, every row and every
    // add-on row that renders a cell per column. `setup` runs per render, so this closure is this
    // render's, and a row is a lookup into one array rather than an arithmetic pass of its own.
    let plan: ColumnWindowPlan<TRow> | undefined;
    const planFor = (grid: GridContext<TRow>): ColumnWindowPlan<TRow> => (plan ??= buildPlan(grid));

    const buildPlan = (grid: GridContext<TRow>): ColumnWindowPlan<TRow> => {
        const visible = grid.columns.filter((column) => !column.hidden);
        const extras = extraColumnsOf(grid);
        const pinOf = (columnId: string) => geometry?.pinOf(columnId) ?? null;

        const widths = visible.map(widthOf);
        const startWidth = extras.start.reduce((sum, column) => sum + extraWidthOf(column.id), 0);
        const offsets = columnOffsets(widths, startWidth);
        const pinned = visible.map((column) => pinOf(column.id) !== null);

        // What covers the scrolling area at each edge. `columnLayout()` pins the extra columns on an
        // edge as soon as a data column is pinned there, so they count when that is the case.
        let insetStart = 0;
        let insetEnd = 0;
        visible.forEach((column, index) => {
            const pin = pinOf(column.id);
            if (pin === 'left') insetStart += widths[index]!;
            if (pin === 'right') insetEnd += widths[index]!;
        });
        if (insetStart > 0) insetStart += startWidth;
        if (insetEnd > 0) insetEnd += extras.end.reduce((sum, column) => sum + extraWidthOf(column.id), 0);

        const window = computeColumnWindow({ offsets, overscan, ...viewport.current });
        measured.current = { ids: visible.map((column) => column.id), offsets, pinned, insetStart, insetEnd };
        shown.current = { start: window.startIndex, end: window.endIndex };

        const entries: ColumnWindowEntry<TRow>[] = [];
        let gapFrom = -1;
        const closeGap = (until: number): void => {
            if (gapFrom === -1) return;
            entries.push({
                kind: 'gap',
                key: `gap-${gapFrom}`,
                width: offsets[until]! - offsets[gapFrom]!,
                columns: until - gapFrom,
            });
            gapFrom = -1;
        };

        visible.forEach((column, index) => {
            // A pinned column is always mounted: it is on screen wherever the grid is scrolled to.
            const mounted = pinned[index] || (index >= window.startIndex && index < window.endIndex);
            if (!mounted) {
                if (gapFrom === -1) gapFrom = index;
                return;
            }
            closeGap(index);
            entries.push({ kind: 'column', column, index });
        });
        closeGap(visible.length);

        return { entries, columnCount: visible.length };
    };

    const scrollToColumn = useCallback(
        (columnId: string): void => {
            const container = containerRef.current;
            const layout = measured.current;
            if (!container || !layout) return;
            const index = layout.ids.indexOf(columnId);
            if (index === -1 || layout.pinned[index]) return;

            const target = scrollLeftForColumn({
                offsets: layout.offsets,
                index,
                scrollLeft: container.scrollLeft,
                viewportWidth: container.clientWidth,
                insetStart: layout.insetStart,
                insetEnd: layout.insetEnd,
            });
            // A right-to-left container counts its scroll towards the end as a negative number.
            const rtl = typeof getComputedStyle === 'function' && getComputedStyle(container).direction === 'rtl';
            const next = rtl ? -target : target;
            if (next !== container.scrollLeft) container.scrollLeft = next;
        },
        [],
    );

    const scroll = useMemo<VirtualColumnScroll>(() => ({ scrollToColumn }), [scrollToColumn]);

    return {
        provide: (children: ReactNode) => (
            <VirtualColumnScrollContext.Provider value={scroll}>{children}</VirtualColumnScrollContext.Provider>
        ),
        tableWrapper: () => ({ ref: containerRef as RefObject<HTMLDivElement | null>, style: { overflowX: 'auto' } }),
        columnWindow: planFor,
        // Placement is arithmetic over declared widths, so the declared width has to be the painted
        // one. `columnLayout()` already does both when it is listed, from its own widths, and a second
        // width here would fight its live resize, which writes a custom property and not a render.
        ...(geometry
            ? {}
            : {
                  tableAttributes: () => ({ className: 'gw-table--fixed' }),
                  headerAttributes: (column: ResolvedColumn<TRow, ColumnValue>) => ({ style: { width: widthOf(column) } }),
                  extraHeaderAttributes: (columnId: string) => ({ style: { width: extraWidthOf(columnId) } }),
              }),
    };
}

/**
 * Horizontal scrolling for a grid that lists `virtualColumns()`, from inside it. Null otherwise.
 *
 * What a component that moves to a column needs: under a column window the column may not be in the
 * DOM yet, so there is no element to scroll into view until this has scrolled to it.
 */
export function useVirtualColumnScroll(): VirtualColumnScroll | null {
    return useContext(VirtualColumnScrollContext);
}
