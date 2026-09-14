import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { scrollOffsetForIndex } from '../../core/virtual';
import type { AddonContribution, GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { GridVirtualBody } from './GridVirtualBody';

export const VIRTUAL_ADDON = 'gridwright:virtual';

/** Renders only the rows on screen. Works over a flat grid and over a tree alike. */
export interface GridVirtualOptions {
    /** Fixed row height in pixels. Must match `--gw-row-height`. Default 40. */
    readonly rowHeight?: number;
    /** Extra rows rendered above and below the viewport. Default 6. */
    readonly overscan?: number;
    /** Height of the scrolling area. Default 420. */
    readonly height?: number | string;
    /** Rendered for a row inside the viewport whose data has not arrived yet. */
    readonly renderSkeleton?: (absoluteIndex: number) => ReactNode;
}

interface VirtualScrollValue {
    readonly containerRef: RefObject<HTMLDivElement | null>;
    readonly rowHeight: number;
}

const VirtualScrollContext = createContext<VirtualScrollValue | null>(null);

/**
 * A windowed body: only the rows on screen are in the DOM, inside a scrolling wrapper.
 *
 * Suppresses pagination's controls, because a scrollbar over the whole result set is already the
 * navigation and two disagreeing ones is worse than either. The engine still pages underneath: the
 * body moves the page to follow the scroll.
 */
export function virtualRows<TRow>(options: GridVirtualOptions = {}): GridAddon<TRow> {
    return {
        name: VIRTUAL_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useVirtualRowsSetup() {
            return useWindowedBody<TRow>(options);
        },
    };
}

function useWindowedBody<TRow>(options: GridVirtualOptions): AddonContribution<TRow> {
    const rowHeight = options.rowHeight ?? 40;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const value = useMemo(() => ({ containerRef, rowHeight }), [rowHeight]);

    return {
        navigation: 'window',
        suppresses: ['gridwright:pagination'],
        provide: (children) => <VirtualScrollContext.Provider value={value}>{children}</VirtualScrollContext.Provider>,
        tableWrapper: () => ({ ref: containerRef, style: { maxHeight: options.height ?? 420, overflowY: 'auto' } }),
        body: () => (
            <GridVirtualBody
                containerRef={containerRef}
                rowHeight={rowHeight}
                {...(options.overscan !== undefined ? { overscan: options.overscan } : {})}
                {...(options.renderSkeleton ? { renderSkeleton: options.renderSkeleton } : {})}
            />
        ),
    };
}

export interface VirtualScroll {
    /** The scrolling wrapper. */
    readonly containerRef: RefObject<HTMLDivElement | null>;
    /** Scrolls the wrapper so the row at that position in the whole result set is on screen. */
    scrollToIndex(index: number): void;
}

/** Scrolling for a windowed grid, from inside it. Null when the grid does not list `virtualRows()`. */
export function useVirtualScroll(): VirtualScroll | null {
    const value = useContext(VirtualScrollContext);
    const { state } = useGridwrightContext();
    const count = state.totalRows;

    const scrollToIndex = useCallback(
        (index: number) => {
            const container = value?.containerRef.current;
            if (!value || !container) return;
            container.scrollTop = scrollOffsetForIndex({
                index,
                count,
                rowHeight: value.rowHeight,
                viewportHeight: container.clientHeight,
            });
        },
        [value, count],
    );

    return value ? { containerRef: value.containerRef, scrollToIndex } : null;
}
