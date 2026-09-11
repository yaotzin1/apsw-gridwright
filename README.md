# apsw-gridwright

A React data grid for TypeScript, built on a headless engine. The component is called
**Gridwright**.

Local arrays and remote endpoints travel one code path. A data source declares which parts of the
query it already resolved; the pipeline applies the rest. Moving a grid from an in-memory array to
a paginating API is a one-line change at the call site, and nothing else about your component
changes.

- **React is the supported surface.** `apsw-gridwright/react` is what you build with. The engine
  underneath it is headless and separately importable, with no DOM and no runtime dependencies,
  which is why the component is small and why the pipeline is testable without a renderer. It is
  the engine of this package, not a second way to build a grid.
- **Accessible by default.** A real `<table>` with `role="grid"`, sort state on the header cell,
  row positions that count across pages rather than within one, and a live region that says what
  changed. A tree is a `treegrid`, with the depth and the expanded state on the row.
- **Unstyled.** Structural CSS driven entirely by custom properties.
- **One component.** A tree, windowing, row actions, inline editing and icons are options on
  `<Gridwright />`, not separate components, so they compose instead of competing.
- **Extensible.** Sorting, filtering, search and pagination are plugins with no privileged access,
  so yours reaches exactly as far.
- **MIT.**

```bash
npm install apsw-gridwright
```

React 18 or 19 is an optional peer dependency, needed only for `apsw-gridwright/react`.

## Try it

```bash
git clone https://github.com/yaotzin1/apsw-gridwright && cd apsw-gridwright
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

## The engine underneath

`apsw-gridwright/react` is the supported surface, and the engine it is built on is exported
separately because it has no adapter dependency. Import it to drive the pipeline in a Node script,
a worker or a test, or to write a plugin or a data source against the same contracts the built-in
ones use. It is the engine of this package rather than a second way to build a grid: the markup,
the labels, the accessibility and the packaging audit all live in the adapter.

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

## Icons

A column's `icon` is a renderer like `cell` is, so it is decided per row rather than per column:

```tsx
{
    id: 'name',
    header: 'Name',
    icon: ({ row }) => (row.kind === 'folder' ? <FolderIcon /> : <FileIcon />),
}
```

The grid puts it before the cell's text and marks it `aria-hidden`, since the text already says
what it says. On a tree column it lands between the toggle and the label rather than before the
indentation. Size it with `--gw-icon` and the surrounding font size; nothing is bundled.

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

```tsx
import { pl } from 'apsw-gridwright/locales';

<Gridwright columns={columns} data={people} locale={pl} />
```

That switches the text, the plural rules, the number formatting and the text direction together.
Bundled packs: `en`, `de`, `es`, `fr`, `pl`, behind their own entry point so a bundler drops the
ones you do not import.

Messages are a flat catalog with ICU-style `{placeholders}` and CLDR plural categories, which is
what i18next, FormatJS, Lingui, Weblate and Crowdin already consume. Plurals come from
`Intl.PluralRules`, so Polish gets its four forms and Arabic its six without this package shipping
a plural table:

```ts
'selection.count': {
    zero: 'Nie zaznaczono wierszy',
    one: 'zaznaczono {count} wiersz',
    few: 'zaznaczono {count} wiersze',      // 2-4, 22-24, ...
    many: 'zaznaczono {count} wierszy',     // 5-21, 25-31, ...
    other: 'zaznaczono {count} wiersza',
}
```

Already using an i18n library? Hand it the function it already gives you:

```tsx
const { t } = useTranslation('grid');
<Gridwright columns={columns} data={people} translate={t} />
```

Or override one string without a catalog:

```tsx
<Gridwright locale={pl} messages={{ 'status.empty': 'Nie znaleziono pracowników' }} />
```

A key a catalog omits falls back to English, never to the key itself, and `auditCatalog` fails a
test when a catalog drifts from the key set. Full detail in [docs/i18n.md](docs/i18n.md).

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

[docs/plugins.md](docs/plugins.md) has the rules and worked recipes for grouping, aggregation,
query persistence and telemetry. [docs/extensibility.md](docs/extensibility.md) maps every seam and,
more usefully, says what is deliberately closed and what to do instead.

## One component, switchable

Everything below is a prop on the same `<Gridwright />`. None of them is a different component, and
they compose: a virtualized tree with a row menu and two editable columns is four props.

| Prop | Turns on |
| :--- | :--- |
| `tree={{ getRowId, getChildren }}` | nested rows, expansion, lazy children, optimistic mutation |
| `virtual` | rendering only the rows on screen, with the pagination footer replaced |
| `rowActions={[...]}` | a floating menu on the row, opened by hover, click or right-click |
| `onCellEdit={fn}` | editing in place, on the columns that declare `edit` |
| `icon` on a column | a per-row glyph beside the cell's text |

```tsx
<Gridwright
    columns={columns}
    data={folders}
    tree={{ getRowId: (row) => row.id, getChildren: (row) => row.children }}
    virtual
    rowActions={[{ id: 'open', label: 'Open', onSelect: open }]}
    onCellEdit={(rowId, columnId, value) => save(rowId, columnId, value)}
/>
```

Switching `tree` on or off remounts the grid, because a tree and a flat list are different grids.
Everything else changes in place.

## Tree data

Rows with children, to any depth, and a row can sit under more than one parent:

```tsx
<Gridwright
    columns={columns}
    data={folders}
    tree={{
        getRowId: (row) => row.id,
        getChildren: (row) => row.children,
        defaultExpandedDepth: 1,
    }}
/>
```

The structure is a nested set, so ancestry is two comparisons, subtree size is arithmetic, and the
interval order is already the render order. Filtering keeps the ancestors of a match, sorting
orders siblings within each parent, and the total counts visible nodes.

Children can arrive lazily, keyed on the row so a second placement reuses the first fetch:

```tsx
tree={{
    hasChildren: (row) => row.type === 'folder',
    loadChildren: async ({ row, signal }) => api.children(row.id, { signal }),
}}
```

Editing, adding and moving are optimistic with rollback. A refused change restores the tree exactly
and reports on the row:

```tsx
tree={{ onCommit: async (change) => api.save(change) }}
```

Every change is a shape a database can take: `update` carries the row, `insert` carries the parent
and the index, `move` carries both parents, `remove` carries the scope. Store the adjacency list and
each one is a single statement; the nested set the grid works with is derived and should not be
stored. See [docs/persistence.md](docs/persistence.md).

Insertion, movement and removal live on the tree controller, which the grid hands back:

```tsx
tree={{ controllerRef: setController }}
```

```ts
await controller.insertRow(row, { referenceNodeId: 'docs', position: 'child' });
await controller.moveNode('docs/cv', { referenceNodeId: 'photos', position: 'child' });
```

`TreeGridwright` is still exported and is exactly `<Gridwright tree={...} />`, kept because a tree
is a common enough starting point to deserve a name.

Full detail in [docs/tree.md](docs/tree.md).

## Ten million rows

`virtual` renders only the rows on screen. The rest are two spacer rows, so the element stays a
real `<table>` and keeps its column alignment and its grid semantics:

```tsx
<Gridwright columns={columns} data={rows} virtual={{ rowHeight: 40, height: 480 }} />
```

That alone handles a large array. It does not handle ten million rows, because holding ten million
objects is the problem rather than rendering them. For that, the source holds a window instead of a
table:

```tsx
import { createWindowedDataSource } from 'apsw-gridwright';

const source = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 12,
    fetchRange: ({ offset, limit, signal }) => api.people({ offset, limit, signal }),
});

<Gridwright columns={columns} dataSource={source} virtual />;
```

The browser then holds `blockSize * maxBlocks` rows, whatever the total is. Rows whose block has
not arrived render as skeletons, and `renderSkeleton` replaces them.

Above roughly 400,000 rows the scrolling area would be taller than a browser will render, so past
that the scroll position becomes a ratio over the whole result set rather than a pixel offset. The
visible consequence is that one pixel of scrollbar covers several rows. `aria-rowcount` and
`aria-rowindex` carry the true numbers throughout.

Full detail in [docs/virtualization.md](docs/virtualization.md).

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
| `createWindowedDataSource({ fetchRange })` | holds a window of blocks rather than the whole table |
| `corePlugins()` | the four built-in stages |
| `createTranslator({ catalog })` | the message catalog, outside React |
| `createTreeController(options)` | expansion, lazy children, optimistic mutations |
| `createTreeDataSource(source, controller)` | turns any source into one that answers with nodes |
| `treePlugins({ controller })` | the tree stage plus pagination |
| `buildTreeIndex(rows, shape)` | the nested set on its own, with no grid attached |
| `auditCatalog(messages)` | the keys a catalog is missing, for a test |
| `STAGE_ORDER` | the stage slots |
| `WINDOW_OFFSET_META` | the meta key carrying where the held rows start |
| `computeVirtualWindow(input)` | which rows a scroll position is asking for, with no framework |
| `scrollOffsetForIndex(input)` | the offset that brings a row into view, its inverse |
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

`Gridwright`, `useGridwright`, `GridwrightProvider`, `useGridwrightContext`, `useTranslator`,
`GridToolbar`, `GridTable`, `GridHeader`, `GridBody`, `GridCell`, `GridPagination`,
`defaultLabels`, `labelsFrom`, `mergeLabels`.

Windowing: `GridVirtualBody`, `useVirtualRows`.

Tree: `TreeGridwright`, `useTreeGridwright`, `TreeProvider`, `useTreeContext`, `useNodeState`,
`TreeCell`, `reactTreeColumns`, `rowDataOf`.

Adapter plugins: `BubbleMenu`, `InlineEditProvider`, `editableColumns`, `useInlineEdit`.

### Locales

`apsw-gridwright/locales` exports `en`, `de`, `es`, `fr`, `pl`.

## Accessibility

The grid is a real `<table>` with `role="grid"`, or `role="treegrid"` when it has a tree, so the
row and column relationships a screen reader announces come from the markup rather than from ARIA
attributes kept in sync by hand.

| The reader needs to know | How the grid says it |
| :--- | :--- |
| where this row is | `aria-rowindex`, counted across the whole result set, not within the page |
| how many rows there are | `aria-rowcount`, header row included, and `-1` when the total is not exact |
| how to sort, and what the sort is | a real `<button>` in the `<th>`, `aria-sort` on the cell, and the new state announced |
| that several rows may be selected | `aria-multiselectable` |
| how deep this row is | `aria-level`, `aria-posinset`, `aria-setsize`, and `aria-expanded` on the row |
| that something is loading | `aria-busy`, and the loading label in the live region |
| that something failed | `role="alert"`, in the table when no rows are left and in a banner above it when they are |

**One live region, one sentence.** A visually hidden `role="status"` region carries a single
sentence describing the settled state, in a fixed priority order: loading, then error, then the
sort that just changed, then the row range and total. It never announces the rows themselves. A
change that leaves the sentence identical announces nothing, so selecting a row stays quiet.

The announcement exists because `aria-sort` lives on a header cell the reader has already left by
the time the sort applies, and because paging replaces every row with no navigation event of any
kind. Both are silent without it.

**Focus is kept.** Loading, empty and error states render inside the table, so the header and the
column widths hold still. Activating a page control that disables itself moves focus to its
sibling rather than dropping it to `<body>`, which is what ejects a keyboard user from the grid at
the moment they reach the last page.

**Every announced string is in the catalogue**, so it is translated with everything else. See
[Accessibility](docs/accessibility.md) for the whole contract, and what is deliberately absent.

## Not in this release

Variable row heights under virtualization, column resize and reorder, grouping and aggregation,
drag-and-drop reparenting, cascading selection down a subtree, and arrow-key cell navigation.

Adapters for frameworks other than React are not planned. The core stays headless because that is
what makes the pipeline testable without a renderer and keeps the plugin and data-source contracts
honest, not because a second adapter is coming.

## Documentation

| Page | Covers |
| :--- | :--- |
| [Tree data](docs/tree.md) | Nested rows, several parents, lazy children, inline editing, the bubble menu |
| [Virtualization and windowing](docs/virtualization.md) | Rendering a window, holding a window, and ten million rows |
| [Storing what the reader changes](docs/persistence.md) | Inline edits and tree mutations, and the table behind them |
| [Data sources](docs/data-sources.md) | Capabilities, totals, aborts, retries, writing your own |
| [Extensibility](docs/extensibility.md) | Every seam, and what is closed on purpose |
| [Writing a plugin](docs/plugins.md) | The rules, plus grouping, aggregation, persistence, telemetry |
| [Accessibility](docs/accessibility.md) | What the grid tells assistive technology, and what is deliberately absent |
| [Translation](docs/i18n.md) | Catalogs, plurals, direction, wiring an existing i18n library |
| [Spec-driven development](docs/spec-driven-development.md) | How this repository is built |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Changes here move through a written eight-stage process, with the rules in `workflow.ai.yml` and
fifteen skill documents under `.agents/`. `AGENTS.md`, `GEMINI.md` and `.claude/skills/` are
generated from that one file, and CI fails when they drift. Two of the stage-3 artifacts, the
public API surface and the lifecycle contract, are frozen during implementation so the engine and
the adapter can be written in parallel without disagreeing.

`npm run verify` is the gate everything passes through: typecheck, lint, both test suites, the
build, a smoke suite against `dist/`, and a packaging audit. See
[docs/spec-driven-development.md](docs/spec-driven-development.md) for why.

## Support the project

If this saved you the week it takes to build a grid that handles remote data properly, you can
[buy me a coffee](https://ko-fi.com/yaotzin1).

The package stays MIT and zero-dependency either way. Bug reports and locale contributions are
worth more than coffee.

## License

MIT © [yaotzin1](https://github.com/yaotzin1)
