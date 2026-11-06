import { useEffect, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef, type RowSelectionState } from '@tanstack/react-table';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    {
        id: 'select',
        header: () => <span>Selected</span>,
        cell: ({ row }) => (
            <input type="checkbox" aria-label={`Select row ${row.original.name}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
        ),
    },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution({ people, onSelectionChange }: { people: Person[]; onSelectionChange: (uuids: string[]) => void }) {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        onSelectionChange(Object.keys(rowSelection).filter((id) => rowSelection[id]));
    }, [rowSelection, onSelectionChange]);

    const table = useReactTable({
        data: people,
        columns,
        state: { rowSelection },
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        getRowId: (row) => row.uuid,
        getCoreRowModel: getCoreRowModel(),
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
                    <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
