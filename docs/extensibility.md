# Extensibility: the map and its edges

This page answers two questions. Where does your code attach, and where does it deliberately not.

The second half matters more. A library that promises to be extensible everywhere ends up with no
invariants, and a grid with no invariants cannot be reasoned about. What follows is the full set of
seams, and an honest account of what is closed and why.

## The layers

```
  your application
        │
        ├── columns ─────────── accessor, comparator, filterFn, formatValue, renderers, meta
        │
        ├── React parts ─────── compose, replace, or write your own against the context
        │        │
        │   ┌────▼──────────────────────────────────────────────┐
        │   │ adapter (src/react)   rendering only              │
        │   └────┬──────────────────────────────────────────────┘
        │        │  reads GridState, calls GridApi
        │   ┌────▼──────────────────────────────────────────────┐
        ├──▶│ engine (src/core)     state, sequencing, events   │
        │   └────┬──────────────────────────────────────────────┘
        │        │  runs registered stages in order
        │   ┌────▼──────────────────────────────────────────────┐
        ├──▶│ pipeline stages       plugins: row transformations│
        │   └────┬──────────────────────────────────────────────┘
        │        │  asks for rows, and for what was already done
        │   ┌────▼──────────────────────────────────────────────┐
        └──▶│ data source           where rows come from        │
            └───────────────────────────────────────────────────┘
```

Every arrow from the left is a place your code plugs in. There are ten of them.

## The ten extension points

| # | Point | You supply | Reach |
| :-- | :--- | :--- | :--- |
| 1 | **Column value** | `accessor` | How a value is read from a row |
| 2 | **Column order** | `comparator` | How two values sort |
| 3 | **Column predicate** | `filterFn` | Whether a row matches a filter |
| 4 | **Column text** | `formatValue` | What search matches and the default cell shows |
| 5 | **Column rendering** | `cell`, `headerCell`, `icon` | Any React node |
| 6 | **Data source** | `DataSource` | Where rows come from, and what the server already did |
| 7 | **Pipeline stage** | `GridPlugin` | Any transformation of the row set |
| 8 | **Events** | `api.on(...)` | Observation: telemetry, persistence, syncing a URL |
| 9 | **Presentation** | `classNames`, CSS variables, `locale`, `messages`, `labels` | Every visible pixel and string |
| 10 | **Adapter components** | `BubbleMenu`, `InlineEditProvider`, `GridVirtualBody`, your own part | Anything that needs the DOM: floating menus, editors, measurement, scrolling |

Points 1 to 5 are per column, 6 and 7 are per grid, 8 is observation, 9 is presentation and 10 is
anything that needs the DOM. Between them they cover the questions people actually arrive with. If yours is not on the list, the
sections below say where it goes instead.

### 1 to 5: columns

```ts
const columns = [
    {
        id: 'owner',
        header: 'Owner',
        accessor: (row) => row.owner?.displayName ?? '',      // 1
        comparator: (a, b) => collator.compare(a, b),          // 2
        filterFn: (value, filter) => matches(value, filter),   // 3
        formatValue: (value) => value.toUpperCase(),           // 4
        cell: ({ value, row }) => <Owner name={value} id={row.ownerId} />,  // 5
        meta: { exportWidth: 40 },
    },
];
```

`formatValue` and `cell` are different jobs. `formatValue` produces the text that global search
matches and that the default cell renders; `cell` produces the React node. Give a column both and
a reader searching for what they can see finds it, which is the behaviour they expect and rarely
get.

`meta` is an open bag. The engine never reads it. It is there so a plugin or a renderer of yours
can carry per-column configuration without a parallel map keyed on column id.

### 6: data sources

A data source answers two questions: what are the rows, and what did you already do to them.

```ts
const source: DataSource<Row> = {
    kind: 'graphql',
    capabilities: { sort: true, filter: true, search: false, paginate: true },
    async fetch({ query, signal }) {
        const page = await client.query({ variables: toVariables(query), signal });
        return { rows: page.items, totalRows: page.total };
    },
    subscribe(onInvalidate) { return bus.on('rows-changed', onInvalidate); },
};
```

Everything left `false` in `capabilities` is done in memory by the pipeline. That one declaration
is what lets an array and a paginating endpoint travel the same code path. Full detail, including
totals, aborts and retries, is in [data-sources.md](data-sources.md).

### 7: pipeline stages

A stage transforms the row set between the source and the screen. This is the largest seam, and it
has its own page with worked examples: [plugins.md](plugins.md).

### 8: events

```ts
api.on('query:change', ({ query }) => history.replace(toSearchParams(query)));
api.on('fetch:error', ({ error }) => reportToSentry(error));
api.on('selection:change', ({ selectedIds }) => setToolbarActions(selectedIds));
```

Eight events: `state:change`, `query:change`, `fetch:start`, `fetch:success`, `fetch:error`,
`fetch:settled`, `selection:change`, `plugin:error`. Each returns an unsubscribe.

Events are for observing, not for changing. A listener cannot cancel a fetch or alter a result. If
you need to change something, you need a data source or a stage.

### 10: adapter components

Some extensions need the DOM: a menu that positions against a row, an editor that focuses an input,
anything that measures. Those cannot be pipeline plugins, because the core is DOM-free by contract.
They are React components that read the grid context instead.

```tsx
function RowCount() {
    const { state } = useGridwrightContext();
    return <p>{state.totalRows} rows</p>;
}
```

`BubbleMenu` and `InlineEditProvider` are exactly this and get no privileged access. The word
"plugin" in this package means a pipeline stage; an adapter extension is a component.

### 9: presentation

Four independent dials, none of which require forking a component:

```tsx
<Gridwright
    classNames={{ row: 'my-row', headerCell: 'my-header' }}
    locale={pl}
    messages={{ 'status.empty': 'Nothing here yet' }}
/>
```

```css
.my-page { --gw-accent: #7c3aed; --gw-row-height: 44px; }
```

Class names, CSS custom properties, and the message catalog. See [i18n.md](i18n.md) for the copy
and [the README](../README.md#theming) for the tokens.

## What is closed, and why

Each of these is a deliberate decision, not an oversight. Where there is a way to get the outcome
you want, it is named.

### The core never touches the DOM

`document`, `window` and `react` are banned imports under `src/core`, `src/data` and
`src/plugins`, enforced by lint.

**Why.** The engine has to import in Node, in a worker and in a test with no DOM. The moment it
can read the DOM, someone measures a row height in it, and the engine stops being testable without
a browser.

**Instead.** Measure in an adapter and pass the number in, through `meta` or a plugin's own state.

### `GridState` has a fixed shape

You cannot add a top-level field to the published state.

**Why.** Every adapter and every consumer reads this object. An open shape means no adapter can
render it without knowing which plugins are installed.

**Instead.** `context.setMeta(key, value)` inside a plugin. Values land on `state.meta` namespaced
as `<plugin-name>:<key>`, so two plugins cannot collide.

### `GridQuery` has a fixed shape

Sort, filters, search, pagination. You cannot add a fifth facet.

**Why.** The query is a wire contract. It is handed to a data source verbatim, and every server
that speaks it would have to be updated for a facet that only one grid sends.

**Instead.** Most "extra facets" are filters. `FilterSpec` carries an arbitrary `value`, so a date
range is `{ columnId: 'created', operator: 'between', value: [from, to] }`. For something genuinely
outside the query, keep it in your own state and pass it through a plugin closure.

### The filter operator vocabulary is closed

Fifteen operators, and adding one is a breaking change.

**Why.** A remote source receives them verbatim. Every server already implementing the vocabulary
would silently not understand a sixteenth.

**Instead.** A column's `filterFn` takes the whole `FilterSpec`, so you can give an existing
operator any meaning you like for one column, or carry a discriminator inside `value`.

### A stage cannot see rows it was not given

A stage registered after `PAGINATE` receives one page.

**Why.** That is what pagination means. A stage that wants the whole set has to run before the
page is cut, and if the data source paginates, the whole set is on the server and nobody on the
client has it.

**Instead.** Register before `STAGE_ORDER.PAGINATE`, or move the work to the server and declare it
in `capabilities`.

### Events cannot intercept

No listener can cancel, delay or rewrite a fetch.

**Why.** An interceptor chain makes the order of registration load-bearing and invisible, and it
puts arbitrary code inside the sequencing logic that keeps stale responses from being applied.

**Instead.** Wrap the data source. It is a plain object, and a decorator around `fetch` gets the
request, the signal and the result:

```ts
const audited: DataSource<Row> = {
    ...source,
    async fetch(request) {
        const started = performance.now();
        const result = await source.fetch(request);
        track('grid.fetch', { ms: performance.now() - started, rows: result.rows.length });
        return result;
    },
};
```

### The engine will not dispose your data source

`api.destroy()` unsubscribes but never calls `dispose()` on a source it was handed.

**Why.** The engine did not create it, sources are routinely shared between grids, and React Strict
Mode destroys an engine once on purpose. Disposing there would break the remount.

**Instead.** Own the lifetime where you created it.

### A stage that throws loses only its own effect

The rows continue to the next stage and the failure surfaces on `plugin:error`.

**Why.** An empty grid caused by a broken plugin is indistinguishable from a data source returning
nothing, and the reader goes looking in the wrong place.

**Instead.** If a failure genuinely must stop the grid, detect it in the data source and throw a
`GridwrightError`, which is the path that produces a message a person can act on.

### The tree replaces filtering, searching and sorting rather than joining them

Install `treePlugins()` and the three flat stages are not installed.

**Why.** All three mean something different on a tree. Filtering a flat list removes rows;
filtering a tree has to keep the ancestors of a match or the match has no context. Sorting a flat
list orders everything; sorting a tree orders siblings within each parent. Running the flat stages
over an already-flattened tree would mangle the nesting they were drawn from.

**Instead.** Register your own stage before `STAGE_ORDER.TRANSFORM` to narrow the node set, or
after it to decorate the flattened result.

### The package will not grow a runtime dependency

`dependencies` is empty and the packaging audit fails the build if that changes.

**Why.** Every runtime dependency is a version this package can force onto your tree. A grid is not
worth a resolution conflict.

**Instead.** Anything needing a library belongs in your plugin, in your package, where you choose
the version.

## Choosing a seam

| You want to | Use |
| :--- | :--- |
| Show a value differently | `formatValue`, or `cell` for markup |
| Sort a column your own way | `comparator` |
| Filter a column your own way | `filterFn` |
| Load from somewhere unusual | a data source |
| Move work to the server | `capabilities` on the data source |
| Hide, group, aggregate or inject rows | a plugin stage |
| Add a computed column | a column with a function `accessor` |
| React to what the grid does | `api.on(...)` |
| Persist or restore the query | `query:change` plus `initialQuery` |
| Measure something in the DOM | an adapter component, passed in as data |
| Change wording | `messages`, or `labels` for one string |
| Change appearance | CSS custom properties, then `classNames` |
| Rearrange the furniture | compose the parts under `GridwrightProvider` |
| Time or log every request | wrap the data source |
| Show hierarchy | `tree` on the component, or `treePlugins()` over a tree data source |
| Add row actions on hover | `rowActions`, or `BubbleMenu` in a layout of your own |
| Edit a cell in place | `edit` on the column plus `onCellEdit`, or `InlineEditProvider` by hand |
| Render only what is on screen | `virtual`, or `GridVirtualBody` and `useVirtualRows` |
| Hold fewer rows than the result set has | `createWindowedDataSource` |
| Put a glyph beside a value | `icon` on the column |
| Add, move or delete rows | the tree controller's `insertRow`, `moveNode`, `removeNode` |

If your case is not here, it is worth opening an issue before writing a workaround. A seam that
several people reach for and miss is a seam that should exist.
