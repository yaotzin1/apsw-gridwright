# apsw-gridwright

A headless, component-oriented data grid for TypeScript, with a React table component called
**Gridwright**.

Local arrays and remote endpoints travel one code path. A data source declares which parts of the
query it already resolved; the pipeline applies the rest. Moving a grid from an in-memory array to
a paginating API is a one-line change at the call site, and nothing else about your component
changes.

- **Headless core.** No DOM, no React, no runtime dependencies.
- **Unstyled.** Structural CSS driven entirely by custom properties.
- **Extensible.** Sorting, filtering, search and pagination are plugins with no privileged access,
  so yours reaches exactly as far.
- **MIT.**

```bash
npm install apsw-gridwright
```

React 18 or 19 is an optional peer dependency, needed only for `apsw-gridwright/react`.

## Try it

```bash
git clone https://github.com/apsw/apsw-gridwright && cd apsw-gridwright
npm install
npm run example
```

That serves a playground on <http://localhost:5173> running the built package, with a mock API
behind it. Uncheck `sort` under "the server resolves" and watch the work move from the server to
the in-memory pipeline without the component above it changing. See
[examples/playground](examples/playground/README.md).

## Local data

```tsx
import { Gridwright } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

const columns = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end' as const },
];

export function People({ people }: { people: Person[] }) {
    return <Gridwright columns={columns} data={people} pageSize={25} searchable aria-label="People" />;
}
```

Sorting, filtering, search, pagination and the empty state are already there. The grid renders its
first page on the first paint, with no loading flash, because an array resolves synchronously and
the engine notices.

## Remote data

```tsx
import { createRestDataSource } from 'apsw-gridwright';
import { Gridwright } from 'apsw-gridwright/react';

const source = createRestDataSource<Person>({ url: '/api/people' });

export function People() {
    return <Gridwright columns={columns} dataSource={source} pageSize={25} searchable />;
}
```

The columns, the component and every prop but one are unchanged. You now get request cancellation,
out-of-order response rejection, backoff on retryable failures, the server's own error message, and
a total the grid refuses to invent.

Your endpoint receives:

```
GET /api/people?page=1&pageSize=25&sort=salary%3Adesc&search=ada&filters=[...]
```

`page` is one-based. Answer with an array, `{ data, total }`, `{ items, count }`, a nested
`meta.total`, or an `X-Total-Count` header. All of them are read. Pass `buildParams` or
`parseResponse` for anything else.

## The one idea worth knowing

A data source declares what it resolved for itself:

```ts
interface DataSourceCapabilities {
    sort: boolean;
    filter: boolean;
    search: boolean;
    paginate: boolean;
}
```

Every facet left `false` is applied in memory by the pipeline.

| Your source | Declares | The pipeline does |
| :--- | :--- | :--- |
| An array | nothing | filter, search, sort, paginate |
| A full query API | everything | nothing |
| An endpoint that only pages | `paginate` | filter, search, sort, on the page received |

That last row is the common real case, and it is why this is a declaration rather than a boolean.
Nothing above the pipeline branches on any of it.

```ts
import { createRemoteDataSource } from 'apsw-gridwright';

const source = createRemoteDataSource<Person>({
    capabilities: { sort: false, filter: false, search: false, paginate: true },
    fetcher: async ({ query, signal }) => {
        const page = await api.people({ page: query.pagination.pageIndex + 1, signal });
        return { rows: page.items, totalRows: page.total };
    },
});
```

## Without React

The engine has no adapter dependency:

```ts
import { createGridEngine, createLocalDataSource } from 'apsw-gridwright';

const api = createGridEngine({ columns, dataSource: createLocalDataSource(people) });

api.subscribe((state) => render(state.rows));
api.toggleSort('salary');
api.setFilter('department', { operator: 'eq', value: 'Research' });
api.nextPage();
api.destroy();
```

## Composition

`<Gridwright />` is a default arrangement of parts. When it does not fit, place them yourself:

```tsx
import {
    GridwrightProvider, GridTable, GridHeader, GridBody, GridPagination, useGridwright,
} from 'apsw-gridwright/react';

function PeopleGrid() {
    const grid = useGridwright({ columns, data: people, pageSize: 25 });

    return (
        <GridwrightProvider instance={grid}>
            <PageHeader>
                <GridPagination pageSizeOptions={[25, 50]} />
            </PageHeader>
            <GridTable aria-label="People">
                <GridHeader />
                <GridBody onRowClick={(row) => open(row.data)} />
            </GridTable>
        </GridwrightProvider>
    );
}
```

## Cells

```tsx
const columns = [
    { id: 'name', header: 'Name' },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end' as const,
        formatValue: (value: number) => currency.format(value),
        cell: ({ value }) => <strong>{currency.format(value)}</strong>,
    },
    {
        id: 'status',
        header: 'Status',
        accessor: (row) => (row.active ? 'Active' : 'Inactive'),
        cell: ({ value }) => <Badge tone={value === 'Active' ? 'green' : 'grey'}>{value}</Badge>,
    },
];
```

`formatValue` is what search matches against and what the default cell renders, so a reader
searching for what they can see finds it. `cell` controls only the rendering.

## Theming

The stylesheet is structural. Everything visible is a custom property:

```css
.my-page {
    --gw-accent: #7c3aed;
    --gw-row-height: 44px;
    --gw-border: #e5e7eb;
    --gw-radius: 12px;
}
```

Dark mode follows `prefers-color-scheme` and can be forced either way with
`data-gw-theme="dark"` or `"light"` on the grid root. Reduced motion is respected. Add your own
classes through `classNames`, or skip the stylesheet entirely and style the `gw-*` classes
yourself.

## Translation

Every visible string is in one object:

```tsx
<Gridwright
    columns={columns}
    data={people}
    labels={{
        searchPlaceholder: 'Szukaj',
        empty: 'Brak wierszy',
        rowsPerPage: 'Wierszy na stronie',
        pageRange: (from, to, total, exact) =>
            exact ? `${from}-${to} z ${total}` : `${from}-${to} z wielu`,
    }}
/>
```

`pageRange` is a function because word order around numbers differs by language.

## Plugins

The four built-ins are ordinary plugins. Yours has the same reach:

```ts
import { corePlugins, createGridEngine, STAGE_ORDER } from 'apsw-gridwright';
import type { GridPlugin } from 'apsw-gridwright';

const activeOnly = <TRow extends { active: boolean }>(): GridPlugin<TRow> => ({
    name: 'acme:active-only',
    setup: (context) =>
        context.registerStage({
            id: 'acme:active-only',
            order: STAGE_ORDER.FILTER + 1,
            capability: 'filter',          // skipped when the server already filters
            run: (rows) => {
                const kept = rows.filter((row) => row.active);
                return { rows: kept, totalRows: kept.length };
            },
        }),
});

createGridEngine({ columns, dataSource, plugins: [...corePlugins(), activeOnly()] });
```

Add one at runtime with `api.use(plugin)`, which returns an unsubscribe that removes it cleanly. A
stage that throws loses its own effect and nothing else: a broken plugin never empties the grid.

Stage slots, in order: `PRE`, `FILTER`, `SEARCH`, `SORT`, `TRANSFORM`, `PAGINATE`, `POST`.

## Selection

Off by default. A checkbox column nobody asked for is a column the reader has to account for.

```tsx
<Gridwright
    columns={columns}
    data={people}
    selectionMode="multiple"
    onSelectionChange={(ids, rows) => setChosen(rows)}
/>
```

Selected ids survive paging. `getSelectedRows()` returns only the rows currently loaded, because
rows on another page cannot be resolved to objects.

Give rows a stable identity when they have no `id` property:

```tsx
<Gridwright columns={columns} data={people} getRowId={(row) => row.employeeNumber} />
```

## Totals the grid will not invent

When a paginating source answers without a total, `state.isTotalExact` is `false`, `totalRows` and
`pageCount` become lower bounds, and the range reads "1-25 of many". The grid knows another page
exists and says exactly that, rather than computing a number from one page that the reader would
then act on.

## Errors

```tsx
<Gridwright
    columns={columns}
    dataSource={source}
    renderError={(error, retry) => (
        <Callout tone="critical">
            {error.message}
            {error.retryable && <Button onClick={retry}>Try again</Button>}
        </Callout>
    )}
/>
```

`error.message` carries the server's own sentence when it sent one. `error.retryable` is false for
a 404 or a 422, so you are not offering a retry that cannot help.

## API

### Core

| Export | What it does |
| :--- | :--- |
| `createGridEngine(options)` | the engine: state, fetching, plugins, selection |
| `createLocalDataSource(rows)` | an array as a source, with `setRows` to replace it |
| `createRemoteDataSource({ fetcher })` | any async function, with abort handling and backoff |
| `createRestDataSource({ url })` | a REST endpoint, with parameters and envelopes handled |
| `corePlugins()` | the four built-in stages |
| `STAGE_ORDER` | the stage slots |
| `GridwrightError` | throw this from a source to control the message and retry advice |

### Engine

`getState`, `subscribe`, `on`, `getColumns`, `setColumns`, `setDataSource`, `setQuery`, `setSort`,
`toggleSort`, `getSort`, `setFilters`, `setFilter`, `getFilter`, `setSearch`, `setPage`,
`nextPage`, `previousPage`, `setPageSize`, `setSelectionMode`, `toggleRowSelection`,
`setSelectedIds`, `selectPage`, `clearSelection`, `isSelected`, `getSelectedRows`, `use`,
`refresh`, `destroy`.

### Events

`state:change`, `query:change`, `fetch:start`, `fetch:success`, `fetch:error`, `fetch:settled`,
`selection:change`, `plugin:error`.

### React

`Gridwright`, `useGridwright`, `GridwrightProvider`, `useGridwrightContext`, `GridToolbar`,
`GridTable`, `GridHeader`, `GridBody`, `GridPagination`, `defaultLabels`, `mergeLabels`.

## Accessibility

The grid is a real `<table>` with `role="grid"`. Sort controls are buttons, reachable by Tab and
activated by Enter or Space. Sort state is announced through `aria-sort` on the header cell.
Loading, empty and error states render inside the table so the header and column widths hold still.
A live region announces loading, and errors use `role="alert"`.

## Not in this release

Row virtualization, inline editing, column resize and reorder, grouping and aggregation. The
`TRANSFORM` stage slot is reserved for the last of these. Adapters for frameworks other than React
are possible against the same core, and none ship yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The repository runs a spec-driven workflow with agent
skills under `.agents/`; `npm run verify` is the gate everything passes through.

## License

MIT
