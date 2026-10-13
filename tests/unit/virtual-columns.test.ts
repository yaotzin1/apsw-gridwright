import { describe, expect, it } from 'vitest';
import { columnOffsets, computeColumnWindow, scrollLeftForColumn } from '../../src/core/virtual-columns';

/**
 * The column window arithmetic, with no DOM anywhere near it.
 *
 * Columns differ from rows in one way that matters: they do not share a width. So the input is the
 * running offsets of every column, built once per column set, and a scroll is a binary search over
 * them rather than a division.
 */

const uniform = (count: number, width: number, start = 0) => columnOffsets(new Array<number>(count).fill(width), start);

describe('columnOffsets', () => {
    it('starts every column where the previous one ended', () => {
        expect(columnOffsets([100, 50, 200])).toEqual([0, 100, 150, 350]);
    });

    it('starts after whatever is painted before the columns', () => {
        // A selection checkbox column 48 pixels wide, before the data columns.
        expect(columnOffsets([100, 100], 48)).toEqual([48, 148, 248]);
    });

    it('counts a width that is not a positive number as zero rather than poisoning every offset after it', () => {
        expect(columnOffsets([100, Number.NaN, -5, 100])).toEqual([0, 100, 100, 100, 200]);
    });
});

describe('computeColumnWindow', () => {
    it('mounts the columns in view plus the overscan, not all of them', () => {
        const view = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 0, viewportWidth: 800 });

        expect(view.firstVisibleIndex).toBe(0);
        expect(view.endVisibleIndex).toBe(5);
        expect(view.startIndex).toBe(0);
        expect(view.endIndex).toBe(7);
    });

    it('follows the scroll position into the middle of the columns', () => {
        const view = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 16_000, viewportWidth: 800, overscan: 3 });

        expect(view.firstVisibleIndex).toBe(100);
        expect(view.endVisibleIndex).toBe(105);
        expect(view.startIndex).toBe(97);
        expect(view.endIndex).toBe(108);
    });

    it('counts a column that is only partly in view', () => {
        const view = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 80, viewportWidth: 800, overscan: 0 });

        // Column 0 is half visible on the left, column 5 half visible on the right.
        expect(view.firstVisibleIndex).toBe(0);
        expect(view.endVisibleIndex).toBe(6);
    });

    it('handles columns of different widths', () => {
        const offsets = columnOffsets([300, 50, 50, 50, 400, 100]);
        const view = computeColumnWindow({ offsets, scrollLeft: 320, viewportWidth: 200, overscan: 0 });

        // 320..520 covers column 1 (300..350) through column 4 (450..850).
        expect(view.firstVisibleIndex).toBe(1);
        expect(view.endVisibleIndex).toBe(5);
    });

    it('clamps a scroll past the end to the last columns', () => {
        const view = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 1e9, viewportWidth: 800, overscan: 2 });

        expect(view.endIndex).toBe(500);
        expect(view.endVisibleIndex).toBe(500);
    });

    it('reads a right-to-left scroll offset by its magnitude', () => {
        const left = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 16_000, viewportWidth: 800 });
        const rtl = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: -16_000, viewportWidth: 800 });

        expect(rtl).toEqual(left);
    });

    it('answers with a screenful before the viewport has been measured', () => {
        // A first paint with no columns makes the grid look empty for a frame.
        const view = computeColumnWindow({ offsets: uniform(500, 160), scrollLeft: 0, viewportWidth: 0 });

        expect(view.endVisibleIndex).toBeGreaterThan(5);
    });

    it('answers an empty column set with an empty window', () => {
        expect(computeColumnWindow({ offsets: [0], scrollLeft: 0, viewportWidth: 800 })).toEqual({
            startIndex: 0,
            endIndex: 0,
            firstVisibleIndex: 0,
            endVisibleIndex: 0,
        });
    });

    it('stays logarithmic: a hundred thousand columns answer as quickly as ten', () => {
        const offsets = uniform(100_000, 120);
        const started = performance.now();
        for (let step = 0; step < 10_000; step += 1) {
            computeColumnWindow({ offsets, scrollLeft: step * 997, viewportWidth: 1_200 });
        }
        // Ten thousand windows over a hundred thousand columns. A linear scan would be a billion
        // comparisons; the search is about seventeen per window.
        expect(performance.now() - started).toBeLessThan(250);
    });
});

describe('scrollLeftForColumn', () => {
    const offsets = uniform(500, 160);

    it('leaves the scroll alone when the column is already in view', () => {
        expect(scrollLeftForColumn({ offsets, index: 2, scrollLeft: 0, viewportWidth: 800 })).toBe(0);
    });

    it('scrolls just far enough to show a column past the end edge', () => {
        // Column 10 ends at 1760; with an 800-pixel viewport the smallest scroll that shows it is 960.
        expect(scrollLeftForColumn({ offsets, index: 10, scrollLeft: 0, viewportWidth: 800 })).toBe(960);
    });

    it('scrolls back to a column before the start edge', () => {
        expect(scrollLeftForColumn({ offsets, index: 3, scrollLeft: 4_000, viewportWidth: 800 })).toBe(480);
    });

    it('keeps the column clear of the columns pinned over each edge', () => {
        // 200 pixels pinned at the start: column 3 starts at 480, so the scroll puts it at 480 - 200.
        expect(scrollLeftForColumn({ offsets, index: 3, scrollLeft: 4_000, viewportWidth: 800, insetStart: 200 })).toBe(280);
        // 160 pixels pinned at the end: the usable width is 640, so column 10 needs 1760 - 640.
        expect(scrollLeftForColumn({ offsets, index: 10, scrollLeft: 0, viewportWidth: 800, insetEnd: 160 })).toBe(1_120);
    });

    it('aligns a column wider than the space to its start, so its beginning is what shows', () => {
        const wide = columnOffsets([100, 2_000, 100]);
        expect(scrollLeftForColumn({ offsets: wide, index: 1, scrollLeft: 0, viewportWidth: 800 })).toBe(100);
    });

    it('clamps an index outside the columns', () => {
        expect(scrollLeftForColumn({ offsets, index: 10_000, scrollLeft: 0, viewportWidth: 800 })).toBe(80_000 - 800);
    });
});
