# Filtering by column

One add-on puts a filter button in every header:

```tsx
import { Gridwright, columnFilters } from 'apsw-gridwright/react';

<Gridwright columns={columns} data={people} addons={[columnFilters()]} />
```

The reader opens a column's filter, chooses a condition, enters a value and applies it. A filtered
column's button is drawn in the accent colour and its name says "filtered", and a "Clear filters"
button appears in the toolbar for as long as any filter is on.

Global search (the `search()` add-on) is still there and still different: it matches text in every
column at once. A column filter asks one column one question, `Salary > 100,000` or
`Started before 2020`, and both apply together:

```tsx
<Gridwright columns={columns} data={people} addons={[search(), columnFilters()]} />
```

## Saying what a column holds

A column filters as text unless it says otherwise. Say what it holds with `filter.type`, and the
type decides which conditions the reader gets and which input they type into:

```tsx
const columns = [
    { id: 'name', header: 'Name' },                                   // text
    { id: 'salary', header: 'Salary', filter: { type: 'number' } },
    { id: 'startedOn', header: 'Started', filter: { type: 'date' } },
    {
        id: 'department',
        header: 'Department',
        filter: {
            type: 'select',
            choices: [
                { value: 'Engineering', label: 'Engineering' },
                { value: 'Research', label: 'Research' },
            ],
        },
    },
    { id: 'actions', header: '', filterable: false },                 // no filter button
];
```

| Type | Conditions | Input |
| :--- | :--- | :--- |
| `text` | contains, does not contain, equals, starts with, ends with, is empty, is not empty | a text box |
| `number` | equals, does not equal, greater than, greater than or equal to, less than, less than or equal to, between, is empty, is not empty | a number box, two for between |
| `date` | on, after, before, between, is empty, is not empty | a date picker, two for between |
| `select` | is any of, is none of | a checkbox per choice |

`filter.operators` narrows or reorders the list, and its first entry is where a new filter starts:

```ts
{ id: 'salary', filter: { type: 'number', operators: ['gte', 'lte', 'between'] } }
```

The table is exported as `COLUMN_FILTER_OPERATORS` for anything you build around it, and
`operatorLabel(t, operator, type)` names a condition the way the dialog does, with a translate
function from `useAddonMessages('gridwright:filters', filterMessages)`.

**The type is declared, never guessed.** A type inferred from the rows on one page is a guess the
reader would act on, and a column of numbers with one blank cell would be guessed wrong.

**A boolean is a select of two.** The `value` is what the filter sends and compares; the `label` is
what the reader sees, already translated, because a choice only you define is a string only you can
translate:

```ts
filter: { type: 'select', choices: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] }
```

**A date compares the whole value.** "On" is `eq`, so a column holding date-times rather than dates
matches "on" only at midnight. Offer `between` on such a column; the filter will not rewrite "on"
into a range for you, because the server would then receive a condition the reader did not choose.

## Nothing reaches the grid until Apply

The dialog edits a draft. Typing changes nothing; Apply, or Enter in a field, commits it. Escape and a
click outside throw the draft away. So one decision is one query, and a server is not asked for
`1`, `10`, `100` and `1000` on the way to `10000`. Apply stays off until the condition is complete:
a blank value, a missing bound, a number that does not parse, or no choice ticked.

Applying, changing or clearing a filter returns the grid to page one, because page twelve of a
narrower result is usually empty, and an empty page reads as "nothing matched".

## Where the filtering runs

The dialog calls `api.setFilter(columnId, { operator, value })`, exactly what your own code would
call, so the filter travels the one code path every filter travels:

| The source declares | What happens |
| :--- | :--- |
| nothing (an array) | the `core:filter` stage applies it in memory, through the column's `filterFn` if it has one |
| `filter: true` | the stage steps aside, and the source receives the filter in `query.filters` |
| a tree | the tree stage applies it and keeps the folders above a match |

What the source receives is the core `FilterSpec`, and every value survives JSON:

```json
[
    { "columnId": "salary", "operator": "between", "value": [100000, 125000] },
    { "columnId": "startedOn", "operator": "lt", "value": "2020-01-01" },
    { "columnId": "department", "operator": "in", "value": ["Research", "Operations"] },
    { "columnId": "city", "operator": "isEmpty" }
]
```

`createRestDataSource` already sends that as a `filters` query parameter. A server that declares
`filter: true` should give each operator the meaning `matchesFilter` gives it on the client, or the
same filter will answer differently depending on where it ran.

## Composing it yourself

`columnFilters()` is an add-on named `gridwright:filters`, and every part of it is a contribution
any add-on could make: `ColumnFilterProvider` as a provider around the grid's content, a
`ColumnFilterTrigger` after each filterable header's label, `data-filtered` on the header cell,
`GridFilterClear` in the toolbar while a filter is on, and an announcement contributor. Listed in a
hand-built layout, it keeps all of them, because the shell's parts render contributions from
context:

```tsx
const instance = useGridwright({ columns, data: people, addons: [columnFilters()] });

<GridwrightProvider instance={instance}>
    <GridRoot>                     {/* applies the add-on's provider, so the dialog has a home */}
        <GridToolbar />            {/* "Clear filters" while a filter is on */}
        <GridTable aria-label="People">
            <GridHeader />         {/* a trigger in every filterable header */}
            <GridBody />
        </GridTable>
    </GridRoot>
</GridwrightProvider>
```

Leave out `GridRoot` and the provider is missing, so the triggers have no dialog to open.
`GridFilterClear` can equally be placed anywhere else inside the root, in a page header of your own
for instance.

A `ColumnFilterTrigger` placed anywhere else, a custom `headerCell` for instance, takes a
`columnId`, and draws nothing for a column that is not `filterable`, so it can be placed in every
column without checking.

The provider renders one dialog, inside the grid root but after its children rather than inside a
header cell, for two reasons. The table wrapper scrolls, and a scroll container clips, so a dialog inside the table is cut
off, worst of all under the short table a filter leaves behind. And anything inside a `<th>` becomes
part of that column header's accessible name, which a screen reader repeats on every cell of the
column.

## Styling

| Class or attribute | Is |
| :--- | :--- |
| `gw-filter-trigger`, `[data-active='true']` | the header button, and its filtered state |
| `gw-header-cell[data-filtered='true']` | a filtered column's header cell |
| `gw-filter-dialog` | the dialog; `classNames.filterDialog` adds your own |
| `gw-filter-field`, `gw-filter-input`, `gw-filter-range`, `gw-filter-choices` | its fields |
| `gw-filter-actions`, `gw-filter-apply`, `gw-filter-clear` | its buttons |
| `gw-filter-clear-all` | the toolbar button |

Everything is drawn from the same custom properties as the rest of the grid, so a theme needs no
filter-specific overrides. The dialog is `position: fixed`, which is what lets it hang below a header
inside a scrolling wrapper; inside an ancestor with a CSS `transform` it would be positioned against
that ancestor instead.

## Accessibility

- The trigger is a `<button>` beside the sort button, never inside it, with `aria-haspopup="dialog"`,
  `aria-expanded`, and a name that says the column and whether it is filtered.
- The dialog is `role="dialog"` with `aria-modal="true"`, named "Filter {column}". Opening it moves
  focus to the condition; Tab and Shift+Tab stay inside it; Escape, Apply and Clear filter put focus
  back on the trigger.
- "Clear filters" moves focus to the first filter button before it disappears, so the reader is not
  left on the page body.
- Once the rows settle, the grid's live region says "{column}, filtered" or "{column}, filter
  removed". The add-on contributes that sentence at priority 10, below a sort's 20, so a change that
  sorted and filtered at once names the sort. Clearing several filters at once says only the row
  range, because naming one column as "filter removed" would imply the others are still on.
- `aria-sort` stays on the header cell; the sorting add-on puts it there.

## Translation

Every string, the conditions included, is under `gridwright:filters`, and the packs in
`apsw-gridwright/locales` translate all of them in all five shipped locales. The keys are the add-on's
own: `open`, `openActive`, `condition`, `value`, `from`, `to`, `values`, `apply`, `clear`, `clearAll`
(plural), `applied`, `removed`, and one `op.<operator>` per condition (`op.contains`, `op.between`,
`op.in` and so on), with `op.on`, `op.after` and `op.before` for `eq`, `gt` and `lt` on a date column.
Override one through `messages`, under the add-on's name:

```tsx
<Gridwright messages={{ 'gridwright:filters.apply': 'Filter', 'gridwright:filters.op.between': 'In the range' }} />
```

See [Translation](i18n.md) for the order a key resolves in.
