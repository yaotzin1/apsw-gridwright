# React playbook

Recipes indexed by the job you have, not by the feature that solves it. Every recipe is complete
code you can paste, followed by the part that bites.

New to the package? Read [Getting started](getting-started.md) first — it builds the same knowledge
in six steps. This page assumes you have a grid rendering and now have a real requirement.

- [Pick your setup](#pick-your-setup)
- [1. Read-only grid over an endpoint](#1-read-only-grid-over-an-endpoint)
- [2. The server does everything](#2-the-server-does-everything)
- [3. The server only pages](#3-the-server-only-pages)
- [4. Editable cells that persist](#4-editable-cells-that-persist)
- [5. Master–detail: a grid inside a row](#5-masterdetail-a-grid-inside-a-row)
- [6. Remember what the user changed](#6-remember-what-the-user-changed)
- [7. Very large result sets](#7-very-large-result-sets)
- [8. A feature the package does not have](#8-a-feature-the-package-does-not-have)
- [9. Testing a grid](#9-testing-a-grid)
- [10. Theming to a design system](#10-theming-to-a-design-system)
- [11. Translating it](#11-translating-it)
- [Traps](#traps)

---

## Pick your setup

Answer two questions and the rest follows.

**Where do the rows live?**

| Situation | Prop | Recipe |
| :--- | :--- | :--- |
| An array you already have | `data={rows}` | [Getting started](getting-started.md#step-1--a-grid) |
| A REST endpoint | `dataSource={createRestDataSource({ url })}` | [1](#1-read-only-grid-over-an-endpoint) |
| Anything async — GraphQL, a client SDK, tRPC | `dataSource={createRemoteDataSource({ fetcher })}` | [3](#3-the-server-only-pages) |
| Hundreds of thousands of rows, scrolled | `createWindowedDataSource` + `virtualRows()` | [7](#7-very-large-result-sets) |

**What does your server do for itself?** This is the question the package is built around, and
getting it wrong is the single most common integration bug.

| Your endpoint | `capabilities` | The pipeline then does |
| :--- | :--- | :--- |
| returns everything, unsorted | all `false` (or use `data`) | filter, search, sort, paginate |
| accepts sort, filter, search and page | all `true` (the default for remote) | nothing |
| **accepts only `page` and `pageSize`** | `{ paginate: true }`, rest `false` | filter, search, sort **on the page received** |

That third row is the common real case. Declaring `sort: true` when your endpoint ignores `sort`
produces a grid whose header buttons do nothing and where nobody can tell you why.

---

## 1. Read-only grid over an endpoint

```tsx
import { createRestDataSource } from 'apsw-gridwright';
import { Gridwright, search } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

interface Person { id: number; name: string; department: string; salary: number }

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (v) => money.format(Number(v)) },
];

// Module scope, or useMemo. Never inline in JSX -- see the traps.
const source = createRestDataSource<Person>({ url: '/api/people' });

export function People() {
    return <Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" addons={[search()]} />;
}
```

Your endpoint receives, with `page` **one-based**:

```
GET /api/people?page=1&pageSize=25&sort=salary:desc&search=ada&filters=[{"columnId":"department","operator":"eq","value":"Research"}]
```

and may answer with an array, `{ data, total }`, `{ items, count }`, a nested `meta.total`, or an
`X-Total-Count` header. All are read.

**Authentication** — `headers` may be a function, so a token is fetched per request rather than
captured once:

```tsx
createRestDataSource<Person>({
    url: '/api/people',
    headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
    credentials: 'include',
});
```

**A different wire format** — replace the vocabulary rather than reshaping your API:

```tsx
createRestDataSource<Person>({
    url: '/api/people',
    buildParams: (query) => ({
        offset: String(query.pagination.pageIndex * query.pagination.pageSize),
        limit: String(query.pagination.pageSize),
        order_by: query.sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.columnId}`).join(','),
    }),
    parseResponse: (payload) => {
        const body = payload as { results: Person[]; count: number };
        return { rows: body.results, totalRows: body.count };
    },
});
```

More: [Data sources](data-sources.md).

---

## 2. The server does everything

Nothing to configure — `createRestDataSource` declares all four capabilities by default. Add the
add-ons and they drive the server instead of the pipeline:

```tsx
<Gridwright<Person>
    columns={columns}
    dataSource={source}
    pageSize={25}
    aria-label="People"
    // Waits 250ms after the last keystroke before issuing a request.
    queryDebounceMs={250}
    addons={[search(), columnFilters()]}
/>
```

You get request cancellation, rejection of out-of-order responses and backoff on retryable failures
without writing any of it. The previous rows stay on screen while the next ones load
(`keepPreviousData`, on by default), so the table does not collapse and spring back on every page.

---

## 3. The server only pages

The most common real case, and the reason `capabilities` is a declaration rather than a boolean.

```tsx
import { createRemoteDataSource } from 'apsw-gridwright';

const source = createRemoteDataSource<Person>({
    // Say what is true. The pipeline covers the rest, on the rows that arrived.
    capabilities: { paginate: true, sort: false, filter: false, search: false },

    fetcher: async ({ query, signal }) => {
        const { pageIndex, pageSize } = query.pagination;
        const response = await fetch(`/api/people?page=${pageIndex + 1}&size=${pageSize}`, { signal });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const body = (await response.json()) as { rows: Person[]; total?: number };
        // Omit totalRows when the server genuinely does not count. The grid then says
        // "1-25 of many" instead of inventing a page count from the rows it holds.
        return body.total === undefined ? { rows: body.rows } : { rows: body.rows, totalRows: body.total };
    },
});
```

**Pass `signal` to `fetch`.** It is aborted when the query changes again or the grid unmounts;
ignoring it means a slow response for page 1 can land after page 2 and overwrite it.

The same shape wraps a GraphQL client, a generated SDK or tRPC — anything with an async function.

---

## 4. Editable cells that persist

Two pieces: `edit` on the column says *what* is editable, `inlineEditing({ commit })` says *where it
goes*.

```tsx
import { inlineEditing } from 'apsw-gridwright/react';

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', edit: {} },
    {
        id: 'department',
        header: 'Department',
        edit: {
            inputType: 'select',
            choices: [
                { value: 'Engineering', label: 'Engineering' },
                { value: 'Research', label: 'Research' },
            ],
        },
    },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        formatValue: (v) => money.format(Number(v)),
        // Only managers' salaries are editable, decided per row.
        edit: { inputType: 'number', editable: (row) => row.canEditPay },
    },
];

<Gridwright<Person>
    columns={columns}
    dataSource={source}
    aria-label="People"
    addons={[
        inlineEditing({
            commit: async (rowId, columnId, value) => {
                const response = await fetch(`/api/people/${rowId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [columnId]: value }),
                });
                // Throwing is how you reject an edit: the cell reverts and reports it.
                if (!response.ok) throw new Error(await response.text());
                source.invalidate(); // refetch, so the row reflects what the server stored
            },
        }),
    ]}
/>;
```

**`commit` is the whole contract.** Returning resolves the edit; throwing rejects it and the cell
goes back to what it was. Do not also mutate your own state optimistically — you would then have two
sources of truth for the same cell.

For an editor the built-ins do not cover — a combobox, a date picker of your own — use
`edit: { editor: ({ value, commit, cancel }) => <MyEditor ... /> }`.

More: [Persistence](persistence.md).

---

## 5. Master–detail: a grid inside a row

```tsx
import { rowDetail } from 'apsw-gridwright/react';

<Gridwright<Order>
    columns={orderColumns}
    dataSource={orders}
    aria-label="Orders"
    addons={[
        rowDetail<Order>({
            hasDetail: (row) => row.data.lineCount > 0,
            render: ({ data }) => <OrderLines orderId={data.id} />,
        }),
    ]}
/>;

// The panel mounts when it opens and unmounts when it closes, so this *is* the lazy load.
function OrderLines({ orderId }: { orderId: string }) {
    const source = useMemo(() => createRestDataSource<Line>({ url: `/api/orders/${orderId}/lines` }), [orderId]);
    return <Gridwright<Line> columns={lineColumns} dataSource={source} coreAddons={false} aria-label="Line items" />;
}
```

- **`hasDetail` is asked before the toggle is drawn**, so a row with nothing to show gets no control
  that opens nothing. Prefer it to returning `null` from `render`, which costs a render to discover.
- **`coreAddons={false}`** gives the inner grid a bare table: no sort buttons, no page controls.
- **`useGridwrightContext()` inside the panel resolves to the inner grid.** The outer one is the
  `grid` argument `render` receives.
- **It cannot be combined with `virtualRows()`** and throws if you list both, because windowing
  places rows by a fixed height and a panel is as tall as its content.

A form instead of a grid works exactly the same way: return your form from `render` and let your own
submit handler decide when it saves.

More: [Expandable rows](row-detail.md).

---

## 6. Remember what the user changed

Three separate things get remembered, and they are deliberately three separate seams.

**The query** — sort, filters, search, page:

```tsx
const [query, setQuery] = useState(() => {
    const saved = sessionStorage.getItem('people.query');
    return saved ? (JSON.parse(saved) as Partial<GridQuery>) : undefined;
});

<Gridwright<Person>
    columns={columns}
    dataSource={source}
    initialQuery={query}
    onQueryChange={(next) => sessionStorage.setItem('people.query', JSON.stringify(next))}
    aria-label="People"
/>;
```

`initialQuery` is read once. Passing a new object on every render does not re-apply it — that is the
point, or the grid could never move off the saved page.

**The column layout** — widths, pinning, visibility, order:

```tsx
columnLayout({
    initial: JSON.parse(localStorage.getItem('people.layout') ?? '{}'),
    onChange: (layout) => localStorage.setItem('people.layout', JSON.stringify(layout)),
});
```

`onChange` does **not** fire on mount, so it cannot overwrite a saved layout on the first paint.

**Which panels are open** — `rowDetail({ initialExpanded, onExpandedChange })`, same rule.

To put any of this in the URL instead, replace `localStorage` with your router. Nothing about the
grid cares which you chose.

---

## 7. Very large result sets

Two different problems with two different answers. Diagnose before reaching.

| Problem | Answer |
| :--- | :--- |
| Too many rows **rendered** (the DOM is huge, scrolling stutters) | `virtualRows()` |
| Too many rows **held** (the array does not fit in memory) | `createWindowedDataSource` |
| Both — ten million rows on a server | the two together |

```tsx
import { createWindowedDataSource } from 'apsw-gridwright';
import { virtualRows } from 'apsw-gridwright/react';

const source = createWindowedDataSource<Person>({
    blockSize: 200,   // rows per request
    maxBlocks: 12,    // ~2,400 rows in memory, whatever the table's size
    fetchRange: async ({ offset, limit, query, signal }) => {
        const response = await fetch(`/api/people?offset=${offset}&limit=${limit}`, { signal });
        const body = (await response.json()) as { rows: Person[]; total: number };
        // `totalRows` is required here, unlike a paging source: it is the scrollbar's height, and a
        // virtual grid that does not know it cannot tell a reader how near the end they are.
        return { rows: body.rows, totalRows: body.total };
    },
});

<Gridwright<Person>
    columns={columns}
    dataSource={source}
    // Under virtualRows this is the size of each fetched window, not a page anyone turns.
    pageSize={100}
    aria-label="People"
    addons={[virtualRows({ rowHeight: 40, height: 600 })]}
/>;
```

**`rowHeight` must match `--gw-row-height`.** The virtualizer is arithmetic — no per-row measurement,
by design — so if the two disagree the rows drift away from the scrollbar. If you theme the row
height, pass the same number here.

Because it is fixed-height arithmetic, a row taller than `rowHeight` overflows its slot. That is why
`rowDetail()` refuses to be listed beside it.

More: [Virtualization](virtualization.md).

---

## 8. A feature the package does not have

Write an add-on. It is the same contract every built-in feature uses, with no privileged access:

```tsx
import { columnCountOf, type GridAddon } from 'apsw-gridwright/react';

const overdue = (): GridAddon<Invoice> => ({
    name: 'acme:overdue',
    setup: () => ({
        // Attributes only: className, style, on*, aria-*, data-* and a short inert list.
        cellAttributes: (row, column) =>
            column.id === 'dueOn' && row.data.dueOn < today ? { className: 'is-overdue' } : {},
        toolbar: () => <OverdueCount />,
        // A subtotal or a panel under a row.
        rowAfter: (row, grid) =>
            row.data.isLastOfGroup ? (
                <tr role="presentation">
                    <td role="presentation" colSpan={columnCountOf(grid)}>Group total: {row.data.groupTotal}</td>
                </tr>
            ) : undefined,
    }),
});
```

If the seam you need does not exist, that is a gap in the contract rather than a reason to reach
around it — the built-ins have no slot you do not.

Below the renderer, a **pipeline plugin** transforms rows for local and remote data alike:
[Writing a plugin](plugins.md). The full map of what is open and what is deliberately closed is in
[Extensibility](extensibility.md).

---

## 9. Testing a grid

Query by role, the way a user and a screen reader reach it. The grid is a real `<table role="grid">`,
so everything has one.

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('sorts when a header is activated', async () => {
    const user = userEvent.setup();
    render(<Gridwright<Person> columns={columns} data={people} aria-label="People" />);

    await user.click(screen.getByRole('button', { name: /Salary/ }));

    // The header cell carries the state, not the button.
    expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Annie Easley');
});
```

| Reach for | Use |
| :--- | :--- |
| a row | `screen.getAllByRole('row')` — index 0 is the header |
| a cell | `within(row).getAllByRole('cell')` |
| the sort control | `getByRole('button', { name: /Salary/ })` |
| sort state | `aria-sort` on the `columnheader` |
| what was announced | `screen.getByRole('status')` |
| a checkbox | `getAllByRole('checkbox', { name: 'Select row' })` |

**Async without arbitrary timers.** A remote source settles on its own schedule, so wait for the
consequence rather than sleeping:

```tsx
await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + 25));
```

Never assert on class names or DOM structure — those are not the contract. Roles and accessible
names are.

---

## 10. Theming to a design system

The stylesheet is structural only. Every colour, size and radius is a custom property, so a theme is
a block of overrides on any ancestor:

```css
.my-app {
    --gw-font-size: 0.9375rem;
    --gw-row-height: 44px;
    --gw-radius: 6px;

    --gw-surface: var(--brand-surface);
    --gw-surface-muted: var(--brand-surface-2);
    --gw-surface-hover: var(--brand-hover);
    --gw-surface-selected: var(--brand-selected);
    --gw-text: var(--brand-text);
    --gw-text-muted: var(--brand-text-muted);
    --gw-border: var(--brand-border);
    --gw-accent: var(--brand-primary);
    --gw-accent-contrast: var(--brand-on-primary);
    --gw-danger: var(--brand-danger);
    --gw-focus-ring: 0 0 0 2px var(--gw-surface), 0 0 0 4px var(--gw-accent);
}
```

Dark mode is `color-scheme` plus the same variables under your own media query or `[data-theme]`
selector — the package ships no theme toggle and no opinion about how you switch.

For structure the variables cannot reach, `classNames` puts your class on each part:

```tsx
<Gridwright classNames={{ table: 'my-table', row: 'my-row', cell: 'my-cell' }} ... />
```

If you change `--gw-row-height` **and** use `virtualRows()`, pass the same number as `rowHeight`.

---

## 11. Translating it

```tsx
import { pl } from 'apsw-gridwright/locales';

<Gridwright columns={columns} data={people} locale={pl} aria-label="Ludzie" />;
```

One pack translates the shell and every built-in add-on. `de`, `es`, `fr` and `pl` ship; `en` is the
fallback that cannot drift.

Already using an i18n library? Hand it every string:

```tsx
<Gridwright ... translate={(key, values) => t(key, values)} />
```

Returning the key unchanged falls back to the catalog, so you can translate a few strings and leave
the rest.

**Your own columns and add-ons are yours to translate.** A column `header` is a string you wrote;
pass it already translated.

More: [Translation](i18n.md).

---

## Traps

Ordered by how often they actually happen.

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| The grid fetches in a loop | A data source built inline in JSX. A new source object means a new fetch. | `useMemo`, or module scope |
| Header buttons do nothing on a remote grid | `capabilities` claims `sort: true` and the endpoint ignores `sort` | Declare what is true |
| The grid resets to page 1 when a toggle flips | The list of add-on **names** changed, which remounts by design | Expected. Keep names stable if you need the page kept |
| Search does not match visible text | The column uses `cell` where `formatValue` belonged | Values are searched, not rendered output |
| The row range says "of many" | Your source sent no `totalRows` | Send it if the server knows it; the grid will not invent one |
| Rows drift from the scrollbar | `virtualRows({ rowHeight })` disagrees with `--gw-row-height` | Make them the same number |
| A screen reader says only "table" | No `aria-label` and no `caption` | Add one |
| Everything is unstyled | `apsw-gridwright/styles.css` never imported | Import it once |
| Selection survives nothing | Rows have no stable id | `getRowId={(row) => row.uuid}` |
| An edit reverts silently | `commit` threw | That is the contract — surface the error yourself |
| `rowDetail()` throws at mount | It is listed with `virtualRows()` | Use one or the other |

### Things the package will not do, on purpose

- **Invent a total.** No count is computed from one page, anywhere.
- **Grow a runtime dependency.** If a recipe here seems to need one, it is the wrong recipe.
- **Let the core touch the DOM.** `apsw-gridwright` has no `document` and no React in it.
- **Give a built-in add-on a slot yours cannot reach.** If you find one, it is a bug.

---

## Where each answer lives

| Topic | Page |
| :--- | :--- |
| Every prop, option, column field and default | [API reference](api.md) |
| First grid, in six steps | [Getting started](getting-started.md) |
| Sources, capabilities, totals, aborts, retries | [Data sources](data-sources.md) |
| The add-on contract and its slots | [Add-ons](addons.md) |
| Pipeline stages and engine plugins | [Writing a plugin](plugins.md) |
| What is open and what is closed | [Extensibility](extensibility.md) |
| Nested rows and lazy children | [Tree data](tree.md) |
| Expandable panels | [Expandable rows](row-detail.md) |
| Resizing, pinning, hiding, reordering | [Column layout](column-layout.md) |
| Header filters | [Filtering](filtering.md) |
| CSV, Excel, Markdown, print | [Exporting](export.md) |
| Windowing and huge data sets | [Virtualization](virtualization.md) |
| Saving edits and layouts | [Persistence](persistence.md) |
| Keyboard and screen-reader contract | [Accessibility](accessibility.md) |
| Locales and message overrides | [Translation](i18n.md) |
