/**
 * Export formats for the employees grid: what the Export menu offers, and how each one is built.
 *
 * In an application these imports are:
 *
 *     import { markdownReportFormats, printMarkdownDocument } from 'apsw-gridwright/react';
 *     import { formatMarkdownTemplate } from 'apsw-gridwright';
 *
 * There are three kinds of format, from least to most code:
 *
 *   1. Built-in       'csv', 'excel', 'markdown', 'print'. Name them in `formats`.
 *   2. A report       one Markdown template over your columns, offered as a .md file and as a PDF,
 *                     by `markdownReportFormats`. See REPORTS below.
 *   3. Your own       `{ id, label, serialize }`. `serialize` receives the rows and returns a file,
 *                     or delivers the export itself and returns nothing. See jsonFile and
 *                     serverReport below.
 *
 * The page puts them together in `exportOptions()` at the bottom of this file.
 */
import { core, gridwright } from '../shared/package.js';

const { markdownReportFormats } = gridwright;
const { formatMarkdownTemplate } = core;

// --- 2. Reports -------------------------------------------------------------------------------------
//
// A template is Markdown with `{columnId}` placeholders. Each placeholder is replaced, per row, by the
// text that column exports: its `exportValue` when it has one, otherwise its `formatValue`. So
// `{salary}` writes 138000 here, because the salary column's `exportValue` says so, while the grid
// shows $138,000. The ids are the ones in `columns.js`: name, department, city, salary, startedOn,
// active.
//
// `header` and `footer` surround the rows and are not filled per row. This page lets them say
// `{count}` and `{date}`, which `withTokens` below fills in; that is a convention of this page, not
// of the package, and shows that header and footer can be functions of the rows.

/** The report templates the page offers. The editor on the page starts from one of these. */
export const REPORTS = {
    cards: {
        label: 'Employee cards',
        header: '# Employee cards\n\n{count} people, as of {date}.\n\n---',
        template: '## {name}\n\n- Department: {department}\n- City: {city}\n- Salary: {salary}\n- Started: {startedOn}',
        footer: '---\n\n*Printed from the grid.*',
    },
    contacts: {
        label: 'Contact list',
        header: '# Contact list\n\n{count} people',
        template: '- **{name}**, {department}, {city}',
        footer: '',
    },
    review: {
        label: 'Salary review',
        header: '# Salary review, {date}\n\n> {count} people. Salaries are annual, in USD.',
        template: '### {name} ({department})\n\nCurrent salary: **{salary}**. Started {startedOn}. Status: {active}.',
        footer: '*Confidential.*',
    },
};

const withTokens = (text) => (rows) =>
    text.replaceAll('{count}', String(rows.length)).replaceAll('{date}', new Date().toLocaleDateString());

/**
 * A report as export formats: one entry per output, in the order given.
 *
 * `markdownReportFormats` does the work: both entries render the same Markdown from the same rows,
 * the Markdown entry downloads `<filename>.md`, and the PDF entry opens the print dialog.
 */
export function reportFormats(key, report, outputs) {
    return markdownReportFormats({
        id: `playground:${key}`,
        label: report.label,
        header: withTokens(report.header),
        template: report.template,
        footer: withTokens(report.footer),
        title: report.label,
        outputs,
    });
}

// --- 3. Formats of your own ---------------------------------------------------------------------------

/** Returns a file: the grid downloads whatever `{ content, mimeType, extension }` describes. */
export const jsonFile = {
    id: 'playground:json',
    label: 'JSON file',
    serialize: ({ rows }) => ({
        content: JSON.stringify(rows, null, 2),
        mimeType: 'application/json',
        extension: '.json',
    }),
};

/**
 * Asks a server to render the report, and saves what it answers with.
 *
 * The route to take when a document has to look identical on every machine: the server renders it
 * (to PDF, in a real application) and the grid saves the bytes. `content` may be a Blob for exactly
 * this. The mock server here renders the Markdown into a printable HTML document, because a PDF
 * engine is not something a demo server should install.
 */
export const serverReport = {
    id: 'playground:server-report',
    label: 'Employee cards, rendered by the server (HTML)',
    name: 'server report',
    serialize: async ({ rows, columns }) => {
        const report = REPORTS.cards;
        const markdown = formatMarkdownTemplate({
            rows,
            columns,
            header: withTokens(report.header),
            template: report.template,
            footer: withTokens(report.footer),
            separator: '\n\n',
        });

        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'text/markdown' },
            body: markdown,
        });
        // Thrown, the grid shows its translated "could not be produced" and passes this to onError.
        if (!response.ok) throw new Error(`The report service answered ${response.status}.`);

        return { content: await response.blob(), mimeType: 'text/html', extension: '.html' };
    },
};

// --- Putting it together ------------------------------------------------------------------------------

/**
 * The `export` prop for the employees grid, from the page's choices.
 *
 * @param {object} choices
 * @param {keyof REPORTS | 'none'} choices.report    which report template, or none
 * @param {object} choices.template                  the template as edited on the page
 * @param {('markdown'|'pdf')[]} choices.outputs     which report outputs to offer
 * @param {boolean} choices.json                     offer the JSON file
 * @param {boolean} choices.server                   offer the server-rendered report
 */
export function exportOptions({ report, template, outputs, json, server }) {
    return {
        filename: 'employees',
        formats: [
            'csv',
            'excel',
            ...(report === 'none' || outputs.length === 0 ? [] : reportFormats(report, template, outputs)),
            ...(json ? [jsonFile] : []),
            ...(server ? [serverReport] : []),
        ],
        // Options for the built-in formats, shown here so they are easy to find:
        csv: { delimiter: ',', bom: true },
        excel: { sheetName: 'Employees' },
    };
}
