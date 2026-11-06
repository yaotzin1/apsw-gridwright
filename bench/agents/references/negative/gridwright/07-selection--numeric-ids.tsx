import { Gridwright, type GridwrightColumn } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end' },
];

export function Solution({ people, onSelectionChange }: { people: Person[]; onSelectionChange: (uuids: string[]) => void }) {
    return (
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={25}
            aria-label="People"
            selectionMode="multiple"
            onSelectionChange={(ids) => onSelectionChange(ids.map(String))}
        />
    );
}
