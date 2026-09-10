# Workflow: Creating a Plugin

A plugin is how this package is extended. The four built-ins are plugins with no privileged access,
so anything they do, an external plugin can do.

## 1. Decide it is a plugin

It is a plugin if it transforms rows. It is not a plugin if it changes what the data source is
asked for; that is query state, and it belongs in `GridQuery`.

## 2. Write it

`src/plugins/<name>.ts`, or your own package:

```ts
import { STAGE_ORDER } from 'apsw-gridwright';
import type { GridPlugin } from 'apsw-gridwright';

export function groupingPlugin<TRow>(columnId: string): GridPlugin<TRow> {
    return {
        name: 'acme:grouping',
        setup(context) {
            return context.registerStage({
                id: 'acme:grouping',
                order: STAGE_ORDER.TRANSFORM,
                run(rows, pipeline) {
                    const grouped = group(rows, columnId, pipeline.columns);
                    return { rows: grouped, totalRows: grouped.length };
                },
            });
        },
    };
}
```

Checklist:

- Namespace the plugin name and every stage id with your package prefix.
- Declare `capability` if the stage duplicates something a server may already have done.
- Return an updated `totalRows` whenever the stage changes the row count.
- Return a teardown from `setup` for anything you allocated.

## 3. Register it

```ts
createGridEngine({ columns, dataSource, plugins: [...corePlugins(), groupingPlugin('team')] });
```

Or at runtime with `api.use(plugin)`, which returns an unsubscribe that removes it cleanly.

## 4. Test it

`tests/unit/` with a local source. Cover: the stage narrowing rows and updating the total, the
stage skipped when the source declares the capability, removal restoring the previous behaviour,
and a throwing stage leaving the grid usable.

## 5. Document it

If it ships in this package, add it to `src/plugins/index.ts`, to the README's plugin section, and
to `api-surface.md` as a minor addition.
