/** The ARIA row numbering for one table, computed once rather than per row. */
export interface RowNumbering {
    /** `aria-rowcount`: header-inclusive, or -1 when the total is not exact. */
    readonly rowCount: number;
    /** Turns a zero-based absolute row position into its header-inclusive `aria-rowindex`. */
    readonly indexOf: (absolutePosition: number) => number;
}

/**
 * The ARIA row numbering, in one place because every body renders it.
 *
 * WAI-ARIA counts every row of the table, header rows included, and the APG grid examples give the
 * header row `aria-rowindex="1"`. So a data row's index is its zero-based position in the whole
 * result set, plus one to make it one-based, plus one more for the header row above it. The count
 * is the total plus that same header row.
 */
export function rowNumbering(totalRows: number, isTotalExact: boolean): RowNumbering {
    return {
        // -1 is the ARIA value for "the total is not known", which is exactly what an inexact
        // total is. Publishing a count derived from one page would be inventing a number.
        rowCount: isTotalExact ? totalRows + 1 : -1,
        indexOf: (absolutePosition: number) => absolutePosition + 2,
    };
}
