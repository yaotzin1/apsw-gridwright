import type { ColumnAlign, ColumnValue, ResolvedColumn } from '../types';

/**
 * Which rows an export covers.
 *
 * `all` means every row matching the active query, which is not the same as every row in the
 * source and not the same as what is on screen. `page` is what the reader can see. `selected` is
 * what they ticked, and only the ticked rows that are loaded can be resolved.
 */
export type ExportScope = 'all' | 'page' | 'selected';

export interface ExportTableColumn {
    readonly id: string;
    readonly header: string;
    readonly align: ColumnAlign;
    /** Carried through to the spreadsheet, where a column keeps its width. Pixels, when numeric. */
    readonly width?: number;
}

export interface ExportTableRow {
    /** One entry per column, already resolved to text. */
    readonly text: readonly string[];
    /**
     * The same cells before text conversion.
     *
     * A spreadsheet needs the number to still be a number, or every column arrives as text and
     * the first thing the reader does is convert it back by hand.
     */
    readonly values: readonly ColumnValue[];
}

/**
 * Rows and columns resolved for serialization, once, for every format.
 *
 * Every formatter takes this rather than rows and columns of its own, so a cell reads the same in
 * the spreadsheet and in the printed page, and so the cost of resolving values is paid once when
 * two formats are produced from one export.
 */
export interface ExportTable {
    readonly columns: readonly ExportTableColumn[];
    readonly rows: readonly ExportTableRow[];
}

export interface BuildExportTableOptions<TRow> {
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
}

export interface CsvOptions {
    /** Default `,`. A semicolon is the usual choice for locales where the comma is the decimal mark. */
    readonly delimiter?: string;
    /** Default `\r\n`, which is what RFC 4180 specifies. */
    readonly newline?: string;
    /**
     * Default true. A leading byte order mark is what makes Excel read the file as UTF-8 rather
     * than as the system code page, which is the difference between a name and mojibake.
     */
    readonly bom?: boolean;
    /** Default true. */
    readonly header?: boolean;
    /**
     * Default true. Prefixes a cell that a spreadsheet would evaluate as a formula with an
     * apostrophe.
     *
     * A cell beginning `=`, `+`, `-` or `@` is executed when the file is opened, so a row written
     * by somebody else is a way into the machine of whoever opens the export. Switch it off only
     * for a file that no spreadsheet will open.
     */
    readonly escapeFormulas?: boolean;
}

export interface ExcelOptions {
    /** Default `Sheet1`. */
    readonly sheetName?: string;
}

export interface MarkdownTemplateOptions<TRow> {
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    /**
     * A string with `{columnId}` placeholders, resolved through the same export text as every
     * other format, or a function for anything a template cannot express.
     */
    readonly template: string | ((row: TRow, index: number) => string);
    /** Placed between rendered rows. Default `\n`. */
    readonly separator?: string;
    /**
     * Markdown placed above the rendered rows: a title, an introduction, a note on the source.
     *
     * A function receives the rows the export covers, which is how a heading says how many there
     * are without the count being passed around separately. It describes the document rather than
     * a row, so it carries no `{columnId}` placeholders to resolve.
     */
    readonly header?: string | ((rows: readonly TRow[]) => string);
    /** Markdown placed below them. A signature, a total, the date the report was produced. */
    readonly footer?: string | ((rows: readonly TRow[]) => string);
}

export interface PrintOptions {
    /** The document's title, which browsers use as the default name of the saved file. */
    readonly title?: string;
    /** Replaces the built-in print stylesheet entirely. */
    readonly styles?: string;
    readonly lang?: string;
    readonly direction?: 'ltr' | 'rtl';
}

/** The formats the built-in menu offers. `print` opens the print dialog rather than saving a file. */
export type ExportFormat = 'csv' | 'excel' | 'markdown' | 'print';

/** Media types for the formats that produce a file. */
export const EXPORT_MIME_TYPES = {
    csv: 'text/csv;charset=utf-8',
    excel: 'application/vnd.ms-excel;charset=utf-8',
    markdown: 'text/markdown;charset=utf-8',
    html: 'text/html;charset=utf-8',
} as const;
