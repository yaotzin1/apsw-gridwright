import { useEffect, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type SortingState } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution() {
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [page, setPage] = useState<{ data: Person[]; total: number }>({ data: [], total: 0 });

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ page: String(pagination.pageIndex), pageSize: String(pagination.pageSize) });
        if (sorting.length > 0) params.set('sort', sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','));
        fetch(`/api/people?${params}`, { signal: controller.signal })
            .then((response) => response.json() as Promise<{ data: Person[]; total: number }>)
            .then(setPage)
            .catch(() => undefined);
        return () => controller.abort();
    }, [pagination, sorting]);

    const table = useReactTable({
        data: page.data,
        columns,
        rowCount: page.total,
        state: { pagination, sorting },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        manualPagination: true,
        manualSorting: true,
        sortDescFirst: false,
        getCoreRowModel: getCoreRowModel(),
    });
    const from = pagination.pageIndex * pagination.pageSize + 1;
    const to = from + page.data.length - 1;
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
            <p>{page.data.length > 0 ? `${from}–${to} of ${page.total}` : ''}</p>
            <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous page</button>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next page</button>
        </div>
    );
}
