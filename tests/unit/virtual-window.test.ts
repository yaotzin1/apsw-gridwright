import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, scrollOffsetForIndex, MAX_SCROLL_HEIGHT } from '../../src/core/virtual';

/**
 * The window arithmetic, with no DOM anywhere near it.
 *
 * It lives in the core because that is what it is: four numbers in, a slice and two spacer heights
 * out. The React hook is a binding around this, and a page with no framework calls it from a scroll
 * listener and gets the same answer.
 */

const window40 = (over: Partial<Parameters<typeof computeVirtualWindow>[0]> = {}) =>
    computeVirtualWindow({ count: 1_000, rowHeight: 40, scrollTop: 0, viewportHeight: 400, ...over });

describe('computeVirtualWindow', () => {
    it('renders a screenful plus overscan, not the whole count', () => {
        const view = window40();

        expect(view.startIndex).toBe(0);
        expect(view.endIndex).toBe(16);
        expect(view.scrollHeight).toBe(40_000);
        expect(view.paddingTop).toBe(0);
        expect(view.paddingBottom).toBe(40_000 - 16 * 40);
    });

    it('maps a scroll offset straight to a row while the rows fit', () => {
        const view = window40({ scrollTop: 4_000 });

        expect(view.scaled).toBe(false);
        expect(view.firstVisibleIndex).toBe(100);
        // The spacers plus the rendered rows are always the whole scrolling area, or the scrollbar
        // and the rows disagree about how far there is left to go.
        expect(view.paddingTop + (view.endIndex - view.startIndex) * 40 + view.paddingBottom).toBe(40_000);
    });

    it('answers with a screenful before anything has been measured', () => {
        // A first paint of zero rows makes a grid look empty for a frame.
        expect(window40({ viewportHeight: 0 }).visibleCount).toBe(20);
    });

    it('keeps the scrolling area inside what a browser will render', () => {
        const view = computeVirtualWindow({
            count: 10_000_000,
            rowHeight: 40,
            scrollTop: 0,
            viewportHeight: 400,
        });

        // Four hundred million pixels is roughly twenty-four times Chrome's limit, and it fails by
        // silently clipping rather than by complaining.
        expect(view.scaled).toBe(true);
        expect(view.scrollHeight).toBe(MAX_SCROLL_HEIGHT);
    });

    it('reaches the last row of ten million', () => {
        const view = computeVirtualWindow({
            count: 10_000_000,
            rowHeight: 40,
            scrollTop: MAX_SCROLL_HEIGHT - 400,
            viewportHeight: 400,
        });

        expect(view.endIndex).toBe(10_000_000);
        expect(view.firstVisibleIndex).toBeGreaterThan(9_999_900);
    });

    it('never asks for a row that does not exist', () => {
        for (const scrollTop of [0, 1, 19_999, 39_600, 40_000, 1e9]) {
            const view = window40({ scrollTop });
            expect(view.startIndex).toBeGreaterThanOrEqual(0);
            expect(view.endIndex).toBeLessThanOrEqual(1_000);
            expect(view.paddingTop).toBeGreaterThanOrEqual(0);
            expect(view.paddingBottom).toBeGreaterThanOrEqual(0);
        }
    });

    it('survives an empty grid', () => {
        const view = window40({ count: 0 });

        expect(view.startIndex).toBe(0);
        expect(view.endIndex).toBe(0);
        expect(view.scrollHeight).toBe(0);
    });
});

describe('scrollOffsetForIndex', () => {
    it('is the exact offset while the rows fit', () => {
        expect(scrollOffsetForIndex({ index: 100, count: 1_000, rowHeight: 40, viewportHeight: 400 })).toBe(4_000);
    });

    it('agrees with the window it is the inverse of, scaled', () => {
        const count = 10_000_000;
        const scrollTop = scrollOffsetForIndex({ index: 4_000_000, count, rowHeight: 40, viewportHeight: 400 });
        const view = computeVirtualWindow({ count, rowHeight: 40, scrollTop, viewportHeight: 400 });

        // Scaled, a pixel covers several rows, so the answer is close rather than exact. Close
        // enough that the row asked for is on screen is the whole promise.
        expect(Math.abs(view.firstVisibleIndex - 4_000_000)).toBeLessThan(1_000);
    });

    it('clamps an index past the end', () => {
        const offset = scrollOffsetForIndex({ index: 5_000, count: 1_000, rowHeight: 40, viewportHeight: 400 });
        expect(offset).toBe(40_000);
    });
});
