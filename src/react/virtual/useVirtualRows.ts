import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface VirtualRowsOptions {
    /** How many rows exist in total, which is the scrollbar's height. */
    readonly count: number;
    /** Fixed row height in pixels. Must match `--gw-row-height` or the rows drift from the scroll. */
    readonly rowHeight: number;
    /** Extra rows rendered above and below the viewport. Default 6. */
    readonly overscan?: number;
    readonly containerRef: RefObject<HTMLElement | null>;
}

/**
 * The tallest scrolling area the hook will build, in pixels.
 *
 * Browsers cap the height of an element: Chrome stops at 2^24 pixels and Firefox not far above
 * that, silently, with no error. At forty pixels a row that is about 419,000 rows, so a spacer
 * tall enough for ten million rows is not something a browser will render. Past this height the
 * scrollbar stops being a map of the rows and becomes a ratio instead: see `VirtualRows.scaled`.
 */
const MAX_SCROLL_HEIGHT = 15_000_000;

export interface VirtualRows {
    /** First row to render, including overscan. */
    readonly startIndex: number;
    /** One past the last row to render. */
    readonly endIndex: number;
    /** Spacer height above the rendered rows. */
    readonly paddingTop: number;
    /** Spacer height below them. */
    readonly paddingBottom: number;
    /** First row actually visible, ignoring overscan. What the data window should follow. */
    readonly firstVisibleIndex: number;
    readonly visibleCount: number;
    /**
     * True when there are more rows than the browser can give pixels to, so scroll position is a
     * ratio rather than an offset.
     *
     * The visible consequence is that one pixel of scrollbar covers more than one row, so the
     * smallest possible drag skips a few. Everything else, including `scrollToIndex`, keeps
     * working in row numbers.
     */
    readonly scaled: boolean;
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

            const safeHeight = Math.max(1, rowHeight);
            const target = Math.max(0, Math.min(index, count));
            const natural = count * safeHeight;

            if (natural <= MAX_SCROLL_HEIGHT) {
                container.scrollTop = target * safeHeight;
                return;
            }

            // Scaled: the same ratio the scroll position is read back through, inverted, so that
            // asking for a row and then reading which row is showing agree.
            const maxScroll = Math.max(1, MAX_SCROLL_HEIGHT - container.clientHeight);
            const maxStart = Math.max(1, count - Math.ceil(container.clientHeight / safeHeight));
            container.scrollTop = Math.min(target / maxStart, 1) * maxScroll;
        },
        [containerRef, count, rowHeight],
    );

    return useMemo(() => {
        const safeHeight = Math.max(1, rowHeight);
        // Before the container has been measured, render a screenful rather than nothing: a first
        // paint of zero rows makes the grid look empty for a frame and breaks a test that never
        // lays out at all.
        const visibleCount = viewportHeight > 0 ? Math.ceil(viewportHeight / safeHeight) : 20;

        const natural = count * safeHeight;
        const scaled = natural > MAX_SCROLL_HEIGHT;
        const scrollHeight = scaled ? MAX_SCROLL_HEIGHT : natural;

        // Unscaled, the scroll offset *is* the row offset. Scaled, it is a position along the
        // whole result set, because there are no longer enough pixels to give each row its own.
        const firstVisibleIndex = scaled
            ? Math.round(
                  Math.min(1, Math.max(0, scrollTop / Math.max(1, scrollHeight - viewportHeight))) *
                      Math.max(0, count - visibleCount),
              )
            : Math.min(Math.max(0, Math.floor(scrollTop / safeHeight)), Math.max(0, count - 1));

        const startIndex = Math.max(0, firstVisibleIndex - overscan);
        const endIndex = Math.min(count, firstVisibleIndex + visibleCount + overscan);
        const renderedHeight = (endIndex - startIndex) * safeHeight;

        // Scaled, the rendered block is placed under the scroll position rather than at its row's
        // own offset, since that offset no longer exists. Unscaled the two are the same number.
        const paddingTop = scaled
            ? Math.max(0, Math.min(scrollTop - overscan * safeHeight, scrollHeight - renderedHeight))
            : startIndex * safeHeight;

        return {
            startIndex,
            endIndex,
            paddingTop,
            paddingBottom: Math.max(0, scrollHeight - paddingTop - renderedHeight),
            firstVisibleIndex,
            visibleCount,
            scaled,
            scrollToIndex,
        };
    }, [count, rowHeight, overscan, scrollTop, viewportHeight, scrollToIndex]);
}
