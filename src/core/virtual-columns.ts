/**
 * Which columns a horizontal scroll position is asking for.
 *
 * The horizontal counterpart of `computeVirtualWindow`, with one difference that shapes everything
 * here: rows share one height, columns do not. So the input is not a count and a size but the
 * running offsets of every column, computed once per column set with `columnOffsets` and searched
 * on every scroll, which keeps the scroll path logarithmic in the number of columns.
 *
 * Arithmetic only: no DOM, no framework. The widths come from whoever lays the columns out, and the
 * contract with the browser is the same as for rows: a column painted wider than its declared width
 * drifts from the scrollbar. Fixed table layout is what makes the declared width the painted one.
 *
 * No scaling is needed. Rows run out of browser pixels at about 400,000; at 160 pixels a column,
 * the same limit is 100,000 columns, which is not a grid anyone reads.
 */

/**
 * The left edge of every column and the right edge of the last, from the widths in painting order.
 *
 * `offsets[i]` is where column `i` starts and `offsets[widths.length]` is the total width. `start`
 * is where the first of these columns sits in the scrolling content, for columns painted after
 * something else: a selection checkbox before the data columns. A width that is not a positive
 * finite number counts as zero, so one bad value cannot turn every offset after it into `NaN`.
 */
export function columnOffsets(widths: readonly number[], start = 0): readonly number[] {
    const offsets = new Array<number>(widths.length + 1);
    let running = Number.isFinite(start) ? start : 0;
    offsets[0] = running;
    for (let index = 0; index < widths.length; index += 1) {
        const width = widths[index]!;
        running += Number.isFinite(width) && width > 0 ? width : 0;
        offsets[index + 1] = running;
    }
    return offsets;
}

export interface ColumnWindowInput {
    /** From `columnOffsets`: one more entry than there are columns. */
    readonly offsets: readonly number[];
    /**
     * The scroll container's horizontal offset. Its magnitude is used, because a right-to-left
     * container reports a scroll towards the end as a negative number in every current browser.
     */
    readonly scrollLeft: number;
    /** The scroll container's visible width. Zero before it has been measured. */
    readonly viewportWidth: number;
    /** Extra columns rendered beyond each edge of the viewport. Default 2. */
    readonly overscan?: number;
}

export interface ColumnWindow {
    /** First column to render, including overscan. */
    readonly startIndex: number;
    /** One past the last column to render. */
    readonly endIndex: number;
    /** First column at least partly inside the viewport, ignoring overscan. */
    readonly firstVisibleIndex: number;
    /** One past the last column at least partly inside the viewport. */
    readonly endVisibleIndex: number;
}

/** What a viewport that has not been measured is assumed to be: a wide screen, not nothing. */
const UNMEASURED_WIDTH = 1600;

/** The index of the column containing `x`, clamped to the columns that exist. */
function columnAt(offsets: readonly number[], x: number): number {
    const count = offsets.length - 1;
    if (count <= 0) return 0;
    // The last column whose left edge is at or before x. Binary search, because this runs on every
    // scroll frame and a grid with five hundred columns would otherwise walk them all.
    let low = 0;
    let high = count - 1;
    while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (offsets[middle]! <= x) low = middle;
        else high = middle - 1;
    }
    return low;
}

export function computeColumnWindow(input: ColumnWindowInput): ColumnWindow {
    const { offsets } = input;
    const count = Math.max(0, offsets.length - 1);
    if (count === 0) return { startIndex: 0, endIndex: 0, firstVisibleIndex: 0, endVisibleIndex: 0 };

    const overscan = Math.max(0, Math.floor(input.overscan ?? 2));
    // Before the container has been measured, answer with a screenful rather than nothing: a first
    // paint with no columns makes the grid look empty for a frame.
    const width = input.viewportWidth > 0 ? input.viewportWidth : UNMEASURED_WIDTH;
    const left = Math.abs(Number.isFinite(input.scrollLeft) ? input.scrollLeft : 0);
    const right = left + width;

    const firstVisibleIndex = columnAt(offsets, left);
    // The column containing the right edge is visible unless the edge falls exactly on its start.
    const lastIndex = columnAt(offsets, right);
    const endVisibleIndex = Math.min(count, offsets[lastIndex]! < right ? lastIndex + 1 : Math.max(lastIndex, firstVisibleIndex + 1));

    return {
        startIndex: Math.max(0, firstVisibleIndex - overscan),
        endIndex: Math.min(count, endVisibleIndex + overscan),
        firstVisibleIndex,
        endVisibleIndex,
    };
}

export interface ScrollLeftForColumnInput {
    /** From `columnOffsets`. */
    readonly offsets: readonly number[];
    /** The column to bring into view. */
    readonly index: number;
    /** Where the container is scrolled to now, so a column already in view moves nothing. */
    readonly scrollLeft: number;
    readonly viewportWidth: number;
    /**
     * Pixels at the start edge covered by something that does not scroll: the columns pinned to it.
     * A column that is "in view" underneath them is not in view.
     */
    readonly insetStart?: number;
    /** The same at the end edge. */
    readonly insetEnd?: number;
}

/**
 * The smallest scroll that brings a column into view, as a non-negative offset.
 *
 * Nearest rather than aligned: a column already fully visible keeps the scroll where it is, one off
 * the end edge scrolls just far enough to show it. Moving the cursor one cell right should move the
 * page one column, not snap the cursor to the left edge every time. A column wider than the space
 * left for it is aligned to the start, so its beginning is what the reader sees.
 *
 * The caller restores the sign for a right-to-left container.
 */
export function scrollLeftForColumn(input: ScrollLeftForColumnInput): number {
    const { offsets } = input;
    const count = offsets.length - 1;
    const current = Math.abs(input.scrollLeft);
    if (count <= 0) return current;

    const index = Math.min(Math.max(Math.trunc(input.index), 0), count - 1);
    const start = offsets[index]!;
    const end = offsets[index + 1]!;
    const insetStart = Math.max(0, input.insetStart ?? 0);
    const insetEnd = Math.max(0, input.insetEnd ?? 0);
    const space = Math.max(0, input.viewportWidth - insetStart - insetEnd);

    const visibleFrom = current + insetStart;
    const visibleTo = current + insetStart + space;

    if (end - start > space || start < visibleFrom) return Math.max(0, start - insetStart);
    if (end > visibleTo) return Math.max(0, end - insetStart - space);
    return current;
}
