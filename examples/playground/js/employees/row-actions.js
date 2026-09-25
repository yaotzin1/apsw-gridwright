/**
 * The row menu for both grids on the page. Each item is `{ id, label, onSelect, hidden?, destructive? }`,
 * and `hidden` is asked per row, so an item can apply to some rows only.
 */
import { gridwright, h } from '../shared/package.js';
import { edits } from './data-source.js';
import { newHire } from './columns.js';

const { rowDataOf } = gridwright;

/** Over the flat employees grid. An edit goes into the mock table, then the source asks again. */
export const employeeRowActions = ({ dataSource, setNote }) => [
    {
        id: 'inspect',
        label: 'Inspect',
        onSelect: (row) => setNote(`${row.data.name}, ${row.data.city}`),
    },
    {
        id: 'deactivate',
        label: 'Deactivate',
        destructive: true,
        hidden: (row) => !row.data.active,
        onSelect: (row) => {
            edits.set(row.data.id, { ...edits.get(row.data.id), active: false });
            dataSource.invalidate();
        },
    },
];

/**
 * Over the team tree. The tree's rows are nodes, so `rowDataOf` reads the row inside one, and every
 * change goes through the tree's controller, which applies it at once and reverts it if refused.
 */
export const teamRowActions = ({ controller, setNote }) => [
    {
        id: 'add',
        label: 'Add person',
        hidden: (row) => rowDataOf(row).kind !== 'team',
        onSelect: (row) => void controller?.insertRow(newHire(), { referenceNodeId: String(row.id), position: 'child' }),
    },
    {
        id: 'inspect',
        label: 'Inspect',
        separatorBefore: true,
        onSelect: (row) => setNote(`${rowDataOf(row).name}, ${rowDataOf(row).city}`),
    },
    {
        id: 'remove',
        label: 'Remove',
        destructive: true,
        onSelect: (row) => void controller?.removeNode(String(row.id)),
    },
];

/**
 * What opens the row menu, given what else wants the row.
 *
 * `both`, the default, pins the menu on a left click: the click `selectOnRowClick` selects with.
 * `hover-contextmenu` leaves that click to selection. Beside a column of buttons the menu is
 * right-click only, because a menu previewed on hover sits between the pointer and the buttons.
 */
export const rowActionsTrigger = ({ selectOnRowClick, buttonsInRow = false }) =>
    buttonsInRow ? 'contextmenu' : selectOnRowClick ? 'hover-contextmenu' : 'both';

const InspectIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': 'true' },
        h('circle', { cx: 7, cy: 7, r: 4.2 }),
        h('path', { d: 'm10.2 10.2 3.3 3.3', strokeLinecap: 'round' }));

const PowerIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M8 2.2v5.2' }),
        h('path', { d: 'M4.6 4.4a5 5 0 1 0 6.8 0' }));

/**
 * The same actions as buttons in a column of their own, on every row.
 *
 * An ordinary column whose `cell` renders controls. It holds no value, so it opts out of everything
 * that reads one: sort, filters, search and export. The buttons keep their own clicks, so pressing
 * one neither selects the row nor opens its menu. Each carries its row's name in `aria-label`,
 * because "Inspect" alone, read in a list of forty, says nothing about which row it acts on.
 */
export const employeeActionsColumn = ({ dataSource, setNote }) => ({
    id: 'actions',
    header: 'Actions',
    accessor: () => null,
    width: 110,
    align: 'center',
    sortable: false,
    filterable: false,
    searchable: false,
    exportable: false,
    layout: { pinned: 'right', resizable: false, hideable: false },
    cell: ({ row }) =>
        h('span', { className: 'action-buttons' },
            h('button', {
                type: 'button',
                className: 'icon-button',
                title: 'Inspect',
                'aria-label': `Inspect ${row.name}`,
                onClick: () => setNote(`${row.name}, ${row.city}`),
            }, h(InspectIcon)),
            h('button', {
                type: 'button',
                className: 'icon-button',
                'data-destructive': 'true',
                title: row.active ? 'Deactivate' : 'Already inactive',
                'aria-label': `Deactivate ${row.name}`,
                disabled: !row.active,
                onClick: () => {
                    edits.set(row.id, { ...edits.get(row.id), active: false });
                    dataSource.invalidate();
                    setNote(`${row.name} deactivated`);
                },
            }, h(PowerIcon))),
});
