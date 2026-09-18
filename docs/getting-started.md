# Getting started

From an empty React project to a grid over a paginating API, one step at a time. Each step is a
complete component you can paste into your own app.

Every step has a runnable file beside it in
[`examples/react-quickstart/`](../examples/react-quickstart/README.md):

```bash
git clone https://github.com/yaotzin1/apsw-gridwright && cd apsw-gridwright
npm install
npm run example:react     # http://localhost:5174
```

---

## Step 0 — Install

```bash
npm install apsw-gridwright
```

React 18 or 19 is an optional peer dependency, needed only for `apsw-gridwright/react`. The package
has **no runtime dependencies** of its own, so this adds nothing else to your tree.

Import the stylesheet once, anywhere in your app — your entry file is the usual place:

```tsx
import 'apsw-gridwright/styles.css';
```

It is structural only: every colour, size and radius is a CSS custom property, so theming is a
handful of overrides rather than a fork. Skip this import and the table renders, unstyled.

There are three entry points, and for most work you need only the second:

| Specifier | What is in it |
| :--- | :--- |
| `apsw-gridwright/react` | `<Gridwright />`, the add-ons, the hooks. **This is what you build with.** |
| `apsw-gridwright` | the headless engine and the data sources. No DOM, no React. |
| `apsw-gridwright/locales` | the translation packs: `de`, `es`, `fr`, `pl`, `en` |

---

## Step 1 — A grid

*[`steps/01-first-grid.tsx`](../examples/react-quickstart/steps/01-first-grid.tsx)*

```tsx
import { Gridwright } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';

interface Person {
    id: number;
    name: string;
    department: string;
    salary: number;
}

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end' },
];

export function People({ people }: { people: Person[] }) {
    return <Gridwright<Person> columns={columns} data={people} pageSize={25} aria-label="People" />;
}
```

That is a working grid. A column is a plain object and only `id` is required; `id` is also the
property read from the row, so `{ id: 'name' }` renders `person.name`.

**What you got without asking**, from the four core add-ons every grid starts with:

- sortable headers — each one a real `<button>`, with `aria-sort` on its cell
- page controls and a row range
- an empty state, a loading state and an error state with a retry
- a live region that says what changed
- a real `<table role="grid">`, with row positions counted across pages rather than within one

**Two things to get right now rather than later:**

- **Give every grid an `aria-label` or a `caption`.** Without one a screen reader announces "table"
  and stops.
- **Row identity comes from `id`.** If your rows key on something else, pass
  `getRowId={(row) => row.uuid}`. Selection, row menus and expanded panels are all keyed on it.

Writing `columns` inline in JSX is fine — the engine re-resolves columns only when something it
reads changes, not when the array's identity does.

---

## Step 2 — Make the columns say what you mean

*[`steps/02-columns.tsx`](../examples/react-quickstart/steps/02-columns.tsx)*

Three fields, three different jobs:

```tsx
const columns: GridwrightColumn<Person>[] = [
    // Text: what the reader sees, what search matches, and what an export writes.
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },

    // React: for anything that is not text.
    { id: 'email', header: 'Email', cell: ({ value }) => <a href={`mailto:${value}`}>{String(value)}</a> },

    // A value that is not a property of the row.
    { id: 'projectCount', header: 'Projects', accessor: (row) => row.projects.length, searchable: false },
];
```

**Reach for `formatValue` before `cell` whenever the answer is text.** The engine can search and
export a string; it can do neither with a `<span>`. A grid whose search misses what the reader can
plainly see is a grid nobody trusts.

`sortable`, `filterable`, `searchable` and `hidden` switch a column out of one job without removing
it from the others — a hidden column still sorts and searches.

Full list: [API reference → Columns](api.md#columns).

---

## Step 3 — Add the features you want

*[`steps/03-add-ons.tsx`](../examples/react-quickstart/steps/03-add-ons.tsx)*

Every feature is an entry in `addons`:

```tsx
import { Gridwright, columnFilters, exportMenu, search, urlSync } from 'apsw-gridwright/react';

<Gridwright<Person>
    columns={columns}
    data={people}
    aria-label="People"
    addons={[search(), columnFilters(), exportMenu({ filename: 'people' }), urlSync()]}
/>;
```

They compose rather than compete, and an add-on you write yourself has exactly the reach these have.
`urlSync()` renders nothing at all: it keeps the search, sort, filters and page in the address bar,
so a reload or a shared link opens on the same view. See [the view in the URL](url-sync.md).

`columnFilters()` reads a `filter` option on the column to decide which controls a header offers:

```tsx
{ id: 'department', header: 'Department', filter: { type: 'select', choices: [{ value: 'Engineering', label: 'Engineering' }] } }
{ id: 'salary', header: 'Salary', filter: { type: 'number' } }
```

**The four you did not list** — sorting, selection, pagination, the stale-rows notice — are
`coreAddons()`. Configure one without rebuilding the list:

```tsx
import { coreAddons } from 'apsw-gridwright/react';

coreAddons={coreAddons<Person>({ pagination: { pageSizeOptions: [5, 10, 25] } })}
```

Drop one by filtering the list, and `coreAddons={false}` renders a bare table.

> **Changing which add-ons are listed remounts the grid**, because each one's `setup` may call hooks
> and React requires the same hooks in the same order. Listing them conditionally
> (`showFilters && columnFilters()`) works; it just resets the page.

The rest: [add-ons](addons.md).

---

## Step 4 — Selection and row actions

*[`steps/04-selection.tsx`](../examples/react-quickstart/steps/04-selection.tsx)*

```tsx
<Gridwright<Person>
    columns={columns}
    data={people}
    aria-label="People"
    selectionMode="multiple"
    onSelectionChange={(ids, rows) => setSelected(rows)}
    addons={[rowActions<Person>({ items: [{ id: 'copy', label: 'Copy email', onSelect: (row) => copy(row.data.email) }] })]}
/>
```

Selection is **engine state**, not a view concern: `selectionMode` turns it on, `onSelectionChange`
reports it, and `api.toggleRowSelection` changes it. The checkbox column is the `selection()`
add-on's *view* of that state, which is why you can remove the checkboxes and keep selection:

```tsx
coreAddons={coreAddons<Person>({ selection: { checkboxes: false } })}
```

> Do that today and nothing built in selects a row any more — you drive it from your own UI through
> the API. Row-click and `Space` selection are specified and not yet written
> (`specs/selection-controls`).

---

## Step 5 — A row that expands

*[`steps/05-expandable-rows.tsx`](../examples/react-quickstart/steps/05-expandable-rows.tsx)*

When a line is not enough room, `rowDetail()` puts a panel under the row — including another grid:

```tsx
import { Gridwright, rowDetail } from 'apsw-gridwright/react';

addons={[
    rowDetail<Person>({
        hasDetail: (row) => row.data.projects.length > 0,
        render: ({ data }) => (
            <Gridwright<Project>
                columns={projectColumns}
                data={data.projects}
                coreAddons={false}
                aria-label={`Projects of ${data.name}`}
            />
        ),
    }),
]}
```

- **`render` runs only while the panel is open**, and a collapsed panel is unmounted. A component
  that fetches its own data is therefore the lazy load — there is no `loadDetail` to learn.
- **`hasDetail` is asked before the toggle is drawn**, so a row with nothing to show gets no control
  that opens nothing.
- `coreAddons={false}` on the inner grid gives a bare table: no sort buttons, no page controls.

More, including forms, persistence and the accessibility reasoning:
[expandable rows](row-detail.md).

---

## Step 6 — Point it at your server

*[`steps/06-remote-data.tsx`](../examples/react-quickstart/steps/06-remote-data.tsx)*

```tsx
import { createRestDataSource } from 'apsw-gridwright';

const source = createRestDataSource<Person>({ url: '/api/people' });

<Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" addons={[search()]} />;
```

**Compare that with step 1.** The columns, the add-ons and every prop but one are unchanged: `data`
became `dataSource`. That is the whole migration.

Your endpoint receives `GET /api/people?page=1&pageSize=25&sort=salary%3Adesc&search=ada&filters=[...]`
(`page` is one-based) and may answer with an array, `{ data, total }`, `{ items, count }`, a nested
`meta.total`, or an `X-Total-Count` header. You now also get request cancellation, rejection of
out-of-order responses, and backoff on retryable failures.

### The one idea worth understanding

A data source **declares which parts of the query it resolved for itself**. Whatever it leaves
`false`, the pipeline applies in memory on the rows that arrived.

```ts
import { createRemoteDataSource } from 'apsw-gridwright';

const source = createRemoteDataSource<Person>({
    // The common real case: the endpoint pages, and nothing else.
    capabilities: { paginate: true, sort: false, filter: false, search: false },
    fetcher: async ({ query, signal }) => {
        const response = await fetch(`/api/people?page=${query.pagination.pageIndex + 1}`, { signal });
        return { rows: await response.json() };
    },
});
```

| Your source | Declares | The pipeline does |
| :--- | :--- | :--- |
| an array | nothing | filter, search, sort, paginate |
| a full query API | everything | nothing |
| an endpoint that only pages | `paginate` | filter, search, sort, on the page received |

Nothing above the pipeline branches on any of it — not a column, not an add-on, not your component.

**On totals.** Omit `totalRows` and the grid says "1–25 of many" rather than computing a page count
from the rows it happens to hold. That is deliberate: a number a reader would act on has to be a
number your server actually knows. See [data sources](data-sources.md).

---

## Where to go next

| You want to | Read |
| :--- | :--- |
| look up a prop, column field or option | [API reference](api.md) |
| know which add-on does what, or write one | [Add-ons](addons.md) |
| load from a server properly | [Data sources](data-sources.md) |
| show hierarchy | [Tree data](tree.md) |
| render 100,000 rows | [Virtualization](virtualization.md) |
| resize, pin or hide columns | [Column layout](column-layout.md) |
| translate the grid | [i18n](i18n.md) |
| understand the keyboard and screen-reader contract | [Accessibility](accessibility.md) |

## Common mistakes

| Symptom | Cause |
| :--- | :--- |
| The grid refetches forever | A data source built inline in JSX. A new source object means a new fetch — build it in `useMemo`. |
| The grid resets to page 1 when a switch is flipped | The list of add-on **names** changed, which remounts the grid by design. Expected; not a bug. |
| Search does not match what is on screen | The column uses `cell` where it should use `formatValue`. The engine searches values, not rendered output. |
| A screen reader says only "table" | No `aria-label` and no `caption`. |
| Everything is unstyled | `apsw-gridwright/styles.css` was never imported. |
| The row range says "of many" | Your source sent no total. Send `totalRows` if the server knows it; the grid will not invent one. |
