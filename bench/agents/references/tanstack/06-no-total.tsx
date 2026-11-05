import { useEffect, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution() {
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [rows, setRows] = useState<Person[] | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ page: String(pagination.pageIndex + 1), pageSize: String(pagination.pageSize) });
        fetch(`/api/people?${params}`, { signal: controller.signal })
            .then((response) => response.json() as Promise<Person[]>)
            .then(setRows)
            .catch(() => undefined);
        return () => controller.abort();
    }, [pagination]);

    const data = rows ?? [];
    // No total exists: pageCount -1 means "unknown", and a short page is the last one.
    const table = useReactTable({
        data,
        columns,
        pageCount: -1,
        state: { pagination },
        onPaginationChange: setPagination,
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
    });
    const hasMore = rows !== null && data.length === pagination.pageSize;
    const from = pagination.pageIndex * pagination.pageSize + 1;
    return (
        <div>
            <table aria-label="People">
                <thead>
                    {table.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                            {group.headers.map((header) => (
                                <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
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
            <p>{data.length > 0 ? `${from}–${from + data.length - 1}${hasMore ? ' of many' : ''}` : ''}</p>
            <button type="button" onClick={() => table.previousPage()} disabled={pagination.pageIndex === 0}>Previous page</button>
            <button type="button" onClick={() => table.nextPage()} disabled={!hasMore}>Next page</button>
        </div>
    );
}
