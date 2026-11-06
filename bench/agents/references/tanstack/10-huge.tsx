import { useRef } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary' },
];

export function Solution({ people }: { people: Person[] }) {
    const table = useReactTable({ data: people, columns, getCoreRowModel: getCoreRowModel() });
    const rows = table.getRowModel().rows;
    const scroller = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scroller.current,
        estimateSize: () => 40,
        overscan: 10,
        initialRect: { width: 1000, height: 600 },
    });
    const items = virtualizer.getVirtualItems();
    const top = items[0]?.start ?? 0;
    const bottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
    return (
        <div ref={scroller} style={{ height: 600, overflow: 'auto' }}>
            <table aria-label="People" aria-rowcount={rows.length + 1}>
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
                    {top > 0 && <tr role="presentation" style={{ height: top }} />}
                    {items.map((item) => {
                        const row = rows[item.index]!;
                        return (
                            <tr key={row.id} style={{ height: 40 }} aria-rowindex={item.index + 2}>
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                                ))}
                            </tr>
                        );
                    })}
                    {bottom > 0 && <tr role="presentation" style={{ height: bottom }} />}
                </tbody>
            </table>
        </div>
    );
}
