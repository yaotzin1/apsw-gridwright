import type { AddonMessages } from '../../i18n/messages';
import { defineAddon } from '../addon';
import type { ViewAddon } from '../addon';
import { ariaSortOf, sortAnnouncement, sortPriorityOf, sortTitleOf } from '../behaviour/sorting';
import { h } from '../node';
import type { ViewNode } from '../node';

export const SORTING_ADDON = 'gridwright:sorting';

/** English strings, plain data with no framework in them, so locale packs and every adapter read the same. */
export const sortingMessages: AddonMessages = {
    en: {
        ascending: 'Sort ascending',
        descending: 'Sort descending',
        clear: 'Clear sort',
        // Announced through the live region rather than rendered. `aria-sort` records the sort on a
        // header cell the reader has already left, so activating the control is otherwise silent.
        sortedAscending: '{column}, sorted ascending',
        sortedDescending: '{column}, sorted descending',
        sortCleared: '{column}, not sorted',
        // Spoken instead of the two above while more than one column is sorted, so a reader can
        // tell a column added to the sort from a sort that replaced the previous one.
        sortedAscendingPriority: '{column}, sort priority {priority}, sorted ascending',
        sortedDescendingPriority: '{column}, sort priority {priority}, sorted descending',
        // The button's title while multi-sort is on. `{action}` is one of the three strings above.
        // Shift adds an unsorted column, flips an ascending one and removes a descending one; what
        // holds in every state is that the other sorted columns stay.
        actionWithShift: '{action} (Shift: keep other columns sorted)',
    },
};

export interface SortingOptions {
    /** Shift-activating a header adds its column to the sort instead of replacing it. Default true. */
    readonly multiSort?: boolean;
}

/**
 * Sorting from the headers, written once for every adapter: a real button owning each sortable
 * header's label, `aria-sort` on the cell, and a sentence in the live region naming the column the
 * reader just sorted.
 *
 * `aria-sort` goes on the cell rather than the button because that is where assistive technology
 * looks for it, and the control is a `<button>` so keyboard users reach it by tabbing rather than by
 * guessing that a `<th>` is clickable.
 */
export function sorting<TRow>(options: SortingOptions = {}): ViewAddon<TRow> {
    const multiSort = options.multiSort !== false;

    return defineAddon<TRow>({
        name: SORTING_ADDON,
        setup: () => ({
            messages: sortingMessages,
            headerLabel: (column, grid): ViewNode => {
                const content = h('span', { attrs: { className: 'gw-header-label' } }, grid.headerContent(column));
                if (!column.sortable) return content;

                const t = grid.messages(SORTING_ADDON, sortingMessages);
                const direction = grid.api.getSort(column.id);
                const priority = direction === null ? 0 : sortPriorityOf(grid.api.getState().query.sort, column.id);

                return h(
                    'button',
                    {
                        attrs: {
                            type: 'button',
                            className: 'gw-sort-button',
                            // Out of the Tab order while header-row navigation visits the header: the cell
                            // takes the focus and `Enter` operates this button.
                            tabIndex: grid.headerControlTabIndex,
                            title: sortTitleOf(direction, multiSort, t),
                        },
                        on: { click: (event) => void grid.api.toggleSort(column.id, { additive: multiSort && event.shiftKey }) },
                    },
                    content,
                    h('span', { attrs: { className: 'gw-sort-indicator', 'aria-hidden': 'true', 'data-direction': direction ?? 'none' } }),
                    // Hidden, so the button's name stays the header text; the announcement speaks the priority.
                    priority > 0 ? h('span', { attrs: { className: 'gw-sort-priority', 'aria-hidden': 'true' } }, String(priority)) : null,
                );
            },
            headerAttributes: (column, grid) => (column.sortable ? { 'aria-sort': ariaSortOf(grid.api.getSort(column.id)) } : {}),
            announce: [sortAnnouncement<TRow>()],
        }),
    });
}
