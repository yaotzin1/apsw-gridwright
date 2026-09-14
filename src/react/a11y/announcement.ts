import type { AnnouncementInput } from './types';

/**
 * The one sentence the live region carries.
 *
 * A live region is read out in full on every change, so the discipline that matters is that it
 * says one thing. Putting `aria-live` on the tbody instead would announce every cell of every row
 * on every page change, which is the most common way a grid becomes unusable with a screen reader
 * while looking conscientious about it.
 *
 * The order is fixed: a fetch in flight, then silence on failure, then whatever an add-on says about
 * the change the reader just caused (a sort, a filter), then the rows.
 */
export function announcementFor(input: AnnouncementInput): string {
    const { labels } = input;

    // A fetch is in flight. Anything else said now describes rows that are about to be replaced.
    if (input.status === 'loading' || input.status === 'refreshing') return labels.loading;

    // Silent on failure, because something else is already announcing it. With no rows left the
    // body renders the full error state, and with rows still on screen the stale notice renders
    // the banner; both carry `role="alert"`. Saying it here as well is one failure announced twice.
    if (input.status === 'error') return '';

    // The reader caused it, from a control their focus has already left, and a new row count alone
    // does not say the change was theirs.
    if (input.contributed) return input.contributed;

    if (input.rowCount === 0) return labels.empty;

    // A windowed grid has no meaningful range: the rows in the DOM are a window onto the result,
    // and reading the window's bounds aloud tells the reader where the scroller is, not where they
    // are. The total is the fact worth having.
    if (!input.paginated) return labels.rowsTotal(input.totalRows);

    const from = input.firstRowIndex + 1;
    const to = input.firstRowIndex + input.rowCount;
    return labels.rowsShown(from, to, input.totalRows, input.isTotalExact);
}
