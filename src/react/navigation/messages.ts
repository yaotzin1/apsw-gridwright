export const CELL_NAVIGATION_ADDON = 'gridwright:cell-navigation';

/*
 * No strings yet, and that is the point: navigation announces nothing.
 *
 * The browser already says what a focused cell is -- its column header, its row position and its
 * text -- so a live region repeating it would speak over the browser on every arrow key. The
 * add-on's first strings arrive with clipboard copy, which does have something to report.
 */
