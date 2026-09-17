/**
 * Step 1 — A grid.
 *
 * Two props and a list of columns. What you get without asking for anything:
 *
 *   - sortable headers, each one a real `<button>` with `aria-sort` on its cell
 *   - page controls and a row range below the table
 *   - a live region that says what changed
 *   - an empty state, a loading state and an error state
 *   - a real `<table role="grid">` with row positions counted across pages, not within one
 *
 * Those come from the four core add-ons every grid starts with. You did not list them, and you can
 * take them away: see step 3.
 *
 * A column is a plain object and only `id` is required. `id` is also the property read from the
 * row, so `{ id: 'name' }` renders `person.name` and the header falls back to the id.
 */
import { Gridwright } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { people } from '../data';
import type { Person } from '../data';

// Typed, so `id` is checked against Person and a renderer knows what it is handed. Writing the
// array inline in JSX is fine too -- the engine re-resolves columns only when something it reads
// changes, not when the array's identity does.
const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'title', header: 'Title' },
    { id: 'salary', header: 'Salary', align: 'end' },
];

export function FirstGrid() {
    return (
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={5}
            // Give every grid an accessible name, or a `caption`. Without one a screen reader
            // announces "table" and nothing else.
            aria-label="People"
        />
    );
}
