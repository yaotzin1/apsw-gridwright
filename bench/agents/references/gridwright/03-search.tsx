import { Gridwright, search, type GridwrightColumn } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department', searchable: false },
    { id: 'salary', header: 'Salary', align: 'end', searchable: false },
];

export function Solution({ people }: { people: Person[] }) {
    return <Gridwright<Person> columns={columns} data={people} pageSize={25} aria-label="People" addons={[search()]} />;
}
