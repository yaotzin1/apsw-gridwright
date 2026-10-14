import type { ColumnWindowEntry } from '../addons/types';

export interface GridColumnGapProps {
    /** The gap entry from `renderedColumnsOf(grid)`. */
    readonly entry: Extract<ColumnWindowEntry<unknown>, { kind: 'gap' }>;
    /**
     * True in the header row. The header is the first row of the table, and under fixed table layout
     * the first row is the one the browser takes column widths from, so its gaps are the ones whose
     * width has to be exact: no padding, no border.
     */
    readonly header?: boolean;
}

/**
 * The cell standing in for a run of columns that are not mounted: as wide as all of them, and empty.
 *
 * Hidden from assistive technology, like the spacer rows above and below a row window. The columns it
 * stands in for are still counted by `aria-colcount`, and every mounted cell carries its true
 * `aria-colindex`, so a screen reader is told it is in column 240 of 500, not column 6 of 12.
 */
export function GridColumnGap({ entry, header = false }: GridColumnGapProps) {
    return (
        <td
            aria-hidden="true"
            className={header ? 'gw-column-gap gw-column-gap--header' : 'gw-column-gap'}
            data-gap-columns={entry.columns}
            style={{ width: entry.width, minWidth: entry.width, maxWidth: entry.width, padding: 0 }}
        />
    );
}
