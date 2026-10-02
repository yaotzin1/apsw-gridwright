import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const WidthContext = createContext<number | null>(null);

/**
 * The width of the grid's container in pixels, or `null` until it is known (and always `null` when
 * `responsive()` is not listed). Read it from a cell, a toolbar control or an add-on's own component
 * to adapt to the space the grid has, rather than to the window's.
 */
export function useContainerWidth(): number | null {
    return useContext(WidthContext);
}

export interface WidthMeasure {
    readonly width: number;
    readonly pinnedWidth: number;
}

export interface WidthProviderProps {
    readonly width: number | null;
    readonly onMeasure: (measure: WidthMeasure) => void;
    readonly children: ReactNode;
}

/**
 * Shares the width and measures it.
 *
 * The sentinel is a zero-size absolutely positioned element, so it takes no part in the root's flex
 * layout and adds no gap. It does not take the table wrapper's ref, which only one add-on may hold:
 * it finds the root with `closest` instead.
 */
export function WidthProvider({ width, onMeasure, children }: WidthProviderProps) {
    const sentinel = useRef<HTMLSpanElement | null>(null);
    const report = useRef(onMeasure);
    report.current = onMeasure;

    // Created and disconnected in the effect, so Strict Mode's mount, destroy, mount leaves exactly
    // one live observer.
    useLayoutEffect(() => {
        const root = sentinel.current?.closest<HTMLElement>('.gw-root');
        if (!root || typeof ResizeObserver === 'undefined') return;
        const measure = (): void => {
            const style = getComputedStyle(root);
            const inner = root.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd);
            report.current({
                width: Math.round(Number.isFinite(inner) ? inner : root.clientWidth),
                pinnedWidth: pinnedWidthOf(root),
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    // After every render: pinning can change without the container resizing.
    useLayoutEffect(() => {
        const root = sentinel.current?.closest<HTMLElement>('.gw-root');
        if (root && width !== null) report.current({ width, pinnedWidth: pinnedWidthOf(root) });
    });

    return (
        <WidthContext.Provider value={width}>
            <span ref={sentinel} aria-hidden="true" className="gw-sentinel" />
            {children}
        </WidthContext.Provider>
    );
}

/** The summed width of the pinned header cells, which are in the DOM for as long as they are pinned. */
function pinnedWidthOf(root: HTMLElement): number {
    let total = 0;
    for (const cell of root.querySelectorAll<HTMLElement>('thead [data-pinned]')) total += cell.offsetWidth;
    return total;
}
