/**
 * The row menu for both grids on the page. Each item is `{ id, label, onSelect, hidden?, destructive? }`,
 * and `hidden` is asked per row, so an item can apply to some rows only.
 */
import { gridwright } from '../shared/package.js';
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
