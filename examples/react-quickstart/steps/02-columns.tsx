/**
 * Step 2 — Columns that format and render.
 *
 * Three different jobs, deliberately three different fields:
 *
 *   formatValue   the text on screen, in global search, and in exports
 *   cell          React, for anything that is not text
 *   icon          a glyph beside the cell's content, resolved per row
 *
 * `formatValue` rather than `cell` wherever the answer is text, because the engine can search and
 * export a string and cannot do either with a `<span>`. A grid where search misses what the reader
 * can plainly see is a grid nobody trusts.
 *
 * `accessor` reads a value that is not a top-level property. `sortable`, `filterable`, `searchable`
 * and `hidden` switch a column out of one job without removing it from the others.
 */
import { Gridwright } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { day, money, people } from '../data';
import type { Person } from '../data';

const columns: GridwrightColumn<Person>[] = [
    {
        id: 'name',
        header: 'Name',
        width: 200,
        // Resolved per row, so an inactive person is marked without a column of their own.
        icon: ({ row }) => (
            <span aria-hidden="true" style={{ color: row.active ? '#16a34a' : '#94a3b8' }}>
                ●
            </span>
        ),
    },
    { id: 'department', header: 'Department' },
    {
        id: 'email',
        header: 'Email',
        // React, because a link is not text. The value is still searchable and exportable, because
        // the engine reads it from the row rather than from what this renders.
        cell: ({ value }) => <a href={`mailto:${String(value)}`}>{String(value)}</a>,
    },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        // Text, so search and every export agree with the screen.
        formatValue: (value) => money.format(Number(value)),
    },
    {
        id: 'startedOn',
        header: 'Started',
        formatValue: (value) => day.format(new Date(String(value))),
    },
    {
        id: 'projectCount',
        header: 'Projects',
        align: 'end',
        // Not a property of the row: `accessor` computes it, and sorting sorts by the number.
        accessor: (row) => row.projects.length,
        // Nothing to search for in a count.
        searchable: false,
    },
];

export function FormattedColumns() {
    return <Gridwright<Person> columns={columns} data={people} pageSize={5} aria-label="People" />;
}
