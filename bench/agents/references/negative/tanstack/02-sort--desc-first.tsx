import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution({ people }: { people: Person[] }) {
    const table = useReactTable({
        data: people,
        columns,
        enableSortingRemoval: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    });
    return (
        <div>
            <table aria-label="People">
                <thead>
                    {table.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                            {group.headers.map((header) => {
                                const sorted = header.column.getIsSorted();
                                return (
                                    <th key={header.id} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                                        <button type="button" onClick={header.column.getToggleSortingHandler()}>
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous page</button>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next page</button>
        </div>
    );
}
