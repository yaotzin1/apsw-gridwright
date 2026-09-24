import type { CsvOptions, ExportTable } from './types';

/**
 * Excel, Sheets and Calc evaluate a cell starting with formula triggers (`=`, `+`, `-`, `@`, `|`, `%`),
 * even when preceded by leading whitespace or control characters.
 */
function isFormulaCell(value: string): boolean {
    let index = 0;
    while (index < value.length && value.charCodeAt(index) <= 0x20) {
        index += 1;
    }
    const char = value[index];
    return char !== undefined && '=+-@\t\r|%'.includes(char);
}

/**
 * RFC 4180 delimiter-separated text.
 *
 * Two things here are not decoration. A field containing the delimiter, a quote or a newline is
 * quoted and its own quotes doubled, or one comma in a person's job title shifts every column
 * after it. And a cell that a spreadsheet would evaluate as a formula is prefixed, because an
 * export is opened by a person who did not write the rows.
 */
export function formatCsv(table: ExportTable, options: CsvOptions = {}): string {
    const delimiter = options.delimiter ?? ',';
    const newline = options.newline ?? '\r\n';
    const escapeFormulas = options.escapeFormulas ?? true;
    const lines: string[] = [];

    if (options.header ?? true) {
        lines.push(table.columns.map((column) => field(column.header, delimiter, false)).join(delimiter));
    }

    for (const row of table.rows) {
        lines.push(row.text.map((cell) => field(cell, delimiter, escapeFormulas)).join(delimiter));
    }

    const body = lines.join(newline);
    return (options.bom ?? true) ? `\uFEFF${body}` : body;
}

function field(value: string, delimiter: string, escapeFormulas: boolean): string {
    const guarded = escapeFormulas && isFormulaCell(value) ? `'${value}` : value;
    const needsQuotes =
        guarded.includes(delimiter) ||
        guarded.includes('"') ||
        guarded.includes('\n') ||
        guarded.includes('\r');

    return needsQuotes ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}
