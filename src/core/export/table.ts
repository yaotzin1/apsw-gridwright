import { toText } from '../values';
import type { ColumnValue, ResolvedColumn } from '../types';
import type { BuildExportTableOptions, ExportTable, ExportTableColumn, ExportTableRow } from './types';

/**
 * The columns an export covers: what is on screen, minus what a column opted out of.
 *
 * Hidden columns are left out because an export is of the grid the reader is looking at, and a
 * column they cannot see is not part of it. The selection checkbox, the tree toggle and the row
 * action menu need no opt-out: none of them is a column, they are cells the adapter renders.
 */
export function exportableColumns<TRow>(
    columns: readonly ResolvedColumn<TRow, ColumnValue>[],
): readonly ResolvedColumn<TRow, ColumnValue>[] {
    return columns.filter((column) => !column.hidden && column.exportable !== false);
}

/**
 * Resolves rows and columns into the text every formatter shares.
 *
 * Cell text comes from `exportValue` when the column has one, and from `getText` otherwise, which
 * already applies the column's `formatValue`. Falling back to the raw value instead would export
 * `1700000000000` where the grid shows a date.
 */
export function buildExportTable<TRow>(options: BuildExportTableOptions<TRow>): ExportTable {
    const columns = exportableColumns(options.columns);

    const headers: readonly ExportTableColumn[] = columns.map((column) => ({
        id: column.id,
        header: column.header,
        align: column.align ?? 'start',
        // A width expressed in `ch` or a percentage means nothing to a spreadsheet, so only a
        // number travels and anything else leaves the column to size itself.
        ...(typeof column.width === 'number' ? { width: column.width } : {}),
    }));

    const rows: readonly ExportTableRow[] = options.rows.map((row) => {
        const text: string[] = [];
        const values: ColumnValue[] = [];

        for (const column of columns) {
            const value = column.getValue(row);
            values.push(value);
            text.push(cellText(column, row, value));
        }

        return { text, values };
    });

    return { columns: headers, rows };
}

function cellText<TRow>(
    column: ResolvedColumn<TRow, ColumnValue>,
    row: TRow,
    value: ColumnValue,
): string {
    if (column.exportValue) return column.exportValue(value, row);
    // `getText` is the column's own text: the same string global search matches on and the same
    // one a default cell renders, which is the whole point of exporting through it.
    return column.getText ? column.getText(row) : toText(value);
}
