---
name: extensibility
description: Use when writing a plugin or a pipeline stage, when choosing a stage order, or when a built-in behaviour needs replacing. Covers the plugin lifecycle and what third-party code is allowed to reach.
---

# Plugin & Pipeline Stage Author

Sorting, filtering, search and pagination are engine plugins. Every visible feature of the React grid
is an add-on. Neither kind has privileged access, and neither does one written outside this package.
That equality is a design guarantee: if a built-in can do something a third-party plugin or add-on
cannot, the extension API is incomplete, and the fix is a new public seam, not a private import.

There are two layers, and a feature usually needs one of each:

| Layer | Contract | Owns | Reference |
| :--- | :--- | :--- | :--- |
| Engine plugin | `GridPlugin` (`src/core/types.ts`) | rows, stages, `state.meta`, events | this file |
| React add-on | `GridAddon` (`src/react/addons/types.ts`) | everything a person sees or operates | `docs/addons.md` |

An add-on brings its plugins through its `plugins` contribution, so a consumer lists one thing.

## The plugin shape

```ts
const myPlugin = (): GridPlugin<Row> => ({
    name: 'acme:highlight',
    setup(context) {
        return context.registerStage({
            id: 'acme:highlight',
            order: STAGE_ORDER.TRANSFORM,
            capability: 'filter',       // optional: skip when the source already did this
            skip: (pipeline) => false,  // optional: skip this pass for a reason of your own
            run(rows, pipeline) {
                const kept = rows.filter(() => true);
                return { rows: kept, totalRows: kept.length };
            },
        });
    },
});
```

`setup` returns a teardown. Register listeners and timers there, release them in the teardown, and
the engine calls it on `destroy()` and on `removePlugin(name)`.

## Stage order

`STAGE_ORDER` names the slots: `PRE`, `FILTER`, `SEARCH`, `SORT`, `TRANSFORM`, `PAGINATE`, `POST`.
Position relative to a named slot rather than inventing a number, and remember what runs after you:
anything registered after `PAGINATE` sees one page, so it cannot change the total.

A stage that narrows the set **must** return an updated `totalRows`. Omitting it leaves the page
count describing rows that are no longer there, and the reader clicks into empty pages.

`capability` covers the four query facets a source can resolve. For anything else (grouping a
server already did, a transformation switched off by your own option) use `skip`, never a branch
inside `run` that checks where the rows came from.

## Namespace your ids

Stage ids, plugin names and add-on names are global within one grid. Prefix with your package:
`acme:group`, not `group`. A duplicate stage id throws rather than silently replacing the existing
stage, because silent replacement makes plugin order load-bearing and invisible.

## Failure is contained on purpose

A stage that throws loses its own effect and nothing else. The rows continue to the next stage and
the failure surfaces on `plugin:error`. An add-on slot function that throws renders nothing and is
reported with the add-on's name. Do not "fix" either by letting the exception propagate: an empty
grid caused by a broken extension is indistinguishable from a data source returning nothing, and the
reader will go looking in the wrong place.

## Replacing or composing with a built-in

- `plugins` **adds** to the core plugins. A plugin whose `name` matches a core plugin's replaces that
  one. `corePlugins: false` installs none of the four.
- `PluginContext.suppressStage(id)` skips someone else's stage while your plugin is installed. It is
  reference-counted and released on teardown. The tree suppresses `core:filter`, `core:search` and
  `core:sort` this way instead of replacing the plugin list, so it composes with every other plugin.
- `api.removePlugin(name)` uninstalls by name and runs the teardown. `useGridwright` reconciles plugin
  lists by name on a live engine; a new object under an installed name is ignored, so memoise it or
  rename it.
- State that changes what is shown but not what is fetched (an expanded node, a collapsed group, a
  plugin option) calls `api.invalidatePipeline()`, never `refresh()`.
- Options a plugin needs live on the plugin, not in `GridQuery`. The query is the contract with the
  server; widening it for one plugin changes every data source's input.

## Writing an add-on

The contract, every slot and the message resolution order are in `docs/addons.md`. The rules that
are easy to break:

- **No privileged access.** A built-in add-on imports only what `apsw-gridwright/react` exports.
  If it needs something that is not exported, export it (and classify it) or change the design.
  `tests/react/third-party-addon.test.tsx` builds an add-on from public exports that reaches every
  slot; a new slot is not done until that test reaches it too.
- **`setup` may call hooks; slot functions must not.** `setup` runs on every render in add-on order.
  When it calls hooks, write it as a named function expression starting with `use`
  (`setup: function useHeatmapSetup(context) { ... }`) so `react-hooks/rules-of-hooks` checks it.
  Slot functions (`toolbar`, `headerAfter`, `rowAttributes`, ...) run while the shell renders, as
  often as it likes; put state in `setup` or in a module-level component the slot renders.
- **Add-on names are the grid's identity.** `<Gridwright />` keys itself on the list of names, so
  switching an add-on on or off remounts the grid and resets its own state. With `useGridwright`,
  key the calling component on `addonNamesOf(options)`.
- **Attributes are an allowlist.** `mergeAttributes` passes `on*` functions, scalar `aria-*` and
  `data-*`, `className`, `style` and a short list of safe attributes, and drops everything else. No
  slot accepts markup or an HTML string. Never widen the allowlist to make an add-on work.
- **One-owner slots.** `headerLabel` and `body` have one owner; two owners throw, naming both,
  unless one `suppresses` the other. `renderRow` is first-wins, `status` last-wins.
- **Suppression is view-only.** `suppresses: ['gridwright:pagination']` hides that add-on's rendering
  and keeps its `configure`, `plugins` and messages. Suppressing an engine stage is `suppressStage`.
- **Order with `after` / `before`**, not with the position in the consumer's list, when the result
  depends on it (inline editing is `before: ['gridwright:tree']`). `requires` names a dependency.
- **Strings belong to the add-on.** Ship `messages: { en, de, es, fr, pl }` and read them with
  `useAddonMessages(name, messages)`. A consumer overrides with `messages={{ 'acme:x.key': ... }}`,
  `translate`, or a locale pack's `addons[name]`; the packs in `apsw-gridwright/locales` carry every
  built-in add-on. `auditAddonMessages` in a test catches a missing key.
- **Column options by module augmentation**, through the package specifier, exactly as `edit` and
  `filter` are declared:

  ```ts
  declare module 'apsw-gridwright/react' {
      interface GridwrightColumn<TRow, TValue> {
          readonly heat?: { readonly above: number };
      }
  }
  ```

  An augmentation through a relative path does not survive bundling. If `configure` reads the
  option, contribute it to `columnSignature` so a change reaches the engine.
- **Announce through the one live region.** Contribute `announce` for grid state, or call
  `grid.announce(sentence)` for an event; never render a second `role="status"`.

## Tests an extension change must keep green

- `tests/react/third-party-addon.test.tsx`: a third-party add-on reaches every slot.
- `tests/smoke/tree-shaking.test.ts`: an entry importing only `Gridwright` contains no feature code.
  A part or the shell importing an add-on breaks it.
- The unit tests for `suppressStage`, `skip`, additive `plugins` and `removePlugin`.
