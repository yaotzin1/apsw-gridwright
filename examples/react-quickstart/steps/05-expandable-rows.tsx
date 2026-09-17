/**
 * Step 5 — A row that expands into another grid.
 *
 * `rowDetail()` renders a panel under a row holding whatever that row needs. Here it is a second
 * `<Gridwright />` over the person's projects, which is the case the add-on exists for.
 *
 * Three things worth knowing:
 *
 *   - `render` is called only while a panel is open, and a collapsed panel is unmounted. A
 *     component that fetches its own data is therefore the lazy load; there is no `loadDetail`.
 *   - `useGridwrightContext()` *inside* the panel resolves to the inner grid. The outer one is the
 *     `grid` argument `render` is handed.
 *   - The panel is a row of the table and deliberately not a row of the grid. Opening one changes
 *     nothing about `aria-rowcount` or any row's `aria-rowindex`, because those describe the whole
 *     result set and the grid cannot know how many panels are open on pages it never fetched.
 *
 * `hasDetail` is asked before the toggle is drawn, so a person with no projects gets no control
 * that opens nothing. Returning `null` from `render` would also render no panel, but it costs a
 * render to discover.
 */
import { Gridwright, rowDetail } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { money, people } from '../data';
import type { Person, Project } from '../data';

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'department', header: 'Department' },
    { id: 'title', header: 'Title' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },
];

const projectColumns: GridwrightColumn<Project>[] = [
    { id: 'name', header: 'Project' },
    { id: 'role', header: 'Role' },
    { id: 'hours', header: 'Hours', align: 'end' },
];

export function ExpandableRows() {
    return (
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={5}
            aria-label="People"
            addons={[
                rowDetail<Person>({
                    // No toggle at all for someone with nothing to show.
                    hasDetail: (row) => row.data.projects.length > 0,
                    render: ({ data, close }) => (
                        <div className="stack">
                            <div className="detail-heading">
                                <strong>{data.name}</strong>
                                <button type="button" onClick={close}>
                                    close
                                </button>
                            </div>

                            {/* A whole grid inside a row. `coreAddons={false}` makes it a bare
                                table: no sort buttons, no page controls, nothing but the rows,
                                which is what a three-row list wants. */}
                            <Gridwright<Project>
                                columns={projectColumns}
                                data={data.projects}
                                coreAddons={false}
                                aria-label={`Projects of ${data.name}`}
                            />
                        </div>
                    ),
                }),
            ]}
        />
    );
}
