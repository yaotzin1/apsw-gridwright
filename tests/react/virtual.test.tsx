import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVirtualRows } from '../../src/react/virtual/useVirtualRows';

/**
 * The arithmetic behind a virtual body, including the part nobody expects: a browser will not make
 * an element as tall as ten million rows. Past its limit the scrollbar has to stop being a map of
 * the rows and start being a ratio, or the last nine and a half million rows are unreachable with
 * no error to say so.
 */

function container(height: number): { current: HTMLElement } {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
    document.body.append(element);
    return { current: element };
}

const scrollTo = async (ref: { current: HTMLElement }, top: number): Promise<void> => {
    await act(async () => {
        ref.current.scrollTop = top;
        ref.current.dispatchEvent(new Event('scroll'));
        // The hook coalesces reads to one per frame, so the frame has to happen.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
};

const contentHeight = (rows: { paddingTop: number; paddingBottom: number; startIndex: number; endIndex: number }): number =>
    rows.paddingTop + (rows.endIndex - rows.startIndex) * 40 + rows.paddingBottom;

describe('useVirtualRows', () => {
    it('maps scroll offset to rows directly when the rows fit in the browser', async () => {
        const ref = container(400);
        const { result } = renderHook(() =>
            useVirtualRows({ count: 5_000, rowHeight: 40, containerRef: ref }),
        );

        expect(result.current.scaled).toBe(false);
        expect(contentHeight(result.current)).toBe(200_000);

        await scrollTo(ref, 4_000);
        expect(result.current.firstVisibleIndex).toBe(100);
    });

    it('keeps the scrolling area inside what a browser will render', () => {
        const ref = container(400);
        const { result } = renderHook(() =>
            useVirtualRows({ count: 10_000_000, rowHeight: 40, containerRef: ref }),
        );

        // Four hundred million pixels is roughly twenty-four times Chrome's limit, and it fails by
        // silently clipping rather than by complaining.
        expect(result.current.scaled).toBe(true);
        expect(contentHeight(result.current)).toBeLessThanOrEqual(15_000_000);
    });

    it('reaches the last row of ten million', async () => {
        const ref = container(400);
        const { result } = renderHook(() =>
            useVirtualRows({ count: 10_000_000, rowHeight: 40, containerRef: ref }),
        );

        await scrollTo(ref, contentHeight(result.current) - 400);

        expect(result.current.endIndex).toBe(10_000_000);
        expect(result.current.firstVisibleIndex).toBeGreaterThan(9_999_900);
    });

    it('lands on the row `scrollToIndex` asked for, scaled or not', async () => {
        const ref = container(400);
        const { result } = renderHook(() =>
            useVirtualRows({ count: 10_000_000, rowHeight: 40, containerRef: ref }),
        );

        act(() => result.current.scrollToIndex(4_000_000));
        await scrollTo(ref, ref.current.scrollTop);

        // Scaled, a pixel covers several rows, so the answer is close rather than exact. Close
        // enough that the row asked for is on screen is the whole promise.
        expect(Math.abs(result.current.firstVisibleIndex - 4_000_000)).toBeLessThan(1_000);
    });

    it('renders a window rather than the whole count, wherever it is', async () => {
        const ref = container(400);
        const { result } = renderHook(() =>
            useVirtualRows({ count: 10_000_000, rowHeight: 40, containerRef: ref }),
        );

        await scrollTo(ref, 7_000_000);
        expect(result.current.endIndex - result.current.startIndex).toBeLessThan(40);
    });
});
