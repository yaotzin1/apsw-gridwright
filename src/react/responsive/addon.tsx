import { useState } from 'react';
import type { GridAddon } from '../addons/types';
import { WidthProvider } from './context';
import { RESPONSIVE_ADDON, responsiveMessages } from './messages';
import { HiddenQueryNote, StackedSortControl } from './StackedControls';
import type { ResponsiveOptions } from './types';

export { RESPONSIVE_ADDON, responsiveMessages };

/** `virtualRows()`'s name. A literal, so this add-on does not pull the windowing code into its bundle. */
const VIRTUAL_ROWS = 'gridwright:virtual';

/**
 * Lets the grid respond to the width of its container instead of the window's.
 *
 * It measures the root with one `ResizeObserver` and does these things with the number: hides the
 * columns that declare `responsive.hideBelow`, lets go of pinning when the pinned columns would take
 * more than half the width, draws the rows as cards below `stackBelow`, and shares the width through
 * `useContainerWidth()`.
 *
 * None of it touches the query. A hidden column is still sorted, filtered, searched and exported,
 * and the reader's saved column layout never sees the width.
 */
export function responsive<TRow>(options: ResponsiveOptions = {}): GridAddon<TRow> {
    return {
        name: RESPONSIVE_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useResponsiveSetup({ options: gridOptions, addons }) {
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

            // Stacking needs rows of any height, and `virtualRows()` places rows by a fixed one: it
            // keeps the table and says nothing, because a layout choice is not an error.
            const stacked =
                options.stackBelow !== undefined && width !== null && width < options.stackBelow && !addons.includes(VIRTUAL_ROWS);
            const hiddenColumns = new Set([...hideBelow.keys()].filter(hiddenAt));

            return {
                messages: responsiveMessages,
                containerWidth: width,
                viewHiddenColumns: () => hiddenColumns,
                cardLayout: stacked,
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
                    ...(stacked ? { 'data-gw-stacked': '' } : {}),
                    ...(pinsCapped ? { 'data-gw-pins-capped': '' } : {}),
                }),
                // The sort control the header buttons would have been, and the note for a sort or a
                // filter on a column that is not drawn.
                toolbar: () => (stacked ? <StackedSortControl /> : null),
                // Above the table rather than in the toolbar's status: a status shows only while the toolbar
                // is there for something else, and this must be said whatever else the grid has.
                aboveTable: () => (hiddenColumns.size > 0 ? <HiddenQueryNote hidden={hiddenColumns} /> : null),

                tableAttributes: () => (stacked ? { className: 'gw-table--stacked' } : {}),
                // `display: block` drops table semantics in several browsers, so the roles are stated.
                // The header cells stay in the document, visually hidden, so each value still has its
                // column header: that is how the label reaches assistive technology exactly once.
                rowAttributes: () => (stacked ? { role: 'row' } : {}),
                headerAttributes: (column) => ({
                    ...(stacked ? { role: 'columnheader' } : {}),
                    ...(hiddenAt(column.id) ? { 'data-gw-hidden': '' } : {}),
                }),
                extraHeaderAttributes: () => (stacked ? { role: 'columnheader' } : {}),
                cellAttributes: (_row, column) => ({
                    ...(stacked ? { role: 'gridcell', 'data-gw-label': column.header } : {}),
                    ...(hiddenAt(column.id) ? { 'data-gw-hidden': '' } : {}),
                }),
                extraCellAttributes: () => (stacked ? { role: 'gridcell' } : {}),
            };
        },
    };
}
