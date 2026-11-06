import { useMemo } from 'react';
import { createRemoteDataSource } from 'apsw-gridwright';
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
        () =>
            createRemoteDataSource<Person>({
                capabilities: { paginate: true, sort: false, filter: false, search: false },
                fetcher: async ({ query, signal }) => {
                    const { pageIndex, pageSize } = query.pagination;
                    const params = new URLSearchParams({ page: String(pageIndex + 1), pageSize: String(pageSize) });
                    const response = await fetch(`/api/people?${params}`, { signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const body = (await response.json()) as { data: Person[]; total: number };
                    return { rows: body.data, totalRows: body.total };
                },
            }),
        [],
    );
    return <Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" warnOnPageScopedQuery={false} />;
}
