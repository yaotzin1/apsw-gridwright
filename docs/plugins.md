# Writing a plugin

Sorting, filtering, search and pagination are plugins. They get no privileged access, no private
API and no special ordering, so anything they do, a plugin of yours can do. That equality is the
design guarantee: if a built-in can do something yours cannot, the plugin API is incomplete and
that is a bug worth reporting.

## The shape

```ts
import { STAGE_ORDER } from 'apsw-gridwright';
import type { GridPlugin } from 'apsw-gridwright';

export function activeOnlyPlugin<TRow extends { active: boolean }>(): GridPlugin<TRow> {
    return {
        name: 'acme:active-only',
        setup(context) {
            return context.registerStage({
                id: 'acme:active-only',
                order: STAGE_ORDER.FILTER + 1,
                capability: 'filter',
                run(rows) {
                    const kept = rows.filter((row) => row.active);
                    return { rows: kept, totalRows: kept.length };
                },
            });
        },
    };
}
```

Install it at construction, or at runtime:

```ts
createGridEngine({ columns, dataSource, plugins: [...corePlugins(), activeOnlyPlugin()] });

const remove = api.use(activeOnlyPlugin());   // returns an unsubscribe that removes it cleanly
```

`api.use` recomputes immediately from rows already fetched, so a plugin added after the first load
takes effect without a round trip.

## The five rules

**Namespace everything.** Plugin names and stage ids are global within one engine. Prefix with your
package: `acme:grouping`, never `grouping`. A duplicate id throws rather than replacing the
existing stage, because silent replacement makes plugin order load-bearing and invisible.

**Update the total when you change the row count.** A stage that narrows the set and does not
return `totalRows` leaves the page count describing rows that are no longer there, and the reader
clicks into empty pages.

**Declare a `capability` if a server could have done it.** A stage marked `capability: 'filter'` is
skipped whenever the data source reports `filter: true`. That single line is what makes the same
plugin correct against an array and against a filtering endpoint.

**Never mutate the array you were given.** It may be a local data source's own storage. Copy first;
`[...rows].sort(...)` rather than `rows.sort(...)`.

**Return a teardown from `setup`.** Anything you allocated, release there. The engine calls it on
`destroy()` and when the plugin is removed.

## A plugin is a pipeline stage

If your extension needs the DOM, it is not a plugin. Floating menus, editors and anything that
measures are React components that read the grid context, because the core is DOM-free by contract.
`BubbleMenu` and `InlineEditProvider` are built that way and get no privileged access. See
[extensibility.md](extensibility.md#10-adapter-components).

## Stage order

```
PRE        0     before anything else sees the rows
FILTER   100     core:filter
SEARCH   200     core:search
SORT     300     core:sort
TRANSFORM 500    grouping, aggregation, injected rows
PAGINATE 900     core:paginate
POST    1000     decoration only; cannot change the total
```

Position relative to a named slot rather than inventing a number, and remember what runs after you.
Anything registered after `PAGINATE` sees one page.

## Recipes

### A row filter with configuration

The commonest plugin. Note the closure: configuration goes in the factory, not in grid state.

```ts
export function withinDaysPlugin<TRow>(columnId: string, days: number): GridPlugin<TRow> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return {
        name: 'acme:within-days',
        setup: (context) =>
            context.registerStage({
                id: 'acme:within-days',
                order: STAGE_ORDER.FILTER + 1,
                capability: 'filter',
                run(rows, pipeline) {
                    const column = pipeline.columns.find((entry) => entry.id === columnId);
                    if (!column) return rows;    // a stale column id must not blank the grid

                    const kept = rows.filter((row) => Date.parse(String(column.getValue(row))) >= cutoff);
                    return { rows: kept, totalRows: kept.length };
                },
            }),
    };
}
```

### Injecting rows: group headers

> The tree does this for real, and it is worth reading `src/tree/` alongside this sketch. It
> injects nothing, but it does replace filtering, searching and sorting with tree-aware versions
> and flatten the result, which is the same shape of problem one step further on.


Grouping is a `TRANSFORM` stage. It runs after sorting, so the groups come out in the order the
sort produced, and before pagination, so a group header counts toward the page.

```ts
type Grouped<TRow> = TRow | { readonly __group: string; readonly count: number };

export function groupByPlugin<TRow>(columnId: string): GridPlugin<Grouped<TRow>> {
    return {
        name: 'acme:group-by',
        setup: (context) =>
            context.registerStage({
                id: 'acme:group-by',
                order: STAGE_ORDER.TRANSFORM,
                run(rows, pipeline) {
                    const column = pipeline.columns.find((entry) => entry.id === columnId);
                    if (!column) return rows;

                    const output: Grouped<TRow>[] = [];
                    let current: string | null = null;

                    for (const row of rows) {
                        const key = column.getText(row as TRow);
                        if (key !== current) {
                            current = key;
                            output.push({ __group: key, count: 0 });
                        }
                        const header = output.find(
                            (entry) => '__group' in entry && entry.__group === key,
                        ) as { count: number };
                        header.count += 1;
                        output.push(row);
                    }

                    // The injected headers are rows now, so the total has to count them or the
                    // last page comes up short.
                    return { rows: output, totalRows: output.length };
                },
            }),
    };
}
```

Render the marker rows in a `cell` renderer, and give them stable ids through `getRowId`:

```tsx
<Gridwright
    columns={columns}
    data={rows}
    getRowId={(row, index) => ('__group' in row ? `group:${row.__group}` : row.id)}
/>
```

### Aggregation without touching the rows

An aggregate is not a row transformation, so it publishes to `state.meta` instead. Compute it in a
stage that returns its input unchanged.

```ts
export function totalsPlugin<TRow>(columnId: string): GridPlugin<TRow> {
    return {
        name: 'acme:totals',
        setup(context) {
            return context.registerStage({
                id: 'acme:totals',
                // Before pagination, so the total describes the matches rather than the page.
                order: STAGE_ORDER.PAGINATE - 1,
                run(rows, pipeline) {
                    const column = pipeline.columns.find((entry) => entry.id === columnId);
                    const sum = column
                        ? rows.reduce((carry, row) => carry + Number(column.getValue(row) ?? 0), 0)
                        : 0;

                    context.setMeta('sum', sum);
                    return rows;
                },
            });
        },
    };
}
```

Read it where you render:

```tsx
const { state } = useGridwright({ columns, data });
const sum = state.meta['acme:totals:sum'] as number | undefined;
```

Meta keys are namespaced with the plugin name, so two plugins publishing `sum` cannot collide.

### Persisting the query

No stage at all. A plugin can be pure lifecycle.

```ts
export function persistQueryPlugin<TRow>(storageKey: string): GridPlugin<TRow> {
    return {
        name: 'acme:persist-query',
        setup(context) {
            // Returned from setup, so it is released on destroy and on removal.
            return context.on('query:change', ({ query }) => {
                sessionStorage.setItem(storageKey, JSON.stringify(query));
            });
        },
    };
}
```

Restore on the way in, through `initialQuery`, not through the plugin:

```ts
const saved = sessionStorage.getItem('people-grid');
createGridEngine({ columns, dataSource, initialQuery: saved ? JSON.parse(saved) : undefined });
```

This one touches `sessionStorage`, so it belongs in your application rather than in the core, where
browser globals are banned.

### Telemetry

```ts
export function telemetryPlugin<TRow>(track: (event: string, data: object) => void): GridPlugin<TRow> {
    return {
        name: 'acme:telemetry',
        setup(context) {
            const off = [
                context.on('fetch:success', ({ totalRows, durationMs }) =>
                    track('grid.load', { totalRows, ms: Math.round(durationMs) })),
                context.on('fetch:error', ({ error }) =>
                    track('grid.error', { message: error.message, status: error.status })),
                context.on('query:change', ({ query }) =>
                    track('grid.query', { sorted: query.sort.length > 0, searched: query.search !== '' })),
            ];
            return () => off.forEach((unsubscribe) => unsubscribe());
        },
    };
}
```

Note what does not appear here: a `fetch:success` for a superseded request. The engine drops stale
responses before any listener runs, so a telemetry plugin cannot accidentally count them.

### Replacing a built-in

`corePlugins()` returns the four defaults. Spread it to add, or build the array yourself to
replace one:

```ts
import { corePlugins, filteringPlugin, paginationPlugin, searchPlugin } from 'apsw-gridwright';

createGridEngine({
    columns,
    dataSource,
    plugins: [
        filteringPlugin(),
        searchPlugin({ wholeWord: true }),
        myOwnSortingPlugin(),          // a different id, so nothing collides
        paginationPlugin(),
    ],
});
```

Drop a plugin entirely and that behaviour simply does not happen. Omit `paginationPlugin()` and
every matching row renders, which is exactly what you want if a virtualizer is doing the windowing.

## Testing a plugin

Test through the engine, with a local source. It is a real integration and it is still fast.

```ts
import { createGridEngine, createLocalDataSource, corePlugins } from 'apsw-gridwright';

const api = createGridEngine({
    columns,
    dataSource: createLocalDataSource(rows),
    plugins: [...corePlugins(), activeOnlyPlugin()],
});

expect(api.getState().totalRows).toBe(5);
expect(api.getState().rows.every((row) => row.data.active)).toBe(true);
```

Cover four things, because each is a way plugins usually break:

1. The stage narrows the rows **and** updates the total.
2. The stage is skipped when the data source declares the capability.
3. Removing the plugin restores the previous behaviour.
4. A stage that throws leaves the grid usable and reports on `plugin:error`.

`tests/unit/extensibility.test.ts` in this repository is that suite, written against a plugin
defined the way a consumer would define one.

## Publishing a plugin

Peer-depend on `apsw-gridwright`, do not bundle it, and name the package for what it does. Export
a factory function rather than a plugin object, so configuration has somewhere to live and two
grids on one page get their own instances.

```json
{
  "name": "gridwright-plugin-grouping",
  "peerDependencies": { "apsw-gridwright": "^0.2.0" }
}
```

State the stage ids you register in your README. They are global within an engine, and someone
combining two plugins needs to know before they hit the duplicate-id error.
