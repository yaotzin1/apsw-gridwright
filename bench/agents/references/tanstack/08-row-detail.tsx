import { Fragment } from 'react';
import { flexRender, getCoreRowModel, getExpandedRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    {
        id: 'expand',
        header: () => <span>Details</span>,
        cell: ({ row }) => (
            <button type="button" aria-expanded={row.getIsExpanded()} onClick={row.getToggleExpandedHandler()}>
                {`${row.getIsExpanded() ? 'Hide' : 'Show'} details for ${row.original.name}`}
            </button>
        ),
    },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution({ people }: { people: Person[] }) {
    const table = useReactTable({
        data: people,
        columns,
        getRowCanExpand: () => true,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    });
    return (
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
                    <Fragment key={row.id}>
                        <tr>
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                            ))}
                        </tr>
                        {row.getIsExpanded() && (
                            <tr role="presentation">
                                <td role="presentation" colSpan={row.getVisibleCells().length}>
                                    <div role="region" aria-label={`Details for ${row.original.name}`}>{row.original.email}</div>
                                </td>
                            </tr>
                        )}
                    </Fragment>
                ))}
            </tbody>
        </table>
    );
}
