/**
 * Step 3 — Features are add-ons.
 *
 * Every feature of the grid is an entry in `addons={[...]}`: search, column filters, export. They
 * compose rather than compete, and an add-on you write yourself has exactly the reach these have.
 *
 * The four you did not list -- sorting, selection, pagination and the stale-rows notice -- are
 * `coreAddons()`, on unless you say otherwise. Configure one without rebuilding the list:
 *
 *     coreAddons={coreAddons<Person>({ pagination: { pageSizeOptions: [5, 10, 25] } })}
 *
 * Drop one by filtering the list, and `coreAddons={false}` renders a bare table.
 *
 * **Changing which add-ons are listed remounts the grid**, because each one's `setup` may call
 * hooks and React requires the same hooks in the same order. Listing them conditionally
 * (`on && columnFilters()`) is fine; it just resets the page.
 */
import { Gridwright, coreAddons, columnFilters, exportMenu, search } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { day, money, people } from '../data';
import type { Person } from '../data';

// `filter` tells `columnFilters()` what the column holds, so the header dialog offers the right
// controls: a set of values for a choice, two boxes for a range.
const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200 },
    {
        id: 'department',
        header: 'Department',
        filter: {
            type: 'select',
            choices: [
                { value: 'Engineering', label: 'Engineering' },
                { value: 'Research', label: 'Research' },
                { value: 'Operations', label: 'Operations' },
                { value: 'Design', label: 'Design' },
            ],
        },
    },
    { id: 'title', header: 'Title' },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        formatValue: (value) => money.format(Number(value)),
        filter: { type: 'number' },
    },
    {
        id: 'startedOn',
        header: 'Started',
        formatValue: (value) => day.format(new Date(String(value))),
        filter: { type: 'date' },
    },
];

export function WithAddons() {
    return (
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={5}
            aria-label="People"
            // The core four, with page sizes of this grid's choosing.
            coreAddons={coreAddons<Person>({ pagination: { pageSizeOptions: [5, 10, 25] } })}
            addons={[
                search(),
                columnFilters(),
                exportMenu({ filename: 'people' }),
            ]}
        />
    );
}
