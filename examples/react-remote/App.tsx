/**
 * A worked example of the two data paths and the extension points.
 *
 * It is type-checked and linted with the rest of the repository, importing through the package
 * specifiers a consumer would write, so it cannot drift away from the real API. `tsconfig.json`
 * maps those specifiers to `src/` for this purpose.
 */

import { useMemo, useState } from 'react';
import {
    corePlugins,
    createRemoteDataSource,
    createRestDataSource,
    createWindowedDataSource,
    STAGE_ORDER,
} from 'apsw-gridwright';
import type { GridPlugin, GridRow, TreeController, TreeNode } from 'apsw-gridwright';
import {
    BubbleMenu,
    Gridwright,
    GridwrightProvider,
    GridBody,
    GridHeader,
    GridPagination,
    GridTable,
    InlineEditProvider,
    TreeProvider,
    editableColumns,
    useGridwright,
    useTreeGridwright,
} from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';

interface Employee {
    id: number;
    name: string;
    department: string;
    salary: number;
    startedOn: string;
    active: boolean;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const columns: readonly GridwrightColumn<Employee>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        // Search matches what the reader sees, so "$120,000" finds the row that renders it.
        formatValue: (value: number) => currency.format(value),
    },
    {
        id: 'startedOn',
        header: 'Started',
        formatValue: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
        id: 'active',
        header: 'Status',
        accessor: (row) => (row.active ? 'Active' : 'Inactive'),
        cell: ({ value }) => <span className={value === 'Active' ? 'badge badge--ok' : 'badge'}>{String(value)}</span>,
    },
];

// --- 1. An in-memory array ---------------------------------------------------------------------

export function LocalExample({ employees }: { employees: readonly Employee[] }) {
    return (
        <Gridwright<Employee>
            columns={columns}
            data={employees}
            pageSize={25}
            searchable
            selectionMode="multiple"
            aria-label="Employees"
            onSelectionChange={(ids) => console.warn(ids.length, 'selected')}
        />
    );
}

// --- 2. A REST endpoint ------------------------------------------------------------------------
//
// The only difference is which prop carries the data. Everything else, including the columns, is
// unchanged. The endpoint now receives page, pageSize, sort, search and filters, and the grid gets
// cancellation, out-of-order rejection and backoff for free.

const employeesEndpoint = createRestDataSource<Employee>({
    url: '/api/employees',
    headers: () => ({ Authorization: `Bearer ${readToken()}` }),
});

export function RemoteExample() {
    return (
        <Gridwright<Employee>
            columns={columns}
            dataSource={employeesEndpoint}
            pageSize={25}
            searchable
            // Typing hits the server once the reader pauses rather than once per keystroke.
            queryDebounceMs={250}
            aria-label="Employees"
        />
    );
}

// --- 3. An endpoint that pages but does not sort -----------------------------------------------
//
// The common real case. Declare it, and the pipeline sorts and filters the page that arrived
// instead of leaving the sort arrow pointing at rows nobody reordered.

export function PartiallyCapableExample() {
    const dataSource = useMemo(
        () =>
            createRemoteDataSource<Employee>({
                capabilities: { sort: false, filter: false, search: false, paginate: true },
                fetcher: async ({ query, signal }) => {
                    const response = await fetch(
                        `/api/employees?page=${query.pagination.pageIndex + 1}&size=${query.pagination.pageSize}`,
                        { signal },
                    );
                    const body = (await response.json()) as { items: Employee[]; total: number };
                    return { rows: body.items, totalRows: body.total };
                },
            }),
        [],
    );

    return <Gridwright<Employee> columns={columns} dataSource={dataSource} pageSize={50} searchable />;
}

// --- 4. A plugin -------------------------------------------------------------------------------

function activeOnlyPlugin(): GridPlugin<Employee> {
    return {
        name: 'example:active-only',
        setup: (context) =>
            context.registerStage({
                id: 'example:active-only',
                order: STAGE_ORDER.FILTER + 1,
                // Skipped when the server already filters, so the same plugin is correct for both
                // of the data paths above.
                capability: 'filter',
                run: (rows) => {
                    const kept = rows.filter((row) => row.active);
                    return { rows: kept, totalRows: kept.length };
                },
            }),
    };
}

// --- 5. Composition, theming and translation ---------------------------------------------------

export function ComposedExample({ employees }: { employees: readonly Employee[] }) {
    const [onlyActive, setOnlyActive] = useState(false);

    const grid = useGridwright<Employee>({ columns, data: employees, pageSize: 10 });

    // A plugin added and removed at runtime. `use` returns the unsubscribe that removes it.
    useMemo(() => {
        if (!onlyActive) return undefined;
        return grid.api.use(activeOnlyPlugin());
    }, [grid.api, onlyActive]);

    return (
        <div className="employees" style={{ ['--gw-accent' as string]: '#7c3aed', ['--gw-row-height' as string]: '44px' }}>
            <GridwrightProvider
                instance={grid}
                labels={{
                    empty: 'No employees match those filters',
                    pageRange: (from, to, total, exact) =>
                        exact ? `${from}-${to} of ${total} employees` : `${from}-${to} of many`,
                }}
            >
                <header className="employees__header">
                    <h2>Employees</h2>
                    <label>
                        <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
                        Active only
                    </label>
                    {/* Pagination above the table, which the assembled component never renders. */}
                    <GridPagination pageSizeOptions={[10, 25]} />
                </header>

                <GridTable aria-label="Employees">
                    <GridHeader />
                    <GridBody<Employee> onRowClick={(row) => console.warn('open', row.data.name)} />
                </GridTable>
            </GridwrightProvider>
        </div>
    );
}

// --- 6. A tree -----------------------------------------------------------------------------------

interface Node {
    id: string;
    name: string;
    kind: 'folder' | 'file';
    owner: string;
    children?: Node[];
    parentIds?: string[];
}

const plainTreeColumns: readonly GridwrightColumn<Node>[] = [
    // Editing is opt-in per column: a grid where every cell becomes a text box is unreadable.
    { id: 'name', header: 'Name', edit: { editable: true },
        icon: ({ row }) => <span aria-hidden>{row.kind === 'folder' ? '\u{1F4C1}' : '\u{1F4C4}'}</span> },
    { id: 'owner', header: 'Owner', edit: { editable: (row) => row.kind === 'file' } },
    { id: 'kind', header: 'Kind' },
];

// `<Gridwright onCellEdit>` does this wrapping for you. It is only here because the example below
// composes the parts by hand, and then the order is the composer's to choose.
const treeColumns: readonly GridwrightColumn<Node>[] = editableColumns<Node>(plainTreeColumns);

export function TreeExample({ nodes }: { nodes: readonly Node[] }) {
    const grid = useTreeGridwright<Node>({
        columns: treeColumns,
        data: nodes,
        getRowId: (row) => row.id,
        // Nested children. Swap this for `getParentIds` and one row can sit under several parents,
        // producing one node per placement.
        getChildren: (row) => row.children,
        defaultExpandedDepth: 1,
        selectionMode: 'multiple',
        pageSize: 100,
        // Optimistic already; this persists it, and a rejection reverts the tree completely.
        onCommit: async (change) => {
            await fetch('/api/files', { method: 'POST', body: JSON.stringify(change) });
        },
    });

    const actions = [
        {
            id: 'add-child',
            label: 'Add child',
            hidden: (row: GridRow<TreeNode<Node>>) => row.data.row.kind !== 'folder',
            onSelect: (row: GridRow<TreeNode<Node>>) =>
                void grid.tree.insertRow(
                    { id: crypto.randomUUID(), name: 'Untitled', kind: 'file', owner: 'You' },
                    { referenceNodeId: String(row.id), position: 'child' },
                ),
        },
        {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: (row: GridRow<TreeNode<Node>>) => void grid.tree.removeNode(String(row.id)),
        },
    ];

    return (
        <TreeProvider controller={grid.tree} treeColumnId={grid.treeColumnId}>
            <GridwrightProvider instance={grid}>
                <InlineEditProvider
                    commit={(rowId, columnId, value) =>
                        grid.tree.updateRow(rowId, { [columnId]: value } as Partial<Node>)
                    }
                >
                    <BubbleMenu<TreeNode<Node>> aria-label="Row actions" items={actions} />
                    <GridTable aria-label="Files">
                        <GridHeader />
                        <GridBody<TreeNode<Node>> />
                    </GridTable>
                </InlineEditProvider>
            </GridwrightProvider>
        </TreeProvider>
    );
}

/**
 * The same tree, and then some, as options on one component.
 *
 * Nothing here is a different component: the tree, the row menu, the editors and the windowing are
 * five props on the `<Gridwright />` above. `controllerRef` is how the actions reach the controller
 * the component owns.
 */
export function SimpleTreeExample({ nodes }: { nodes: readonly Node[] }) {
    const [tree, setTree] = useState<TreeController<Node> | null>(null);

    return (
        <Gridwright<Node>
            columns={plainTreeColumns}
            data={nodes}
            tree={{
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                defaultExpandedDepth: 1,
                controllerRef: setTree,
            }}
            virtual={{ rowHeight: 40, height: 480 }}
            rowActions={[
                {
                    id: 'add-child',
                    label: 'Add child',
                    hidden: (row) => (row.data as unknown as TreeNode<Node>).row.kind !== 'folder',
                    onSelect: (row) =>
                        void tree?.insertRow(
                            { id: crypto.randomUUID(), name: 'Untitled', kind: 'file', owner: 'You' },
                            { referenceNodeId: String(row.id), position: 'child' },
                        ),
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    destructive: true,
                    onSelect: (row) => void tree?.removeNode(String(row.id)),
                },
            ]}
            onCellEdit={(rowId, columnId, value) =>
                tree?.updateRow(rowId, { [columnId]: value } as Partial<Node>)
            }
            searchable
            aria-label="Files"
        />
    );
}

/**
 * Ten million rows.
 *
 * The source holds a window of blocks rather than a table, so what the browser holds is
 * `blockSize * maxBlocks` rows however large the result set is. `virtual` is what renders a window
 * of *that*: the two solve different problems and are switched on separately.
 */
const windowedFiles = createWindowedDataSource<Node>({
    blockSize: 200,
    maxBlocks: 12,
    fetchRange: async ({ offset, limit, signal }) => {
        const response = await fetch(`/api/files?offset=${offset}&limit=${limit}`, { signal });
        const body = (await response.json()) as { data: Node[]; total: number };
        return { rows: body.data, totalRows: body.total };
    },
});

export function WindowedExample() {
    return (
        <Gridwright<Node>
            columns={plainTreeColumns}
            dataSource={windowedFiles}
            getRowId={(row) => row.id}
            // The size of the data window the body moves, not a page anyone navigates: `virtual`
            // replaces the pagination footer with the scrollbar.
            pageSize={200}
            virtual={{ rowHeight: 40, height: 480 }}
            renderSkeleton={(index) => <span className="skeleton">Row {index + 1}</span>}
            aria-label="Files"
        />
    );
}

declare function readToken(): string;

// The plugin set a consumer would pass explicitly to drop or replace a built-in.
export const explicitPlugins = [...corePlugins<Employee>(), activeOnlyPlugin()];
