/**
 * The "Export formats" panel: choose which formats the menu offers, and write the report template.
 *
 * This file is page UI. The formats themselves are built in `export-formats.js`; this panel only
 * edits the choices passed to it, and prints the code that the choices amount to, so what you try
 * here can be pasted into an application.
 */
import { h } from '../shared/package.js';
import { choice, hint, panel, row, toggle } from '../shared/ui.js';
import { employeeColumns } from './columns.js';
import { REPORTS } from './export-formats.js';

const field = (label, value, onChange, rows) =>
    h('label', { className: 'field' },
        h('span', null, label),
        h('textarea', { value, rows, spellCheck: false, onChange: (event) => onChange(event.target.value) }));

/** The `markdownReportFormats` call the current choices describe, as a developer would write it. */
function codeFor(key, template, outputs) {
    const lines = [
        `import { exportMenu, markdownReportFormats } from 'apsw-gridwright/react';`,
        '',
        '// {count} and {date} are this page\'s convention for header and footer, filled in here.',
        'const fill = (text) => (rows) =>',
        "    text.replaceAll('{count}', String(rows.length)).replaceAll('{date}', new Date().toLocaleDateString());",
        '',
        'const report = markdownReportFormats({',
        `    id: 'acme:${key}',`,
        `    label: ${JSON.stringify(template.label)},`,
        `    header: fill(${JSON.stringify(template.header)}),`,
        `    template: ${JSON.stringify(template.template)},`,
        `    footer: fill(${JSON.stringify(template.footer)}),`,
        `    outputs: ${JSON.stringify(outputs)},`,
        '});',
        '',
        `<Gridwright columns={columns} data={rows} addons={[exportMenu({ formats: ['csv', ...report] })]} />`,
    ];
    return lines.join('\n');
}

/**
 * @param {object} props
 * @param {object} props.choices    `{ report, template, outputs, json, server }`
 * @param {(patch: object) => void} props.update
 */
export function ReportEditor({ choices, update }) {
    const { report, template, outputs } = choices;
    const setOutput = (output, on) =>
        update({ outputs: on ? [...new Set([...outputs, output])] : outputs.filter((entry) => entry !== output) });

    return panel(
        { title: 'Export formats', sources: ['employees/export-formats.js', 'employees/report-editor.js'] },
        row(
            choice('Report template', report, (key) => update({ report: key, ...(REPORTS[key] ? { template: REPORTS[key] } : {}) }), [
                ...Object.entries(REPORTS).map(([key, preset]) => [key, preset.label]),
                ['none', 'no report'],
            ]),
            toggle('as Markdown (.md)', outputs.includes('markdown'), (on) => setOutput('markdown', on), report === 'none'),
            toggle('as PDF', outputs.includes('pdf'), (on) => setOutput('pdf', on), report === 'none'),
            toggle('JSON file', choices.json, (json) => update({ json })),
            toggle('rendered by the server', choices.server, (server) => update({ server }))),

        report !== 'none' && h('div', { className: 'editor' },
            h('div', { className: 'editor-fields' },
                field('Report name', template.label, (label) => update({ template: { ...template, label } }), 1),
                field('Header (once, above the rows)', template.header, (header) => update({ template: { ...template, header } }), 3),
                field('Template (once per row)', template.template, (text) => update({ template: { ...template, template: text } }), 5),
                field('Footer (once, below the rows)', template.footer, (footer) => update({ template: { ...template, footer } }), 2),
                h('p', { className: 'placeholders' },
                    'Per-row placeholders: ',
                    ...employeeColumns.flatMap((column) => [h('code', { key: column.id }, `{${column.id}}`), ' ']),
                    ' Header and footer: ', h('code', null, '{count}'), ' ', h('code', null, '{date}'))),
            h('div', { className: 'editor-code' },
                h('span', null, 'The same report in your application'),
                h('pre', null, h('code', null, codeFor(report, template, outputs))))),

        hint(
            'Open the Export menu on the grid below and the report is there as ',
            h('em', null, `${template.label} (Markdown)`), ' and ', h('em', null, `${template.label} (PDF)`),
            '. Edit the template and the menu uses the new text straight away. The rows are the ones the menu\'s ',
            '"Rows" choice picks, and a placeholder writes the text the column exports, so {salary} writes 138000 ',
            'while the grid shows $138,000. PDF opens the browser\'s print dialog: choose "Save as PDF" there.'));
}
