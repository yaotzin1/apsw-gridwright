import { useState } from 'react';
import type { GridAddon } from '../addons/types';
import { WidthProvider } from './context';
import type { ResponsiveOptions } from './types';

export const RESPONSIVE_ADDON = 'gridwright:responsive';

/**
 * Lets the grid respond to the width of its container instead of the window's.
 *
 * It measures the root with one `ResizeObserver` and does three things with the number: hides the
 * columns that declare `responsive.hideBelow`, lets go of pinning when the pinned columns would take
 * more than half the width, and shares the width through `useContainerWidth()`.
 *
 * None of it touches the query. A hidden column is still sorted, filtered, searched and exported,
 * and the reader's saved column layout never sees the width.
 */
export function responsive<TRow>(options: ResponsiveOptions = {}): GridAddon<TRow> {
    return {
        name: RESPONSIVE_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useResponsiveSetup({ options: gridOptions }) {
            const [width, setWidth] = useState<number | null>(options.initialWidth ?? null);
            const [pinsCapped, setPinsCapped] = useState(false);

            const hideBelow = new Map<string, number>();
            for (const column of gridOptions.columns) {
                if (column.responsive?.hideBelow !== undefined) hideBelow.set(column.id, column.responsive.hideBelow);
            }
            const hiddenAt = (columnId: string): boolean => {
                const limit = hideBelow.get(columnId);
                return limit !== undefined && width !== null && width < limit;
            };

            return {
                containerWidth: width,
                provide: (children) => (
                    <WidthProvider
                        width={width}
                        onMeasure={({ width: next, pinnedWidth }) => {
                            setWidth(next);
                            // Pinned columns that take more than half the container leave no room to
                            // scroll the rest: they are let go at this width, the reader's pins kept.
                            setPinsCapped(pinnedWidth > next / 2);
                        }}
                    >
                        {children}
                    </WidthProvider>
                ),
                rootAttributes: () => ({
                    'data-gw-responsive': '',
                    ...(pinsCapped ? { 'data-gw-pins-capped': '' } : {}),
                }),
                headerAttributes: (column) => (hiddenAt(column.id) ? { 'data-gw-hidden': '' } : {}),
                cellAttributes: (_row, column) => (hiddenAt(column.id) ? { 'data-gw-hidden': '' } : {}),
            };
        },
    };
}
