import { Gridwright, type GridwrightColumn } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Imię i nazwisko' },
    { id: 'department', header: 'Dział' },
    { id: 'salary', header: 'Pensja', align: 'end' },
];

export function Solution({ people }: { people: Person[] }) {
    return <Gridwright<Person> columns={columns} data={people} pageSize={25} aria-label="Osoby" />;
}
