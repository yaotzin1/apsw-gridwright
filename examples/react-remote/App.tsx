/**
 * A worked example of the two data paths and the extension points.
 *
 * It is type-checked and linted with the rest of the repository, importing through the package
 * specifiers a consumer would write, so it cannot drift away from the real API. `tsconfig.json`
 * maps those specifiers to `src/` for this purpose.
 */

import { useMemo, useState } from 'react';
import { corePlugins, createRemoteDataSource, createRestDataSource, STAGE_ORDER } from 'apsw-gridwright';
import type { GridPlugin } from 'apsw-gridwright';
import { Gridwright, GridwrightProvider, GridBody, GridHeader, GridPagination, GridTable, useGridwright } from 'apsw-gridwright/react';
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

declare function readToken(): string;

// The plugin set a consumer would pass explicitly to drop or replace a built-in.
export const explicitPlugins = [...corePlugins<Employee>(), activeOnlyPlugin()];
