/**
 * The columns of the employees grid, and the small team tree the "tree" switch shows instead.
 *
 * A column is a plain object. Everything a column can say is here in one place:
 *
 *   id            which property of the row it reads, and the name a template uses: `{salary}`
 *   header        the text in the header cell
 *   formatValue   the text on screen, in search, and in exports unless `exportValue` says otherwise
 *   exportValue   the text written to a file, when it should differ from the screen
 *   cell / icon   React renderers, for anything that is not text
 *   edit          makes the column editable in place (read by the `inlineEditing()` add-on)
 *   filter        what the column holds, for its header filter (read by the `columnFilters()` add-on)
 *   width         the column's width in pixels, and what the `columnLayout()` add-on starts from
 *   layout        whether it resizes, pins or hides (read by the `columnLayout()` add-on)
 */
import { h } from '../shared/package.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

export const DEPARTMENTS = ['Engineering', 'Research', 'Operations', 'Design', 'Finance'];

const PersonIcon = ({ active }) =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', style: { color: active ? '#16a34a' : '#94a3b8' } },
        h('circle', { cx: 8, cy: 5.2, r: 3.1 }),
        h('path', { d: 'M2.4 14.2a5.6 5.6 0 0 1 11.2 0z' }));

const TeamIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', style: { color: '#f59e0b' } },
        h('path', { d: 'M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.4 1.7H13A1.5 1.5 0 0 1 14.5 5.7v5.8A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4Z' }));

const departmentChoices = DEPARTMENTS.map((value) => ({ value, label: value }));

/** One row per person, as `/api/people` answers them. */
export const employeeColumns = [
    {
        id: 'name',
        header: 'Name',
        width: 240,
        // It is the row's identity: the picker may not hide it, and it starts pinned to the start so
        // that widening another column scrolls the table under it rather than past it.
        layout: { hideable: false, pinned: 'left' },
        edit: { editable: true },
        // A renderer, like `cell`, so it is decided per row. It is decoration: the name says it.
        icon: ({ row }) => h(PersonIcon, { active: row.active }),
    },
    {
        id: 'department',
        header: 'Department',
        width: 200,
        edit: { inputType: 'select', choices: departmentChoices },
        filter: { type: 'select', choices: departmentChoices },
    },
    { id: 'city', header: 'City', width: 180, edit: { editable: true } },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        width: 170,
        layout: { maxWidth: 260 },
        formatValue: (value) => money.format(value),
        // $138,000 on screen, 138000 in a file, so a spreadsheet can add the column up.
        exportValue: (value) => String(value),
        filter: { type: 'number' },
    },
    {
        id: 'startedOn',
        header: 'Started',
        width: 180,
        formatValue: (value) => date.format(new Date(value)),
        filter: { type: 'date' },
    },
    {
        id: 'active',
        header: 'Status',
        width: 150,
        // A status nobody wants to scroll for, so it stays at the end of the row.
        layout: { pinned: 'right', resizable: false },
        formatValue: (value) => (value ? 'Active' : 'Inactive'),
        cell: ({ value }) => h('span', { className: 'badge-cell', 'data-active': String(value) }, value ? 'Active' : 'Inactive'),
        // A boolean is a choice of two: `value` is what is compared, `label` is what the reader sees.
        filter: { type: 'select', choices: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
    },
];

// --- the tree -------------------------------------------------------------------------------------

/** A small hierarchy, so the same component can be shown as a tree without leaving the page. */
export const TEAM = [
    {
        id: 'eng', name: 'Engineering', kind: 'team', city: 'Kraków', salary: 0, active: true,
        children: [
            { id: 'ada', name: 'Ada Lovelace', kind: 'person', city: 'Kraków', salary: 141_000, active: true },
            {
                id: 'platform', name: 'Platform', kind: 'team', city: 'Warsaw', salary: 0, active: true,
                children: [
                    { id: 'grace', name: 'Grace Hopper', kind: 'person', city: 'Warsaw', salary: 138_000, active: true },
                    { id: 'radia', name: 'Radia Perlman', kind: 'person', city: 'Lisbon', salary: 132_000, active: false },
                ],
            },
        ],
    },
    {
        id: 'research', name: 'Research', kind: 'team', city: 'Berlin', salary: 0, active: true,
        children: [
            { id: 'katherine', name: 'Katherine Johnson', kind: 'person', city: 'Berlin', salary: 129_000, active: true },
            { id: 'barbara', name: 'Barbara Liskov', kind: 'person', city: 'Toronto', salary: 145_000, active: true },
        ],
    },
];

export const teamColumns = [
    {
        id: 'name',
        header: 'Name',
        edit: { editable: true },
        icon: ({ row }) => (row.kind === 'team' ? h(TeamIcon) : h(PersonIcon, { active: row.active })),
    },
    { id: 'city', header: 'City', edit: { editable: true } },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        formatValue: (value) => (value ? money.format(value) : ''),
        // `editable` is asked per row, so a team's empty salary cell stays read-only.
        edit: { editable: (row) => row.kind === 'person', inputType: 'number' },
        filter: { type: 'number' },
    },
];

let hires = 0;

/** A row for "Add person" in the tree's row menu. */
export const newHire = () => ({
    id: `new-${(hires += 1)}`,
    name: 'New hire',
    kind: 'person',
    city: 'Kraków',
    salary: 90_000,
    active: true,
});
