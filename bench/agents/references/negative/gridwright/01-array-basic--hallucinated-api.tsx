import { Gridwright, usePagination, type GridwrightColumn } from 'apsw-gridwright/react';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

// WRONG on purpose: an export, a prop and a column field that do not exist, the way an agent
// guessing from other grids writes them. Each must count as an API error.
const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

export function Solution({ people }: { people: Person[] }) {
    void usePagination;
    return <Gridwright<Person> columns={columns} rows={people} pagination={{ pageSize: 25 }} aria-label="People" />;
}
