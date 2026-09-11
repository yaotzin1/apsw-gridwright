import { describe, expect, it } from 'vitest';
import { resolveColumns } from '../../src/core/columns';
import {
    buildExportTable,
    formatCsv,
    formatExcelXml,
    formatMarkdownTable,
    formatMarkdownTemplate,
    formatPrintHtml,
} from '../../src/core/export';
import type { ColumnValue } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

const columns = resolveColumns<Person>([
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end', width: 90 },
]);

const table = () => buildExportTable({ rows: people.slice(0, 2), columns });

describe('buildExportTable', () => {
    it('resolves a cell through exportValue, then getText, then the raw value', () => {
        const mixed = resolveColumns<Person>([
            { id: 'salary', header: 'Salary', formatValue: (value) => `$${value}` },
            {
                id: 'department',
                header: 'Department',
                formatValue: () => 'formatted',
                exportValue: (value) => `export:${String(value)}`,
            },
        ]);

        const built = buildExportTable({ rows: people.slice(0, 1), columns: mixed });

        expect(built.rows[0]?.text).toEqual(['$120000', 'export:Engineering']);
        // The value survives beside the text, so a spreadsheet can still type the cell.
        expect(built.rows[0]?.values[0]).toBe(120_000);
    });

    it('leaves out hidden columns and columns that opted out', () => {
        const mixed = resolveColumns<Person>([
            { id: 'name' },
            { id: 'department', hidden: true },
            { id: 'salary', exportable: false },
        ]);

        expect(buildExportTable({ rows: people, columns: mixed }).columns.map((c) => c.id)).toEqual(['name']);
    });

    it('carries a numeric width and drops one expressed in anything else', () => {
        const mixed = resolveColumns<Person>([
            { id: 'name', width: 120 },
            { id: 'department', width: '20%' },
        ]);

        const built = buildExportTable({ rows: [], columns: mixed });
        expect(built.columns[0]?.width).toBe(120);
        expect(built.columns[1]?.width).toBeUndefined();
    });
});

describe('formatCsv', () => {
    it('writes a header and one line per row, with a byte order mark', () => {
        const csv = formatCsv(table());
        const lines = csv.split('\r\n');

        expect(csv.startsWith('﻿')).toBe(true);
        expect(lines[0]).toBe('﻿Name,Department,Salary');
        expect(lines[1]).toBe('Ada Lovelace,Engineering,120000');
        expect(lines).toHaveLength(3);
    });

    it('quotes a field holding the delimiter, a quote or a newline', () => {
        const built = tableOf([['a,b', 'say "hi"', 'two\nlines']]);
        const line = formatCsv(built, { bom: false }).split('\r\n')[1];

        expect(line).toBe('"a,b","say ""hi""","two\nlines"');
    });

    it('respects a different delimiter, newline, and no header', () => {
        const csv = formatCsv(tableOf([['a;b', 'c']]), {
            bom: false,
            header: false,
            delimiter: ';',
            newline: '\n',
        });

        expect(csv).toBe('"a;b";c');
    });

    it('defuses a cell a spreadsheet would run as a formula', () => {
        const csv = formatCsv(tableOf([['=1+1', '+cmd', '-2'], ['@x', 'safe', '']]), { bom: false });
        const [, first, second] = csv.split('\r\n');

        expect(first).toBe("'=1+1,'+cmd,'-2");
        expect(second).toBe("'@x,safe,");
    });

    it('leaves the value alone when the escaping is switched off', () => {
        const csv = formatCsv(tableOf([['=1+1']]), { bom: false, escapeFormulas: false });
        expect(csv.split('\r\n')[1]).toBe('=1+1');
    });
});

describe('formatMarkdownTable', () => {
    it('writes alignment markers from the column alignment', () => {
        const lines = formatMarkdownTable(table()).split('\n');
        expect(lines[1]).toBe('| :--- | :--- | ---: |');
    });

    it('escapes a pipe and folds a newline so the row survives', () => {
        const lines = formatMarkdownTable(tableOf([['a|b', 'two\nlines', '']])).split('\n');
        expect(lines[2]).toBe('| a\\|b | two<br>lines |  |');
    });
});

describe('formatMarkdownTemplate', () => {
    it('resolves placeholders through the same export text', () => {
        const out = formatMarkdownTemplate({
            rows: people.slice(0, 2),
            columns,
            template: '- {name} ({department})',
        });

        expect(out).toBe('- Ada Lovelace (Engineering)\n- Grace Hopper (Engineering)');
    });

    it('leaves an unknown placeholder as it was written', () => {
        const out = formatMarkdownTemplate({
            rows: people.slice(0, 1),
            columns,
            template: '{name} {nope}',
        });

        expect(out).toBe('Ada Lovelace {nope}');
    });

    it('takes a function for anything a template cannot express', () => {
        const out = formatMarkdownTemplate({
            rows: people.slice(0, 2),
            columns,
            template: (row, index) => `${index}. ${row.name}`,
            separator: '\n\n',
        });

        expect(out).toBe('0. Ada Lovelace\n\n1. Grace Hopper');
    });
});

describe('formatExcelXml', () => {
    it('types a number, a boolean and a date, and quotes everything else as a string', () => {
        const built = buildExportTable({
            rows: [{ n: 12, b: true, d: new Date('2024-03-01T10:00:00.000Z'), s: 'text' }],
            columns: resolveColumns([{ id: 'n' }, { id: 'b' }, { id: 'd' }, { id: 's' }]),
        });

        const xml = formatExcelXml(built);

        expect(xml).toContain('<Data ss:Type="Number">12</Data>');
        expect(xml).toContain('<Data ss:Type="Boolean">1</Data>');
        expect(xml).toContain('<Data ss:Type="DateTime">2024-03-01T10:00:00.000</Data>');
        expect(xml).toContain('<Data ss:Type="String">text</Data>');
    });

    it('writes the column text as text when the column formatted it', () => {
        const built = buildExportTable({
            rows: [{ salary: 120_000, active: true }],
            columns: resolveColumns([
                { id: 'salary', formatValue: (value) => `$${value}` },
                { id: 'active', formatValue: (value) => (value ? 'Active' : 'Inactive') },
            ]),
        });

        const xml = formatExcelXml(built);

        // The spreadsheet says what every other format says. A column that formatted its value
        // asked for those words, and a typed cell would quietly disagree with the CSV beside it.
        expect(xml).toContain('<Data ss:Type="String">$120000</Data>');
        expect(xml).toContain('<Data ss:Type="String">Active</Data>');
        expect(xml).not.toContain('ss:Type="Number"');
        expect(xml).not.toContain('ss:Type="Boolean"');
    });

    it('types a formatted column when exportValue gives back the plain value', () => {
        const built = buildExportTable({
            rows: [{ salary: 120_000 }],
            columns: resolveColumns([
                {
                    id: 'salary',
                    formatValue: (value) => `$${value}`,
                    exportValue: (value) => String(value),
                },
            ]),
        });

        expect(formatExcelXml(built)).toContain('<Data ss:Type="Number">120000</Data>');
    });

    it('escapes markup in a cell rather than letting it close the element', () => {
        const xml = formatExcelXml(tableOf([['</Data><Data>owned']]));

        expect(xml).toContain('&lt;/Data&gt;&lt;Data&gt;owned');
        expect(xml).not.toContain('<Data ss:Type="String"></Data><Data>');
    });

    it('carries a numeric column width and names the sheet', () => {
        const xml = formatExcelXml(table(), { sheetName: 'People' });

        expect(xml).toContain('ss:Name="People"');
        expect(xml).toContain('ss:Width="90"');
    });
});

describe('formatPrintHtml', () => {
    it('writes every row it was given, not the rows a window would hold', () => {
        const built = buildExportTable({ rows: people, columns });
        const html = formatPrintHtml(built, { title: 'People' });

        expect(html.match(/<tr>/g)).toHaveLength(people.length + 1);
        expect(html).toContain('<title>People</title>');
    });

    it('repeats the header across pages and keeps a row whole', () => {
        const html = formatPrintHtml(table());

        expect(html).toContain('display: table-header-group');
        expect(html).toContain('break-inside: avoid');
    });

    it('escapes a cell that would otherwise be markup', () => {
        const html = formatPrintHtml(tableOf([['<script>alert(1)</script>']]));

        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

/** A table of literal strings, for the escaping cases where the row shape is beside the point. */
function tableOf(rows: readonly (readonly string[])[]) {
    const ids = rows[0]?.map((_, index) => `c${index}`) ?? ['c0'];
    const built = resolveColumns(ids.map((id) => ({ id })));

    return buildExportTable({
        rows: rows.map((row) => Object.fromEntries(ids.map((id, index) => [id, row[index] as ColumnValue]))),
        columns: built,
    });
}
