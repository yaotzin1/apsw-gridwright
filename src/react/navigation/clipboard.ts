import { buildExportTable, escapeMarkup, formatCsv } from '../../core/export';
import type { ExportTable } from '../../core/export';
import type { ColumnValue, ResolvedColumn } from '../../core/types';

/**
 * What one copy puts on the clipboard: the same rows twice, once for a text editor and once for a
 * spreadsheet. Excel, Numbers, Google Sheets, Word and Notion all read the HTML flavour when it is
 * there, which is what keeps a cell holding a tab or a newline in one cell.
 */
export interface ClipboardPayload {
    readonly text: string;
    readonly html: string;
    /** Rows copied, or null for a single cell. What the announcement says. */
    readonly rows: number | null;
}

/**
 * Whether a keydown is the platform's copy shortcut, without asking which platform this is.
 *
 * Sniffing the operating system goes wrong in both directions: an iPad with a keyboard reports
 * itself as a Mac, and a Linux desktop with a remapped Super key does not. So both answers are
 * accepted -- `Ctrl` for Windows, Linux and ChromeOS, `Cmd` for macOS and iPadOS -- and so is
 * `Ctrl+Insert`, which Windows and most Linux desktops still treat as copy.
 *
 * The letter is read from `key`, which is what the layout typed, so a Dvorak or AZERTY reader
 * presses the C their keyboard shows. Only when `key` is not a Latin letter at all -- a Cyrillic,
 * Greek or Hebrew layout, where it is `с`, `ψ` or `ב` -- does the physical position decide, which
 * is what the operating system itself does for its shortcuts on those layouts.
 *
 * `Alt` is refused because Windows reports `AltGr` as `Ctrl+Alt`: on a Polish keyboard `AltGr+C`
 * types `ć`, and treating it as copy would swallow a letter. `Shift` is refused because
 * `Ctrl+Shift+C` belongs to the browser's developer tools.
 */
export function isCopyShortcut(event: {
    readonly key: string;
    readonly code?: string;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
    readonly shiftKey: boolean;
}): boolean {
    if (event.altKey || event.shiftKey) return false;
    if (!event.ctrlKey && !event.metaKey) return false;
    if (event.key === 'Insert') return event.ctrlKey;
    if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase() === 'c';
    return event.code === 'KeyC';
}

/*
 * Text flavour. A line feed, not RFC 4180's CRLF: it is what Google Sheets and the browsers' own
 * copy produce, every spreadsheet on every platform splits rows on it, and a CRLF pasted into a
 * macOS or Linux terminal or editor arrives with a stray carriage return on every line. No byte
 * order mark either -- in a file it tells Excel the encoding, and on a clipboard, which carries
 * Unicode already, it would be pasted as an invisible character at the start of the first cell.
 */
const TEXT_OPTIONS = { delimiter: '\t', newline: '\n', bom: false } as const;

/** The apostrophe `formatCsv` puts before a cell a spreadsheet would run as a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * HTML flavour: a bare table, every cell and header escaped.
 *
 * The charset is declared because Excel for Mac reads an undeclared HTML clipboard as Mac Roman,
 * which turns every accented name into two wrong characters. The formula guard applies here too:
 * a spreadsheet given both flavours pastes this one, so guarding only the text would guard nothing.
 */
function formatHtml(table: ExportTable, header: boolean): string {
    const cell = (tag: 'th' | 'td', text: string, guard: boolean) =>
        `<${tag}>${escapeMarkup(guard && FORMULA_LEAD.test(text) ? `'${text}` : text)}</${tag}>`;
    const head = header
        ? `<thead><tr>${table.columns.map((column) => cell('th', column.header, false)).join('')}</tr></thead>`
        : '';
    const body = table.rows.map((row) => `<tr>${row.text.map((text) => cell('td', text, true)).join('')}</tr>`).join('');
    return `<meta charset="utf-8"><table>${head}<tbody>${body}</tbody></table>`;
}

/**
 * Rows as a table with its header row, resolved exactly as an export resolves them -- the same
 * columns, the same `exportValue`, the same formula guard -- so a copied cell reads the way it
 * reads in the downloaded file.
 */
export function copyRows<TRow>(
    rows: readonly TRow[],
    columns: readonly ResolvedColumn<TRow, ColumnValue>[],
): ClipboardPayload | null {
    const table = buildExportTable({ rows, columns });
    if (table.columns.length === 0 || table.rows.length === 0) return null;
    return { text: formatCsv(table, TEXT_OPTIONS), html: formatHtml(table, true), rows: table.rows.length };
}

/**
 * One cell's text, no header: what a reader pasting a single value into a form field expects.
 *
 * Null for a column that is hidden or opted out of export -- an actions column, say -- because
 * `exportable: false` is the developer saying this text is not data.
 */
export function copyCell<TRow>(row: TRow, column: ResolvedColumn<TRow, ColumnValue>): ClipboardPayload | null {
    const table = buildExportTable({ rows: [row], columns: [column] });
    if (table.columns.length === 0) return null;
    return { text: formatCsv(table, { ...TEXT_OPTIONS, header: false }), html: formatHtml(table, false), rows: null };
}
