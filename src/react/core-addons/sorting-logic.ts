import type { GridState, SortDirection, SortSpec } from '../../core/types';
import type { TranslateValues } from '../../i18n/translator';
import type { AnnouncementChange, AnnouncementContributor } from '../addons/types';

/**
 * What the sorting add-on decides, with no renderer: the `aria-sort` value, the control's title,
 * the priority badge and the sentence for the live region. The native sort button and any other
 * view of it call these, so a sort is announced and labelled the same whichever control drew it.
 */

/** The header cell's `aria-sort`. On the cell, not the button: that is where assistive technology looks. */
export function ariaSortOf(direction: SortDirection | null): 'ascending' | 'descending' | 'none' {
    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
}

/** The message key for what activating the control will do: the next action, not the current state. */
export function nextSortAction(direction: SortDirection | null): 'ascending' | 'descending' | 'clear' {
    return direction === null ? 'ascending' : direction === 'asc' ? 'descending' : 'clear';
}

/**
 * The control's title: the next action, and while multi-sort is on, what Shift does.
 *
 * `t` resolves the `gridwright:sorting` messages.
 */
export function sortTitleOf(
    direction: SortDirection | null,
    multiSort: boolean,
    t: (key: string, values?: TranslateValues) => string,
): string {
    const action = t(nextSortAction(direction));
    return multiSort ? t('actionWithShift', { action }) : action;
}

/**
 * The 1-based place of a column in the sort, for its badge, or 0 for no badge.
 *
 * A priority means something only against another sorted column, so a single sort shows none.
 */
export function sortPriorityOf(sort: readonly SortSpec[], columnId: string): number {
    if (sort.length < 2) return 0;
    return sort.findIndex((spec) => spec.columnId === columnId) + 1;
}

const sortSignature = (state: GridState<unknown>): string =>
    state.query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(',');

/**
 * The one column whose sort changed, named by its header.
 *
 * Sorting is usually one column at a time, and where it is not, the column the reader just
 * activated is the one that differs from the previous query. A multi-column sort where several
 * change at once comes from `setSort`, which the reader did not press, so naming the first is as
 * good an answer as any and better than naming none.
 */
function describeSort<TRow>({ previous, next, headers, t }: AnnouncementChange<TRow>): string | null {
    const before = new Map(previous?.query.sort.map((spec: SortSpec) => [spec.columnId, spec.direction]) ?? []);
    const after = new Map(next.query.sort.map((spec) => [spec.columnId, spec.direction]));

    let priority = 0;
    for (const [columnId, direction] of after) {
        priority += 1;
        if (before.get(columnId) !== direction) {
            const column = headers.get(columnId) ?? columnId;
            // With one sorted column its priority is noise, and the sentence stays as it always was.
            if (after.size === 1) return t(direction === 'asc' ? 'sortedAscending' : 'sortedDescending', { column });
            return t(direction === 'asc' ? 'sortedAscendingPriority' : 'sortedDescendingPriority', { column, priority });
        }
    }
    // Nothing added or redirected, so anything that differs was cleared.
    for (const columnId of before.keys()) {
        if (!after.has(columnId)) return t('sortCleared', { column: headers.get(columnId) ?? columnId });
    }
    return null;
}

/**
 * The sort's sentence for the grid's live region. `aria-sort` records the sort on a header cell the
 * reader has already left, so without this activating the control is silent.
 */
export function sortAnnouncement<TRow>(): AnnouncementContributor<TRow> {
    return {
        // Above column filters: both are caused by the reader from a header, and a sort is the one
        // a row count says nothing about.
        priority: 20,
        key: (state) => sortSignature(state),
        describe: (change) => describeSort(change),
    };
}
