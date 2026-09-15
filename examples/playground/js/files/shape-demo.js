/**
 * The grid for every in-memory shape: nested, two parents, stored on the server, lazy, 20,000 rows.
 *
 * Read the `h(Gridwright, { ... })` call at the bottom first: it is the whole integration, the data
 * and a list of add-ons. Above it, `treeOptions` says how this shape describes its hierarchy for
 * `treeData()`, `menuItems` is the row menu for `rowActions()`, and `commit` stores an edit for
 * `inlineEditing()`.
 */
import { React, catalogs, gridwright, h } from '../shared/package.js';
import { inventoryReport, useFileColumns } from './columns.js';
import { loadLazyChildren, loadStoredTree, saveStoredChange, seedFor } from './data.js';

const { Gridwright, columnFilters, exportMenu, inlineEditing, rowActions, search, treeData, virtualRows } = gridwright;
const { useCallback, useEffect, useMemo, useState } = React;

const count = new Intl.NumberFormat('en-US');

let created = 0;
const blankRow = (kind) => ({
    id: `new-${(created += 1)}`,
    name: kind === 'folder' ? 'New folder' : 'Untitled.md',
    kind,
    owner: 'You',
    size: 0,
});

export function ShapeDemo({ shape, tree, virtual, actions, editing, icons, exporting, filtering, locale, strict, log, onStats }) {
    const columns = useFileColumns(editing, icons);
    const stored = shape === 'stored';
    const [rows, setRows] = useState(() => (stored ? [] : seedFor(shape)));

    // The stored shape is fetched once, then replaced by whatever the server answers after a change.
    useEffect(() => {
        if (!stored) return undefined;
        let live = true;
        void loadStoredTree().then((data) => {
            if (live) setRows(data);
        });
        return () => {
            live = false;
        };
    }, [stored]);

    // The tree's controller, handed back by the grid. Inserting, moving and removing live on it.
    const [controller, setController] = useState(null);

    const treeOptions = useMemo(() => {
        if (!tree) return undefined;

        const options = {
            getRowId: (row) => row.id,
            controllerRef: setController,
            defaultExpandedDepth: shape === 'lazy' ? 0 : 1,
            onExpandedChange: (ids) => log('expanded', `${ids.length} open`),
            // Every change arrives here after the grid has applied it. Throwing reverts it.
            onCommit: async (change) => {
                log(change.type, String(change.rowId));
                if (stored) {
                    setRows(await saveStoredChange(change));
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 250));
                if (strict && change.type !== 'remove') throw new Error('The server refused that change.');
            },
        };

        if (shape === 'nested') options.getChildren = (row) => row.children;
        if (shape === 'graph') options.getParentIds = (row) => row.parentIds;
        if (shape === 'stored') options.getParentIds = (row) => row.parentId;
        if (shape === 'lazy') {
            options.hasChildren = (row) => row.kind === 'folder';
            options.loadChildren = ({ rowId }) => {
                log('loadChildren', String(rowId));
                return loadLazyChildren(rowId);
            };
        }
        return options;
    }, [tree, shape, stored, strict, log]);

    const menuItems = useMemo(() => {
        if (!actions) return undefined;
        // A grid row holds a tree node when the tree is on, and the row itself when it is off.
        const rowOf = (gridRow) => (tree ? gridRow.data.row : gridRow.data);
        const insert = (gridRow, position) =>
            void controller?.insertRow(blankRow('file'), { referenceNodeId: String(gridRow.id), position });

        return [
            { id: 'add-child', label: 'Add child', hidden: (gridRow) => !tree || rowOf(gridRow).kind !== 'folder', onSelect: (gridRow) => insert(gridRow, 'child') },
            { id: 'add-sibling', label: 'Add sibling', hidden: () => !tree, onSelect: (gridRow) => insert(gridRow, 'after') },
            { id: 'inspect', label: 'Inspect', separatorBefore: true, onSelect: (gridRow) => log('inspect', rowOf(gridRow).name) },
            { id: 'delete', label: 'Delete', destructive: true, hidden: () => !tree, onSelect: (gridRow) => void controller?.removeNode(String(gridRow.id)) },
        ];
    }, [actions, tree, controller, log]);

    // A tree applies an edit and reverts it if `onCommit` throws. A plain array is this page's state.
    const commit = useCallback(
        (rowId, columnId, value) => {
            log('edit', `${rowId}.${columnId}`);
            if (controller) return controller.updateRow(rowId, { [columnId]: value });
            setRows((current) => current.map((row) => (row.id === rowId ? { ...row, [columnId]: value } : row)));
            return undefined;
        },
        [controller, log],
    );

    const index = controller ? controller.getIndex() : null;
    // Memoised, because the page stores what it receives: a new array on every render would make the
    // page re-render this grid, which would send another new array.
    const stats = useMemo(
        () =>
            index
                ? [
                      ['nodes in index', index.nodes.length],
                      ['distinct rows', index.placementsByRowId.size],
                      ['max depth', index.maxDepth],
                      ['several parents', String(index.hasMultipleParents)],
                  ]
                : [
                      ['rows', count.format(rows.length)],
                      ['tree', 'off'],
                      ['windowed', String(virtual)],
                      ['editable columns', editing ? 4 : 0],
                  ],
        [index, rows.length, virtual, editing],
    );
    onStats(stats);

    return h(Gridwright, {
        'aria-label': 'Files',
        columns,
        data: rows,
        getRowId: (row) => row.id,
        pageSize: virtual ? 500 : 50,
        selectionMode: 'multiple',
        locale: catalogs[locale],
        addons: [
            search(),
            treeOptions && treeData(treeOptions),
            virtual && virtualRows({ rowHeight: 40, height: 420 }),
            menuItems && rowActions({ items: menuItems }),
            editing && inlineEditing({ commit }),
            filtering && columnFilters(),
            // In a tree, "all matching rows" means the rows the tree is showing: a collapsed branch is
            // not on screen and is not in the file.
            exporting && exportMenu({ formats: ['csv', 'excel', ...inventoryReport], filename: 'files' }),
        ].filter(Boolean),
    });
}
