/**
 * Step 4 — Selection and row actions.
 *
 * Selection is engine state, not a view concern: `selectionMode` turns it on, `onSelectionChange`
 * reports it, and `api.toggleRowSelection` and friends change it. The checkbox column is the
 * `selection()` core add-on's *view* of that state, which is why you can remove the checkboxes
 * without removing selection:
 *
 *     coreAddons={coreAddons<Person>({ selection: { checkboxes: false } })}
 *
 * Do that today and nothing built in selects a row any more -- you would drive it from your own
 * UI through the API. Row-click and Space selection are specified and not yet written
 * (`specs/selection-controls`).
 *
 * `rowActions()` floats a menu over the row under the pointer or the keyboard focus. It attaches
 * through the add-on contract rather than by reaching into the DOM, so it works over a paged body,
 * a windowed one and a tree alike.
 */
import { useState } from 'react';
import { Gridwright, rowActions } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { money, people } from '../data';
import type { Person } from '../data';

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'department', header: 'Department' },
    { id: 'title', header: 'Title' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },
];

export function SelectionAndActions() {
    const [selected, setSelected] = useState<Person[]>([]);
    const [note, setNote] = useState('');

    return (
        <div className="stack">
            <p className="muted">
                {selected.length === 0 ? 'Nothing selected.' : `${selected.length} selected: ${selected.map((p) => p.name).join(', ')}`}
                {note && ` — ${note}`}
            </p>

            <Gridwright<Person>
                columns={columns}
                data={people}
                pageSize={5}
                aria-label="People"
                selectionMode="multiple"
                // Both the ids and the rows, so you rarely have to look anything up yourself.
                onSelectionChange={(_ids, rows) => setSelected([...rows])}
                addons={[
                    rowActions<Person>({
                        items: [
                            // `onSelect` is handed the GridRow, so `row.data` is your Person and `row.id` its identity.
                            { id: 'copy', label: 'Copy email', onSelect: (row) => setNote(`copied ${row.data.email}`) },
                            { id: 'note', label: 'Flag for review', onSelect: (row) => setNote(`flagged ${row.data.name}`) },
                        ],
                    }),
                ]}
            />
        </div>
    );
}
