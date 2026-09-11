import { classes, useGridwrightContext } from '../context';

/**
 * The banner shown when a refresh failed and the previous rows are still on screen.
 *
 * `keepPreviousData` is on by default, because losing the reader's place buys nothing. The cost of
 * that choice is that the grid goes on presenting rows which are no longer current, and without
 * this it does so in complete silence: the `role="alert"` in the body only renders when the grid
 * has no rows left, so a failed refresh over a full page changed nothing a person could see.
 *
 * It sits above the table rather than inside it, so the rows, the header and the column widths do
 * not move. A banner that displaces the data it is warning about makes the reader lose their place,
 * which is the thing `keepPreviousData` exists to prevent.
 *
 * `role="alert"` is what announces it, and it is the only announcement: the live region in
 * `GridRoot` deliberately stays silent for errors, because two announcements of one failure is one
 * too many.
 */
export function GridStaleNotice() {
    const { api, state, classNames, labels } = useGridwrightContext();

    // Only when rows survive. With none left, the body renders the full error state instead, and
    // both at once would state the same failure twice.
    if (state.status !== 'error' || state.rows.length === 0) return null;

    return (
        <div className={classes('gw-stale', classNames.stale)} role="alert">
            <span className="gw-stale-icon" aria-hidden="true">
                !
            </span>

            <span className="gw-stale-text">
                <span className="gw-stale-title">{labels.staleTitle}</span>
                <span className="gw-stale-message">{labels.staleMessage}</span>
            </span>

            {state.error?.retryable && (
                <button type="button" className="gw-button" onClick={() => void api.refresh()}>
                    {labels.retry}
                </button>
            )}
        </div>
    );
}
