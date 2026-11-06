import { useMemo } from 'react';
import { createRestDataSource } from 'apsw-gridwright';
import { Gridwright, type GridwrightColumn } from 'apsw-gridwright/react';

interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }
const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];
// The default capabilities claim sort, so the sort goes to a server that rejects it.
export function Solution() {
    const source = useMemo(() => createRestDataSource<Person>({ url: '/api/people' }), []);
    return <Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" />;
}
