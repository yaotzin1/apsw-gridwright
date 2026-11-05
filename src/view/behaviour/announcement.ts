import type { GridError, GridState, GridStatus } from '../../core/types';
import type { TranslateValues } from '../../i18n/translator';

/** The strings the shell's sentence is built from. The grid's `labels` satisfy it. */
export interface AnnouncementLabels {
    readonly loading: string;
    readonly empty: string;
    readonly rowsShown: (from: number, to: number, total: number, exact: boolean) => string;
    readonly rowsTotal: (count: number) => string;
}

/**
 * What the shell's sentence is derived from.
 *
 * Every field is already published on `GridState`. Nothing here asks the engine for anything it
 * does not already say, which is why the feature is invisible across the local/remote seam.
 */
export interface AnnouncementInput {
    readonly status: GridStatus;
    readonly error: GridError | null;
    readonly rowCount: number;
    readonly totalRows: number;
    readonly isTotalExact: boolean;
    /** Zero-based position of the first rendered row in the whole result set. */
    readonly firstRowIndex: number;
    /** False for a windowed grid, where a from-to range describes the scroll position, not the result. */
    readonly paginated: boolean;
    /** The winning add-on sentence for this change, if any add-on had one. */
    readonly contributed: string | null;
    readonly labels: AnnouncementLabels;
}

/**
 * What an announcement contributor is asked about: the settled state before and after a change.
 * `TGrid` is whatever the adapter hands add-ons as "the grid"; the behaviour here never reads it.
 */
export interface AnnouncementChange<TRow, TGrid = unknown> {
    /** The previous settled state, or null for the first one. */
    readonly previous: GridState<TRow> | null;
    readonly next: GridState<TRow>;
    /** Header text by column id, so a change can be named by the header the reader sees. */
    readonly headers: ReadonlyMap<string, string>;
    readonly grid: TGrid;
    /** The contributing add-on's own strings, resolved exactly as the adapter resolves them. */
    readonly t: (key: string, values?: TranslateValues) => string;
}

/**
 * A sentence for the grid's single live region.
 *
 * The shell says "loading" while a fetch is in flight and nothing on error (an alert already speaks).
 * For a settled state every contributor is asked; the highest priority non-null sentence is spoken,
 * and the shell's row range when all return null. Sorting uses 20 and column filters 10.
 */
export interface AnnouncementContributor<TRow, TGrid = unknown> {
    readonly priority: number;
    /**
     * What this contributor's sentence depends on, as a string. The live region is re-evaluated when
     * the shell's own inputs or any contributor's key changes, and not otherwise, so a selection
     * does not repeat the row range. Sorting returns the sort, filters the filters.
     */
    readonly key?: (state: GridState<TRow>) => string;
    readonly describe: (change: AnnouncementChange<TRow, TGrid>) => string | null;
}

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
