import type { RowNumbering } from './types';

/**
 * The ARIA row numbering, in one place because two bodies render it.
 *
 * WAI-ARIA counts every row of the table, header rows included, and the APG grid examples give the
 * header row `aria-rowindex="1"`. So a data row's index is its zero-based position in the whole
 * result set, plus one to make it one-based, plus one more for the header row above it. The count
 * is the total plus that same header row.
 *
 * This used to be spelled out in the virtual body alone, as `absolute + 1`, against an
 * `aria-rowcount` that did not count the header. The two disagreed by one and the paginated body
 * emitted no index at all, which is how a reader on page two was told they were on row one.
 */
export function rowNumbering(totalRows: number, isTotalExact: boolean): RowNumbering {
    return {
        // -1 is the ARIA value for "the total is not known", which is exactly what an inexact
        // total is. Publishing a count derived from one page would be inventing a number.
        rowCount: isTotalExact ? totalRows + 1 : -1,
        indexOf: (absolutePosition: number) => absolutePosition + 2,
    };
}
