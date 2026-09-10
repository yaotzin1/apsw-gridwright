import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { computeVirtualWindow, scrollOffsetForIndex } from '../../core/virtual';
import type { VirtualWindow } from '../../core/virtual';

export interface VirtualRowsOptions {
    /** How many rows exist in total, which is the scrollbar's height. */
    readonly count: number;
    /** Fixed row height in pixels. Must match `--gw-row-height` or the rows drift from the scroll. */
    readonly rowHeight: number;
    /** Extra rows rendered above and below the viewport. Default 6. */
    readonly overscan?: number;
    readonly containerRef: RefObject<HTMLElement | null>;
}

export interface VirtualRows extends VirtualWindow {
    /** Scrolls the container so that row is on screen. */
    scrollToIndex(index: number): void;
}

/**
 * Which rows a scroll position is asking for.
 *
 * Deliberately arithmetic and nothing else: no measurement of individual rows, no ResizeObserver
 * per row, no DOM reads in the hot path. Fixed row height buys that, and a grid is the one place
 * where fixed row height is normal rather than a compromise.
 *
 * The consequence is stated rather than hidden: a row taller than `rowHeight` overflows its slot.
 * Variable heights need a measured virtualizer, which is a different piece of work.
 */
export function useVirtualRows(options: VirtualRowsOptions): VirtualRows {
    const { count, rowHeight, containerRef } = options;
    const overscan = options.overscan ?? 6;

    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const read = (): void => {
            setScrollTop(container.scrollTop);
            setViewportHeight(container.clientHeight);
        };

        read();

        // Coalesced to one read per frame. A scroll event fires far more often than the screen
        // refreshes, and doing the work per event is how a virtual list stutters.
        const onScroll = (): void => {
            if (frame.current !== null) return;
            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                read();
            });
        };

        container.addEventListener('scroll', onScroll, { passive: true });

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
        observer?.observe(container);

        return () => {
            container.removeEventListener('scroll', onScroll);
            observer?.disconnect();
            if (frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = null;
        };
    }, [containerRef]);

    const scrollToIndex = useCallback(
        (index: number) => {
            const container = containerRef.current;
            if (!container) return;

            container.scrollTop = scrollOffsetForIndex({
                index,
                count,
                rowHeight,
                viewportHeight: container.clientHeight,
            });
        },
        [containerRef, count, rowHeight],
    );

    return useMemo(
        () => ({
            // Every number here is arithmetic over the scroll position, which is why it lives in
            // the core and not in this file. What React contributes is reading the two DOM numbers
            // it needs, once per frame, and nothing else.
            ...computeVirtualWindow({
                count,
                rowHeight,
                scrollTop,
                viewportHeight,
                overscan,
            }),
            scrollToIndex,
        }),
        [count, rowHeight, overscan, scrollTop, viewportHeight, scrollToIndex],
    );
}
