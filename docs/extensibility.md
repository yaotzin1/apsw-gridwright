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
        ├── add-ons ─────────── every React feature, the built-in ones included
        │        │
        │   ┌────▼──────────────────────────────────────────────┐
        │   │ adapter (src/react)   a shell that renders slots  │
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
| 10 | **Add-ons** | `GridAddon` | Anything the React grid does: toolbar items, header controls, extra columns, row and cell attributes, a body of your own, providers, overlays, announcements |

Points 1 to 5 are per column, 6 and 7 are per grid on the engine side, 8 is observation, 9 is
presentation and 10 is per grid on the React side. Between them they cover the questions people
actually arrive with. If yours is not on the list, the sections below say where it goes instead.

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
can carry per-column configuration without a parallel map keyed on column id. An add-on that wants a
typed column option instead adds it to `GridwrightColumn` by module augmentation; see
[addons.md](addons.md#column-options-of-your-own).

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

A stage transforms the row set between the source and the screen. This is the largest seam on the
engine side, and it has its own page with worked examples: [plugins.md](plugins.md).

The parts that decide how plugins combine:

- **`plugins` adds to the core set.** Filtering, search, sorting and pagination stay installed, so two
  independent extensions can each bring plugins without one silently removing the other's.
- **A plugin named like a core plugin replaces it.** `name: 'gridwright:sorting'` takes the built-in
  sort's place, which keeps swapping one built-in a one-line change. `corePlugins: false` starts from
  nothing. Two plugins with the same name throw.
- **`api.removePlugin(name)`** removes an installed plugin by name, running its teardown, whether it
  arrived through the options or through `api.use`.
- **`context.suppressStage(stageId)`** switches off a stage somebody else registered, for as long as
  your plugin is installed. It is counted, so two plugins suppressing one stage keep it off until
  both release it, and it is released automatically on teardown. This is how the tree turns off the
  flat filter, search and sort without asking you to list your plugins without them.
- **`stage.skip(context)`** skips your own stage for one pass, for relevance that is not one of the
  four capabilities. It is evaluated after `capability`, and a `skip` that throws is reported on
  `plugin:error` and skips the stage.

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

### 9: presentation

Four independent dials, none of which require forking a component:

```tsx
<Gridwright
    classNames={{ row: 'my-row', headerCell: 'my-header' }}
    locale={pl}
    messages={{ 'status.empty': 'Nothing here yet', 'gridwright:filters.apply': 'Go' }}
/>
```

```css
.my-page { --gw-accent: #7c3aed; --gw-row-height: 44px; }
```

Class names, CSS custom properties, and the message catalog, which reaches every add-on's strings
under the add-on's name. See [i18n.md](i18n.md) for the copy and
[the README](../README.md#theming) for the tokens.

### 10: add-ons

Some extensions need the DOM or React: a menu that positions against a row, an editor that focuses
an input, a checkbox column, anything that measures. Those cannot be pipeline plugins, because the
core is DOM-free by contract. They are add-ons.

`<Gridwright />` is a shell. Sorting, selection, pagination and the stale-rows notice are the core
add-ons it starts with; search, column filters, exporting, row actions, inline editing, the tree and
windowing are add-ons you list. An add-on of your own is written against the same contract, through
the same exports:

```tsx
function payBand(threshold: number): GridAddon<Employee> {
    return {
        name: 'acme:pay-band',
        setup: () => ({
            messages: { en: { legend: 'Highlighted: salaries above {threshold}' } },
            cellAttributes: (row, column) =>
                column.id === 'salary' && row.data.salary > threshold ? { className: 'pay-band--high' } : {},
            belowTable: () => <Legend threshold={threshold} />,
        }),
    };
}

<Gridwright columns={columns} data={rows} addons={[search(), columnFilters(), payBand(100_000)]} />;
```

A contribution can configure the engine (`configure`, `plugins`), wrap the grid in providers, place
items in the toolbar and around the table, own the header label or the whole body, add columns, add
attributes to the table, rows, header cells and cells, render a row of its own kind, replace the
status rows, contribute a sentence to the live region, and carry its own translated strings. It can
suppress another add-on's rendering and order itself `before` or `after` another.

None of the built-in add-ons gets anything yours does not. `tests/react/third-party-addon.test.tsx`
builds one from the public exports that touches every slot, and it is part of the suite. The word
"plugin" in this package means a pipeline stage; a React extension is an add-on. The full contract
is in [addons.md](addons.md).

Where an add-on is more than you need, a component that reads the grid context still works, inside a
layout composed by hand:

```tsx
function RowCount() {
    const { state } = useGridwrightContext();
    return <p>{state.totalRows} rows</p>;
}
```

## What is closed, and why

Each of these is a deliberate decision, not an oversight. Where there is a way to get the outcome
you want, it is named.

### The core never touches the DOM

`document`, `window` and `react` are banned imports under `src/core`, `src/data` and
`src/plugins`, enforced by lint.

**Why.** The engine has to import in Node, in a worker and in a test with no DOM. The moment it
can read the DOM, someone measures a row height in it, and the engine stops being testable without
a browser.

**Instead.** Measure in an add-on (a `tableWrapper` ref, a component a slot renders) and pass the
number in, through `meta` or a plugin's own state.

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
request, the signal and the result. An add-on can do the same from `configure`:

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

### A stage or an add-on that throws loses only its own effect

A stage that throws passes its rows on to the next stage and the failure surfaces on
`plugin:error`. An add-on slot function that throws renders nothing and is reported to the console
with the add-on's name; an announcement contributor that throws loses its sentence.

**Why.** An empty grid caused by a broken extension is indistinguishable from a data source
returning nothing, and the reader goes looking in the wrong place.

**Instead.** If a failure genuinely must stop the grid, detect it in the data source and throw a
`GridwrightError`, which is the path that produces a message a person can act on. What a slot
renders is ordinary React and fails the ordinary way, so put an error boundary around a component
that might throw.

### Add-on attributes are an allowlist

An add-on may contribute event handlers as functions, `aria-*` and `data-*` as scalars, `className`,
`style`, and `role`, `id`, `title`, `tabIndex`, `hidden`, `dir`, `lang`, `draggable`, `scope`,
`colSpan`, `rowSpan`, `abbr` and `headers`. Nothing else reaches the element, whatever the types said.

**Why.** Third-party code runs inside the grid by design. An open attribute bag would hand it markup,
URL attributes and handlers written as strings: sinks this package refuses to have itself.
`mergeAttributes` enforces the list at runtime, so the guarantee holds for plain JavaScript too.

**Instead.** Anything that is content rather than an attribute is a React node, rendered from a slot
(`headerAfter`, `columns`, `renderRow`, `overlay`), where React escapes it.

### The tree suppresses filtering, searching and sorting rather than joining them

Install the tree and the three flat stages are suppressed while it is installed. They stay
registered, and every other plugin keeps running beside the tree.

**Why.** All three mean something different on a tree. Filtering a flat list removes rows;
filtering a tree has to keep the ancestors of a match or the match has no context. Sorting a flat
list orders everything; sorting a tree orders siblings within each parent. Running the flat stages
over an already-flattened tree would mangle the nesting they were drawn from.

**Instead.** Register your own stage before `STAGE_ORDER.TRANSFORM` to narrow the node set, or
after it to decorate the flattened result. A plugin of yours that does a built-in's job differently
can suppress it the same way, with `context.suppressStage`.

### The package will not grow a runtime dependency

`dependencies` is empty and the packaging audit fails the build if that changes.

**Why.** Every runtime dependency is a version this package can force onto your tree. A grid is not
worth a resolution conflict.

**Instead.** Anything needing a library belongs in your plugin or add-on, in your package, where you
choose the version.

## Choosing a seam

| You want to | Use |
| :--- | :--- |
| Show a value differently | `formatValue`, or `cell` for markup |
| Sort a column your own way | `comparator` |
| Filter a column your own way | `filterFn` |
| Load from somewhere unusual | a data source |
| Move work to the server | `capabilities` on the data source |
| Hide, group, aggregate or inject rows | a plugin stage |
| Replace a built-in stage | a plugin with the core plugin's name, or `suppressStage` from your own |
| Add a computed column | a column with a function `accessor` |
| React to what the grid does | `api.on(...)` |
| Persist or restore the query | `query:change` plus `initialQuery` |
| Add a feature to the React grid | an add-on in `addons` |
| Measure something in the DOM | an add-on, passing the number in as data |
| Change wording | `messages` (add-on strings under `<add-on>.<key>`), or `labels` for a shell string |
| Change appearance | CSS custom properties, then `classNames` |
| Rearrange the furniture | compose the parts under `GridwrightProvider` and `GridRoot` |
| Remove sort buttons, checkboxes or page controls | `coreAddons(options)` to configure one (`{ selection: { checkboxes: false } }`), `coreAddons` as a list to drop one, `coreAddons={false}` for none |
| Time or log every request | wrap the data source |
| Show hierarchy | `treeData()`, or `createTreeDataSource` plus `treePlugins()` with no framework at all |
| Add row actions on hover | `rowActions({ items })`, or `BubbleMenu` in a layout of your own |
| Edit a cell in place | `edit` on the column plus `inlineEditing({ commit })`, or `InlineEditProvider` by hand |
| Render only what is on screen | `virtualRows()`, or `GridVirtualBody` and `useVirtualRows` |
| Let the reader resize, reorder, pin or hide columns | `columnLayout()`, or `useColumnLayout()` behind controls of your own |
| Refuse a layout change your rules do not allow | `columnLayout({ canChange })`, and `allows` to disable the control that would be refused |
| Hold fewer rows than the result set has | `createWindowedDataSource` |
| Put a glyph beside a value | `icon` on the column |
| Add, move or delete rows | the tree controller's `insertRow`, `moveNode`, `removeNode` |

If your case is not here, it is worth opening an issue before writing a workaround. A seam that
several people reach for and miss is a seam that should exist.
