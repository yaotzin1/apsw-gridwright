/**
 * The columns of the features page, and the export formats that read them.
 *
 * Columns are rebuilt when editing or icons are switched, because `edit` and `icon` are fields on
 * the column. Everything else about them is fixed.
 */
import { React, gridwright, h } from '../shared/package.js';

const { markdownReportFormats } = gridwright;
const { useMemo } = React;

const bytes = new Intl.NumberFormat('en-US', { notation: 'compact', style: 'unit', unit: 'byte', unitDisplay: 'narrow' });

const FolderIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' },
        h('path', { d: 'M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.4 1.7H13A1.5 1.5 0 0 1 14.5 5.7v5.8A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4Z' }));

const FileIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 },
        h('path', { d: 'M4.2 1.9h4.6l3 3v9.2H4.2z' }),
        h('path', { d: 'M8.8 1.9v3h3' }));

/** A column's `icon` is a renderer, decided per row. In a tree it sits between the toggle and the name. */
const iconFor = ({ row }) => h(row.kind === 'folder' ? FolderIcon : FileIcon);

const kindChoices = [
    { value: 'folder', label: 'folder' },
    { value: 'file', label: 'file' },
];

export function useFileColumns(editing, icons) {
    return useMemo(
        () => [
            {
                id: 'name',
                header: 'Name',
                ...(editing ? { edit: { editable: true } } : {}),
                ...(icons ? { icon: iconFor } : {}),
            },
            {
                id: 'kind',
                header: 'Kind',
                cell: ({ value }) => h('span', { className: 'kind' }, value),
                filter: { type: 'select', choices: kindChoices },
                ...(editing ? { edit: { inputType: 'select', choices: kindChoices } } : {}),
            },
            { id: 'owner', header: 'Owner', ...(editing ? { edit: { editable: true } } : {}) },
            {
                id: 'size',
                header: 'Size',
                align: 'end',
                formatValue: (value) => (value ? bytes.format(value) : ''),
                filter: { type: 'number' },
                // `editable` is asked per row, so a folder's size stays read-only.
                ...(editing ? { edit: { editable: (row) => row.kind === 'file', inputType: 'number' } } : {}),
            },
        ],
        [editing, icons],
    );
}

/**
 * One report over these columns, offered as a Markdown file and as a PDF. The placeholders are the
 * column ids above. The employees page has an editor for templates like this one.
 */
export const inventoryReport = markdownReportFormats({
    id: 'files:inventory',
    label: 'File inventory',
    header: (rows) => `# File inventory\n\n${rows.length} entries`,
    template: '- **{name}** ({kind}), {size}, owned by {owner}',
    separator: '\n',
});
