---
name: extensibility
description: Use when writing a plugin or a pipeline stage, when choosing a stage order, or when a built-in behaviour needs replacing. Covers the plugin lifecycle and what third-party code is allowed to reach.
---

# Plugin & Pipeline Stage Author

Sorting, filtering, search and pagination are plugins. They have no privileged access, and neither
does a plugin written outside this package. That equality is a design guarantee: if a built-in can
do something a third-party plugin cannot, the plugin API is incomplete.

## The shape

```ts
const myPlugin = (): GridPlugin<Row> => ({
    name: 'acme:highlight',
    setup(context) {
        return context.registerStage({
            id: 'acme:highlight',
            order: STAGE_ORDER.TRANSFORM,
            capability: 'filter',       // optional: skip when the source already did this
            run(rows, pipeline) {
                const kept = rows.filter(() => true);
                return { rows: kept, totalRows: kept.length };
            },
        });
    },
});
```

`setup` returns a teardown. Register listeners and timers there, release them in the teardown, and
the engine calls it on `destroy()` and when the plugin is removed.

## Stage order

`STAGE_ORDER` names the slots: `PRE`, `FILTER`, `SEARCH`, `SORT`, `TRANSFORM`, `PAGINATE`, `POST`.
Position relative to a named slot rather than inventing a number, and remember what runs after you:
anything registered after `PAGINATE` sees one page, so it cannot change the total.

A stage that narrows the set **must** return an updated `totalRows`. Omitting it leaves the page
count describing rows that are no longer there, and the reader clicks into empty pages.

## Namespace your ids

Stage ids and plugin names are global within one engine. Prefix with your package: `acme:group`,
not `group`. A duplicate id throws rather than silently replacing the existing stage, because
silent replacement makes plugin order load-bearing and invisible.

## Failure is contained on purpose

A stage that throws loses its own effect and nothing else. The rows continue to the next stage and
the failure surfaces on `plugin:error`. Do not "fix" this by letting the exception propagate: an
empty grid caused by a broken plugin is indistinguishable from a data source returning nothing, and
the reader will go looking in the wrong place.

## Replacing a built-in

Pass your own array to `createGridEngine({ plugins })`. `corePlugins()` returns the defaults, so
spread it and add, or omit it entirely. Replacing sorting means passing every plugin except
`sortingPlugin()` plus your own, under a different id.
