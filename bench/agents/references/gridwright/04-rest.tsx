import { useMemo } from 'react';
import { createRestDataSource } from 'apsw-gridwright';
import { Gridwright, type GridwrightColumn } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end' },
];

export function Solution() {
    const source = useMemo(
        () => createRestDataSource<Person>({ url: '/api/people', capabilities: { paginate: true, sort: true, search: true, filter: false } }),
        [],
    );
    return <Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" />;
}
