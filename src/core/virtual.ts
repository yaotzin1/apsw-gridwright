/**
 * Which rows a scroll position is asking for.
 *
 * Arithmetic and nothing else: no DOM, no framework, no measurement of individual rows. It lives in
 * the core because that is what it is. The React virtual body is a binding around this function,
 * and a page with no framework at all can call it from a scroll listener and get the same answer.
 *
 * Fixed row height is what buys the arithmetic, and a grid is the one place where fixed row height
 * is normal rather than a compromise. The consequence is stated rather than hidden: a row taller
 * than `rowHeight` overflows its slot.
 */

/**
 * The tallest scrolling area this will ask a browser for, in pixels.
 *
 * Browsers cap the height of an element: Chrome stops at 2^24 pixels and Firefox not far above
 * that, silently, with no error. At forty pixels a row that is about 419,000 rows, so a spacer tall
 * enough for ten million rows is not something a browser will render. Past this height the
 * scrollbar stops being a map of the rows and becomes a ratio instead: see `scaled`.
 */
export const MAX_SCROLL_HEIGHT = 15_000_000;

export interface VirtualWindowInput {
    /** How many rows exist in total. */
    readonly count: number;
    /** Fixed row height in pixels. Must match `--gw-row-height` or the rows drift from the scroll. */
    readonly rowHeight: number;
    /** The scroll container's current offset. */
    readonly scrollTop: number;
    /** The scroll container's visible height. Zero before it has been measured. */
    readonly viewportHeight: number;
    /** Extra rows rendered above and below the viewport. Default 6. */
    readonly overscan?: number;
}

export interface VirtualWindow {
    /** First row to render, including overscan. */
    readonly startIndex: number;
    /** One past the last row to render. */
    readonly endIndex: number;
    /** Spacer height above the rendered rows. */
    readonly paddingTop: number;
    /** Spacer height below them. */
    readonly paddingBottom: number;
    /** First row actually visible, ignoring overscan. What a data window should follow. */
    readonly firstVisibleIndex: number;
    readonly visibleCount: number;
    /** The height of the whole scrolling area: the two paddings plus the rendered rows. */
    readonly scrollHeight: number;
    /**
     * True when there are more rows than the browser can give pixels to, so scroll position is a
     * ratio rather than an offset.
     *
     * The visible consequence is that one pixel of scrollbar covers more than one row, so the
     * smallest possible drag skips a few. Everything else keeps working in row numbers.
     */
    readonly scaled: boolean;
}

export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
    const { count, scrollTop, viewportHeight } = input;
    const overscan = input.overscan ?? 6;
    const rowHeight = Math.max(1, input.rowHeight);

    // Before the container has been measured, answer with a screenful rather than nothing: a first
    // paint of zero rows makes the grid look empty for a frame.
    const visibleCount = viewportHeight > 0 ? Math.ceil(viewportHeight / rowHeight) : 20;

    const natural = count * rowHeight;
    const scaled = natural > MAX_SCROLL_HEIGHT;
    const scrollHeight = scaled ? MAX_SCROLL_HEIGHT : natural;

    // Unscaled, the scroll offset *is* the row offset. Scaled, it is a position along the whole
    // result set, because there are no longer enough pixels to give each row its own.
    const firstVisibleIndex = scaled
        ? Math.round(
              Math.min(1, Math.max(0, scrollTop / Math.max(1, scrollHeight - viewportHeight))) *
                  Math.max(0, count - visibleCount),
          )
        : Math.min(Math.max(0, Math.floor(scrollTop / rowHeight)), Math.max(0, count - 1));

    const startIndex = Math.max(0, firstVisibleIndex - overscan);
    const endIndex = Math.min(count, firstVisibleIndex + visibleCount + overscan);
    const renderedHeight = (endIndex - startIndex) * rowHeight;

    // Scaled, the rendered block is placed under the scroll position rather than at its row's own
    // offset, since that offset no longer exists. Unscaled the two are the same number.
    const paddingTop = scaled
        ? Math.max(0, Math.min(scrollTop - overscan * rowHeight, scrollHeight - renderedHeight))
        : startIndex * rowHeight;

    return {
        startIndex,
        endIndex,
        paddingTop,
        paddingBottom: Math.max(0, scrollHeight - paddingTop - renderedHeight),
        firstVisibleIndex,
        visibleCount,
        scrollHeight,
        scaled,
    };
}

export interface ScrollOffsetInput {
    readonly index: number;
    readonly count: number;
    readonly rowHeight: number;
    readonly viewportHeight: number;
}

/**
 * The scroll offset that brings a row into view.
 *
 * The inverse of the mapping above, so asking for a row and then reading back which row is showing
 * agree. Scaled, they agree approximately: a pixel covers several rows, so the row asked for is on
 * screen rather than exactly at the top.
 */
export function scrollOffsetForIndex(input: ScrollOffsetInput): number {
    const rowHeight = Math.max(1, input.rowHeight);
    const target = Math.max(0, Math.min(input.index, input.count));
    const natural = input.count * rowHeight;

    if (natural <= MAX_SCROLL_HEIGHT) return target * rowHeight;

    const maxScroll = Math.max(1, MAX_SCROLL_HEIGHT - input.viewportHeight);
    const maxStart = Math.max(1, input.count - Math.ceil(input.viewportHeight / rowHeight));
    return Math.min(target / maxStart, 1) * maxScroll;
}
