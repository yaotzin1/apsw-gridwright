import type { ColumnDef } from '@apsw/gridwright';

/**
 * Cheap identity for a column set.
 *
 * Column arrays are usually written inline in a template, so their reference changes whenever the
 * parent re-renders. Only the parts the engine reads as plain values take part here; functions
 * (`accessor`, `comparator`, `formatValue`, ...) count as "present", the same trade the React
 * adapter makes. A set whose signature did not change is not pushed into the engine, which is
 * what keeps sort, selection and page when the parent re-renders.
 */
export function columnSignature<TRow, TValue>(columns: readonly ColumnDef<TRow, TValue>[]): string {
    return columns
        .map((column) =>
            [
                column.id,
                column.header ?? '',
                typeof column.accessor === 'function' ? 'fn' : String(column.accessor ?? ''),
                column.sortable === false ? '0' : '1',
                column.filterable === false ? '0' : '1',
                column.searchable === false ? '0' : '1',
                column.hidden ? '1' : '0',
                column.width ?? '',
                column.minWidth ?? '',
                column.align ?? '',
                column.exportable === false ? '0' : '1',
            ].join('~'),
        )
        .join('|');
}
