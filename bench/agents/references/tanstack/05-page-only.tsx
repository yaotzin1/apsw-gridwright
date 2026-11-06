import { useEffect, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type PaginationState } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution() {
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [page, setPage] = useState<{ data: Person[]; total: number }>({ data: [], total: 0 });

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ page: String(pagination.pageIndex + 1), pageSize: String(pagination.pageSize) });
        fetch(`/api/people?${params}`, { signal: controller.signal })
            .then((response) => response.json() as Promise<{ data: Person[]; total: number }>)
            .then(setPage)
            .catch(() => undefined);
        return () => controller.abort();
    }, [pagination]);

    // Sorting is client-side, over the loaded page only: the server cannot sort.
    const table = useReactTable({
        data: page.data,
        columns,
        rowCount: page.total,
        state: { pagination },
        onPaginationChange: setPagination,
        manualPagination: true,
        sortDescFirst: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    return (
        <div>
            <table aria-label="People">
                <thead>
                    {table.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                            {group.headers.map((header) => (
                                <th key={header.id}>
                                    <button type="button" onClick={header.column.getToggleSortingHandler()}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </button>
                                </th>
                            ))}
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
