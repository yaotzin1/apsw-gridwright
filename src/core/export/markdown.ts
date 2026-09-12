import { toText } from '../values';
import type { ColumnValue, ResolvedColumn } from '../types';
import type { ExportTable, MarkdownTemplateOptions } from './types';
import { exportableColumns } from './table';

/**
 * A GitHub Flavored Markdown table.
 *
 * Cells are escaped for the two characters that break the row: a pipe ends the cell, and a newline
 * ends the row, so a multi-line cell becomes `<br>` rather than a table that stops halfway.
 */
export function formatMarkdownTable(table: ExportTable): string {
    const header = `| ${table.columns.map((column) => cell(column.header)).join(' | ')} |`;
    const divider = `| ${table.columns.map((column) => rule(column.align)).join(' | ')} |`;
    const rows = table.rows.map((row) => `| ${row.text.map(cell).join(' | ')} |`);

    return [header, divider, ...rows].join('\n');
}

/**
 * A document: one rendered block per row, with a header and a footer around them.
 *
 * The template resolves `{columnId}` through the same export text as every other format, so a
 * column with an `exportValue` reads the same in a release note as it does in a spreadsheet. The
 * header and footer describe the document instead of a row, so they are written as they are.
 *
 * This is the report template. Fill it from the rows here, render it with `markdownToHtml`, and
 * print it for a PDF, or send the Markdown to a service that makes one.
 */
export function formatMarkdownTemplate<TRow>(options: MarkdownTemplateOptions<TRow>): string {
    const separator = options.separator ?? '\n';
    const { template } = options;

    const body =
        typeof template === 'function'
            ? options.rows.map((row, index) => template(row, index)).join(separator)
            : fromTemplate(options, template, separator);

    // A blank line between the parts, because Markdown needs one to end a block: a heading written
    // directly above the first row would otherwise swallow it.
    return [section(options.header, options.rows), body, section(options.footer, options.rows)]
        .filter((part) => part !== '')
        .join('\n\n');
}

const section = <TRow>(
    part: string | ((rows: readonly TRow[]) => string) | undefined,
    rows: readonly TRow[],
): string => (typeof part === 'function' ? part(rows) : (part ?? ''));

function fromTemplate<TRow>(
    options: MarkdownTemplateOptions<TRow>,
    template: string,
    separator: string,
): string {
    const columns = new Map(
        exportableColumns(options.columns).map((column) => [column.id, column] as const),
    );

    return options.rows
        .map((row) =>
            // An unknown placeholder is left as it was written. Replacing it with an empty string
            // would hide the typo in a file nobody reads twice.
            template.replaceAll(/\{([^{}]+)\}/g, (match, id: string) => {
                const column = columns.get(id);
                return column ? text(column, row) : match;
            }),
        )
        .join(separator);
}

function text<TRow>(column: ResolvedColumn<TRow, ColumnValue>, row: TRow): string {
    const value = column.getValue(row);
    if (column.exportValue) return column.exportValue(value, row);
    return column.getText ? column.getText(row) : toText(value);
}

const cell = (value: string): string =>
    value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, '<br>');

const rule = (align: 'start' | 'center' | 'end'): string =>
    align === 'center' ? ':---:' : align === 'end' ? '---:' : ':---';
