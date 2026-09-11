import type { AnnouncementInput } from './types';

/**
 * The one sentence the live region carries.
 *
 * A live region is read out in full on every change, so the discipline that matters is that it
 * says one thing. Putting `aria-live` on the tbody instead would announce every cell of every row
 * on every page change, which is the most common way a grid becomes unusable with a screen reader
 * while looking conscientious about it.
 *
 * The priority order is fixed by `specs/react-only-accessible-state/events.md`, and the reason for
 * it is that a sort the reader just caused outranks a row count they did not ask about.
 */
export function announcementFor(input: AnnouncementInput): string {
    const { labels } = input;

    // A fetch is in flight. Anything else said now describes rows that are about to be replaced.
    if (input.status === 'loading' || input.status === 'refreshing') return labels.loading;

    // Announced whether or not stale rows are still on screen. The `role="alert"` in the body only
    // renders when there are none, so a failed refresh over a full page was silent.
    if (input.status === 'error') return labels.errorTitle;

    if (input.sortChange) {
        return labels.sortAnnouncement(input.sortChange.columnHeader, input.sortChange.direction);
    }

    if (input.rowCount === 0) return labels.empty;

    // A virtualized grid has no meaningful range: the rows in the DOM are a window onto the result,
    // and reading the window's bounds aloud tells the reader where the scroller is, not where they
    // are. The total is the fact worth having.
    if (!input.paginated) return labels.rowsTotal(input.totalRows);

    const from = input.firstRowIndex + 1;
    const to = input.firstRowIndex + input.rowCount;
    return labels.rowsShown(from, to, input.totalRows, input.isTotalExact);
}
