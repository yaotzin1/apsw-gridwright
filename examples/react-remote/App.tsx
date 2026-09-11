/**
 * A worked example of the two data paths and the extension points.
 *
 * It is type-checked and linted with the rest of the repository, importing through the package
 * specifiers a consumer would write, so it cannot drift away from the real API. `tsconfig.json`
 * maps those specifiers to `src/` for this purpose.
 */

import { useMemo, useState } from 'react';
import {
    buildExportTable,
    corePlugins,
    createRemoteDataSource,
    createRestDataSource,
    createWindowedDataSource,
    formatCsv,
    formatMarkdownTemplate,
    resolveColumns,
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
    GridExportMenu,
    InlineEditProvider,
    TreeProvider,
    editableColumns,
    rowDataOf,
    printMarkdownDocument,
    useGridExport,
    useGridwright,
    useTreeGridwright,
} from 'apsw-gridwright/react';
import type { CustomExportFormat, GridwrightColumn } from 'apsw-gridwright/react';

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
        // The file wants the number back, so a spreadsheet can add the column up. Without this the
        // cell exports as the currency string, which is what the reader sees and not what sums.
        exportValue: (value: number) => String(value),
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
                    // `rowDataOf` because a tree grid's rows are placements. The same menu works
                    // on a flat grid, where the row is already the row.
                    hidden: (row) => rowDataOf<Node>(row).kind !== 'folder',
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

// --- 7. Exporting ------------------------------------------------------------------------------
//
// One prop. The default scope is every row matching the query, which against an in-memory array is
// answered from memory and against a paginating endpoint is a question only the server can answer.

export function ExportExample({ employees }: { employees: readonly Employee[] }) {
    return (
        <Gridwright<Employee>
            columns={columns}
            data={employees}
            pageSize={25}
            searchable
            export={{ formats: ['csv', 'excel', 'markdown', 'print'], filename: 'employees' }}
            aria-label="Employees"
        />
    );
}

// A paginating source that can also hand over everything. Without `fetchAll`, exporting the whole
// result set refuses and says so, rather than saving the page in memory under a name that claims
// to be all of it.
const exportableEmployees = createRemoteDataSource<Employee>({
    capabilities: { sort: true, filter: true, search: true, paginate: true },
    fetcher: async ({ query, signal }) => {
        const response = await fetch(
            `/api/employees?page=${query.pagination.pageIndex + 1}&size=${query.pagination.pageSize}`,
            { signal },
        );
        const body = (await response.json()) as { items: Employee[]; total: number };
        return { rows: body.items, totalRows: body.total };
    },
});

export const employeesWithFullExport = {
    ...exportableEmployees,
    // The same query, with its pagination ignored.
    fetchAll: async ({ query, signal }: { query: { search: string }; signal: AbortSignal }) => {
        const response = await fetch(`/api/employees/all?search=${encodeURIComponent(query.search)}`, {
            signal,
        });
        return { rows: (await response.json()) as Employee[] };
    },
};

// The control on its own, for a toolbar composed by hand, beside a button of your own driving the
// same export through the hook.
export function ComposedExportExample({ employees }: { employees: readonly Employee[] }) {
    const instance = useGridwright<Employee>({ columns, data: employees, pageSize: 25 });

    return (
        <GridwrightProvider instance={instance}>
            <div className="toolbar">
                <GridExportMenu<Employee> formats={['csv', 'print']} filename="employees" />
                <SaveSelectionButton />
            </div>
            <GridTable aria-label="Employees">
                <GridHeader />
                <GridBody />
            </GridTable>
            <GridPagination />
        </GridwrightProvider>
    );
}

function SaveSelectionButton() {
    const { exportAs, busy, error } = useGridExport<Employee>({ scope: 'selected', filename: 'chosen' });

    return (
        <>
            <button type="button" disabled={busy} onClick={() => void exportAs('csv')}>
                Save the selected rows
            </button>
            {error && <p role="alert">{error}</p>}
        </>
    );
}

// --- 8. A Markdown template, printed as a PDF --------------------------------------------------
//
// The template is the report. Rows fill it, the renderer turns it into a document, and the
// browser's print dialog writes the PDF, so neither a Markdown parser nor a PDF engine enters the
// bundle. A format of your own sits in the same menu as the four built in.

const monthlyReport: CustomExportFormat<Employee> = {
    id: 'acme:monthly',
    label: 'Monthly report',
    serialize: ({ rows, columns }) => {
        const markdown = formatMarkdownTemplate({
            rows,
            columns,
            header: (covered) => `# Monthly report

${covered.length} people.`,
            template: ['## {name}', '', '- Department: {department}', '- Salary: {salary}'].join('\n'),
            separator: '\n\n',
            footer: '*Generated from the rows on screen.*',
        });

        printMarkdownDocument(markdown, { title: 'Monthly report' });
    },
};

// The same report, made by a service that answers with a PDF. The serializer returns the bytes and
// the grid saves them, which is the only difference between the two routes.
const serverReport: CustomExportFormat<Employee> = {
    id: 'acme:monthly-server',
    label: 'Monthly report (server)',
    serialize: async ({ rows, columns }) => {
        const markdown = formatMarkdownTemplate({ rows, columns, template: '- {name}: {salary}' });
        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'content-type': 'text/markdown' },
            body: markdown,
        });

        return { content: await response.blob(), mimeType: 'application/pdf', extension: '.pdf' };
    },
};

export function ReportExample({ employees }: { employees: readonly Employee[] }) {
    return (
        <Gridwright<Employee>
            columns={columns}
            data={employees}
            pageSize={25}
            export={{ formats: ['csv', monthlyReport, serverReport], filename: 'employees' }}
            aria-label="Employees"
        />
    );
}

// No React at all: the same serializers, in a script or a worker.
export function employeesAsCsv(employees: readonly Employee[]): string {
    return formatCsv(buildExportTable({ rows: employees, columns: resolveColumns(columns) }));
}

declare function readToken(): string;

// The plugin set a consumer would pass explicitly to drop or replace a built-in.
export const explicitPlugins = [...corePlugins<Employee>(), activeOnlyPlugin()];
