import { escapeMarkup } from './escape';
import type { ExportTable, PrintOptions } from './types';

/**
 * The stylesheet the printable document carries with it.
 *
 * Self-contained on purpose. The package's own stylesheet is an optional import, the print
 * document is rendered outside the page it came from, and a printed table with no rules at all is
 * unreadable. `table-header-group` is what repeats the header on every sheet of paper, and the
 * two `break-inside` rules are what stop a row being cut in half by a page boundary.
 */
const DEFAULT_STYLES = `
    @page { size: auto; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        font: 12px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
        color: #111;
    }
    h1 { font-size: 15px; margin: 0 0 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
        border-bottom: 1px solid #d4d4d4;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
    }
    th { border-bottom-width: 2px; font-weight: 600; }
    td.gw-print-end, th.gw-print-end { text-align: right; }
    td.gw-print-center, th.gw-print-center { text-align: center; }
    h2 { font-size: 13px; margin: 16px 0 6px; font-weight: 600; }
    h3, h4, h5, h6 { font-size: 12px; margin: 14px 0 6px; font-weight: 600; }
    p { margin: 0 0 8px; }
    ul, ol { margin: 0 0 8px; padding-inline-start: 20px; }
    blockquote {
        margin: 0 0 8px;
        padding-inline-start: 10px;
        border-inline-start: 3px solid #d4d4d4;
        color: #444;
    }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    pre {
        margin: 0 0 8px;
        padding: 8px;
        background: #f4f4f5;
        white-space: pre-wrap;
        break-inside: avoid;
    }
    hr { border: 0; border-top: 1px solid #d4d4d4; margin: 12px 0; }
    a { color: #1d4ed8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

/**
 * The printable document every print export is wrapped in.
 *
 * One page of markup around a body somebody else produced, with its own stylesheet, because the
 * package's stylesheet is an optional import and the document is opened outside the page it came
 * from. A table goes in through `formatPrintHtml`; a rendered Markdown report goes in through
 * `formatMarkdownDocument`; both print the same way.
 */
export function formatPrintDocument(body: string, options: PrintOptions = {}): string {
    const title = escapeMarkup(options.title ?? 'Export');
    const lang = escapeMarkup(options.lang ?? 'en');
    const dir = options.direction === 'rtl' ? ' dir="rtl"' : '';

    return `<!doctype html>
<html lang="${lang}"${dir}>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${options.styles ?? DEFAULT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * A standalone HTML document of the exported rows.
 *
 * Built from the table rather than from the live grid, for two reasons that both produce a wrong
 * file otherwise. A windowed grid holds only the rows on screen in the document, so printing it
 * prints forty rows and two spacers. And the page around the grid, its navigation and its
 * chrome, is not part of the export.
 */
export function formatPrintHtml(table: ExportTable, options: PrintOptions = {}): string {
    const title = escapeMarkup(options.title ?? 'Export');

    const header = table.columns
        .map((column) => `<th${alignClass(column.align)}>${escapeMarkup(column.header)}</th>`)
        .join('');

    const rows = table.rows
        .map(
            (row) =>
                `<tr>${row.text
                    .map(
                        (cell, index) =>
                            `<td${alignClass(table.columns[index]?.align ?? 'start')}>${escapeMarkup(cell)}</td>`,
                    )
                    .join('')}</tr>`,
        )
        .join('\n');

    return formatPrintDocument(
        `<h1>${title}</h1>
<table>
<thead><tr>${header}</tr></thead>
<tbody>
${rows}
</tbody>
</table>`,
        options,
    );
}

const alignClass = (align: 'start' | 'center' | 'end'): string =>
    align === 'end' ? ' class="gw-print-end"' : align === 'center' ? ' class="gw-print-center"' : '';
