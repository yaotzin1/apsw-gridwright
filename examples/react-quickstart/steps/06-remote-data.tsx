/**
 * Step 6 — The same grid, over a server.
 *
 * Compare this with step 1. The columns, the add-ons and every prop but one are unchanged: `data`
 * became `dataSource`. That is the whole migration, and it is the idea the package is built on.
 *
 * A data source declares which parts of the query it resolved for itself. Whatever it leaves
 * `false`, the pipeline applies in memory, on the rows that arrived. Nothing above the pipeline --
 * no add-on, no column, no component -- branches on where the rows came from.
 *
 * The fetcher below stands in for `fetch()`. In a real project you would usually write:
 *
 *     const source = createRestDataSource<Person>({ url: '/api/people' });
 *
 * which builds the query string, reads the total out of any of the usual response shapes, and
 * declares all four capabilities. `createRemoteDataSource` is the level below it: any async
 * function, with the capability declaration in your hands.
 *
 * Note what this source does *not* send: a total. So the grid says "of many" rather than inventing
 * a page count from the rows it happens to hold, and `isTotalExact` is false. A number a reader
 * would act on has to be a number the server actually knows.
 */
import { useMemo, useState } from 'react';
import { createRemoteDataSource } from 'apsw-gridwright';
import { Gridwright, search } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { money, people } from '../data';
import type { Person } from '../data';

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'department', header: 'Department' },
    { id: 'title', header: 'Title' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },
];

export function RemoteData() {
    const [latency, setLatency] = useState(400);
    const [sendsTotal, setSendsTotal] = useState(false);

    // A new source object refetches, so build it only when something it reads changes. An inline
    // `createRemoteDataSource({...})` in JSX would build a new one on every render and refetch for
    // ever.
    const source = useMemo(
        () =>
            createRemoteDataSource<Person>({
                // What the endpoint does for itself. This one only pages -- the common real case --
                // so the pipeline sorts, filters and searches the page it received.
                capabilities: { paginate: true, sort: false, filter: false, search: false },

                fetcher: async ({ query, signal }) => {
                    await new Promise((resolve) => setTimeout(resolve, latency));
                    // A real fetcher passes `signal` to `fetch` so a superseded request is aborted.
                    if (signal.aborted) throw new DOMException('aborted', 'AbortError');

                    const { pageIndex, pageSize } = query.pagination;
                    const start = pageIndex * pageSize;
                    const rows = people.slice(start, start + pageSize);

                    // Leaving `totalRows` out is the honest answer from an endpoint that does not
                    // count. The grid then infers "there is another page" from a full page having
                    // arrived, and says nothing more than that.
                    return sendsTotal ? { rows, totalRows: people.length } : { rows };
                },
            }),
        [latency, sendsTotal],
    );

    return (
        <div className="stack">
            <div className="row">
                <label>
                    latency{' '}
                    <select value={latency} onChange={(event) => setLatency(Number(event.target.value))}>
                        <option value={0}>none</option>
                        <option value={400}>400ms</option>
                        <option value={1500}>1.5s</option>
                    </select>
                </label>
                <label>
                    <input type="checkbox" checked={sendsTotal} onChange={(event) => setSendsTotal(event.target.checked)} /> the
                    server sends a total
                </label>
                <span className="muted">
                    Untick it and the row range says &ldquo;of many&rdquo;. The grid will not compute a total it was not given.
                </span>
            </div>

            <Gridwright<Person>
                columns={columns}
                dataSource={source}
                pageSize={4}
                aria-label="People"
                // Waits this long after the last keystroke before fetching.
                queryDebounceMs={250}
                addons={[search()]}
            />
        </div>
    );
}
