# Add-ons

Every feature of the React grid is an add-on: sorting, selection, pagination, the stale-rows notice,
search, column filters, export, row actions, inline editing, column layout, the tree and windowing. `<Gridwright />`
itself is a shell. It renders a table, its rows and cells, the loading, empty and error rows, and
one live region, and nothing else.

An add-on of your own uses the same contract, through the same exports, with the same reach. There
is no internal API the built-in add-ons use and yours cannot. `tests/react/third-party-addon.test.tsx`
builds one from the public exports that touches every slot, and it is part of the suite.

## Using add-ons

```tsx
import { Gridwright, columnFilters, exportMenu, rowActions, search } from 'apsw-gridwright/react';

<Gridwright
    columns={columns}
    dataSource={source}
    addons={[search(), columnFilters(), exportMenu({ formats: ['csv', 'print'] }), rowActions({ items })]}
/>;
```

| Add-on | Name | What it does |
| :--- | :--- | :--- |
| `sorting()` | `gridwright:sorting` | The sort button in each sortable header, `aria-sort`, the sort announcement |
| `selection()` | `gridwright:selection` | Checkbox column, `aria-selected`, `aria-multiselectable`, the selected count |
| `pagination({ pageSizeOptions })` | `gridwright:pagination` | Page controls and the row range below the table |
| `staleNotice()` | `gridwright:stale-notice` | The banner when a refresh failed over rows still on screen |
| `search()` | `gridwright:search` | The search box, first in the toolbar |
| `columnFilters()` | `gridwright:filters` | A filter button per filterable header, one dialog, "clear filters" |
| `exportMenu(options)` | `gridwright:export` | The export menu: formats, the rows to export, custom formats |
| `rowActions({ items, trigger, placement })` | `gridwright:row-actions` | A floating menu over the row under the pointer or focus |
| `inlineEditing({ commit })` | `gridwright:inline-editing` | Editors for the columns that declare `edit` |
| `treeData(options)` | `gridwright:tree` | Nested or multi-parent rows, lazy children, the controller |
| `columnLayout(options)` | `gridwright:column-layout` | Resize handles, sticky pinned columns, and the column picker |
| `virtualRows({ rowHeight, overscan, height, renderSkeleton })` | `gridwright:virtual` | Renders the rows on screen only; replaces the page controls |

The first four are `coreAddons()`, which every grid starts with. Change the set with `coreAddons`:

```tsx
// Keep the core set, with different page sizes.
<Gridwright
    columns={columns}
    data={rows}
    coreAddons={[
        ...coreAddons<Row>().filter((addon) => addon.name !== 'gridwright:pagination'),
        pagination<Row>({ pageSizeOptions: [5, 50] }),
    ]}
/>;

// A bare table: no sort buttons, no checkboxes, no page controls.
<Gridwright columns={columns} data={rows} coreAddons={false} />;
```

`coreAddons={false}` removes the controls, not the engine's behaviour: the core pipeline plugins
still sort, filter and page. Pass `corePlugins={false}` for that.

**The list of names is the grid's identity.** Each add-on calls hooks, so a grid whose add-ons
change is remounted, which `<Gridwright />` does by keying itself on the names. Switching an add-on
on or off therefore resets the grid's own state: the page, the selection, an open dialog. The
add-on objects themselves may be new on every render; only their names matter.

With `useGridwright`, give the component that calls the hook a `key` built from the names
(`addonNamesOf(options)` returns it), or keep the list fixed. A changed list throws a
`GridwrightError` that says so, rather than an unrelated-looking React hook error.

## Writing an add-on

```tsx
import type { GridAddon } from 'apsw-gridwright/react';
import { useAddonMessages } from 'apsw-gridwright/react';

const messages = {
    en: { legend: 'Highlighted: salaries above {threshold}' },
    pl: { legend: 'Wyróżnione: pensje powyżej {threshold}' },
};

function Legend({ threshold }: { threshold: number }) {
    const t = useAddonMessages('acme:pay-band', messages);
    return <p>{t('legend', { threshold })}</p>;
}

export function payBand(threshold: number): GridAddon<Employee> {
    return {
        name: 'acme:pay-band',
        setup: () => ({
            messages,
            cellAttributes: (row, column) =>
                column.id === 'salary' && row.data.salary > threshold ? { className: 'pay-band--high' } : {},
            belowTable: () => <Legend threshold={threshold} />,
        }),
    };
}
```

An add-on is `{ name, setup }`, plus optional `requires`, `after` and `before`.

- **`name`** is namespaced like a plugin (`acme:pay-band`). It is unique within a grid, it is the
  namespace of the add-on's strings, and it is what other add-ons suppress, require or order against.
- **`setup(context)`** runs on every render, in add-on order, and may call hooks: a controller that
  lives as long as the grid, a ref, a piece of state. It returns the contribution. When it calls
  hooks, write it as a named function expression starting with `use`
  (`setup: function useHeatmap() { ... }`) so the React hooks lint rule checks it.
- **`context.options`** is the grid's options as the add-ons before this one configured them.
- **`requires`** names add-ons that must be listed; a missing one throws, naming both.
- **`after` / `before`** place this add-on relative to others when both are listed, whatever order
  they were written in. Inline editing is `before: ['gridwright:tree']`, so its editor lands inside
  the tree cell. A cycle throws.

**Slot functions must not call hooks.** They run while the shell renders, as many times as it needs
them. Put state in `setup`, or in a component the slot renders.

## The contribution

Every field is optional.

### The engine

| Field | Type | Use |
| :--- | :--- | :--- |
| `configure` | `(options) => options` | Wrap the data source, wrap columns, set the row id or the initial query. Applied in add-on order. |
| `plugins` | `GridPlugin[]` | Engine plugins, added after the core plugins and before the grid's own `plugins`. |
| `columnSignature` | `(column) => string` | Extra text for the column signature, for column options your `configure` reads. |

Plugins are reconciled by name on a live grid: a name that appears is installed, a name that
disappears is removed. A new object under a name already installed is ignored, so memoise a plugin
whose behaviour changes, or give it a new name.

### Composition

| Field | Type | Use |
| :--- | :--- | :--- |
| `provide` | `(children, grid) => ReactNode` | Wrap the grid's content in providers. First add-on outermost, inside the root element. |
| `suppresses` | `string[]` | Add-ons whose rendering this one replaces. Their `configure`, plugins and strings still apply. |
| `navigation` | `'pages' \| 'window'` | `window` when the reader moves by scrolling. The live region then says the total, not a range. |

### Around the table

| Field | Where |
| :--- | :--- |
| `toolbar` | In the toolbar, in add-on order, before the grid's own `toolbar` content |
| `toolbarStatus` | In the toolbar, but never the reason one appears: a selection count |
| `aboveTable` | Between the toolbar and the table |
| `belowTable` | After the table, before the grid's `footer` |
| `overlay` | Inside the root, outside the layout: a floating menu, a dialog |

The toolbar renders only when some `toolbar` item, or the grid's own `toolbar`, renders something.

### The table

| Field | Type |
| :--- | :--- |
| `tableAttributes` | `(grid) => attributes` on the `<table>` (a tree sets `role: 'treegrid'`) |
| `tableWrapper` | `(grid) => { ref, style, className }` for the scrolling wrapper |
| `tableKeyDown` | `(event, grid) => boolean`, in add-on order until one returns `true` |
| `tableFooter` | `(grid) => <tfoot>` |

### The header

| Field | Type |
| :--- | :--- |
| `headerLabel` | `(column, grid) => ReactNode`: the label itself. One owner. `headerContentOf(column, grid)` gives the column's own header content. |
| `headerBefore` / `headerAfter` | `(column, grid) => ReactNode` beside the label, never inside it |
| `headerAttributes` | `(column, grid) => attributes` on the `<th>` |

### The body

| Field | Type |
| :--- | :--- |
| `columns` | `ExtraColumn[]`: `{ id, placement: 'start' \| 'end', header, cell, className }` |
| `extraCellAttributes` | `(row, columnId, grid) => attributes` on any add-on's extra column cell (pin the checkbox column) |
| `extraHeaderAttributes` | `(columnId, grid) => attributes` on an extra column's header cell |
| `body` | `(grid) => ReactNode`: the whole `<tbody>`. One owner. |
| `rowAttributes` | `(row, grid) => attributes` on each `<tr>` |
| `renderRow` | `(row, grid) => ReactNode \| undefined`: a row of your own kind. First add-on wins. |
| `cellAttributes` | `(row, column, grid) => attributes` on each data `<td>` |
| `status` | `{ loading, empty, error }` renderers for the status rows. Last add-on wins. |

A body of your own renders each row with `<GridRowOrCustom row position />` (or `GridRowView`), so
every other add-on's row and cell attributes, extra columns and custom rows keep applying.

### Speech and copy

| Field | Type |
| :--- | :--- |
| `announce` | `{ priority, key?, describe }[]` for the live region |
| `messages` | `{ en: {...}, pl: {...}, ... }`, the add-on's own strings |

**Announcements.** While a fetch is in flight the region says "loading", and on an error it says
nothing, because an alert already speaks. Once the grid settles, every contributor's `describe` is
asked with the previous and next settled state; the highest `priority` non-null sentence wins, ties
to the earlier add-on, and the row range is said when nobody has anything. `key(state)` says what
your sentence depends on, so the region is re-evaluated when it changes and not on every selection.
Sorting uses priority 20 and column filters 10. For something that is not grid state, such as an
export finishing, call `grid.announce(sentence)`.

## Attributes are an allowlist

An add-on may contribute event handlers (`on*`, as functions), `aria-*` and `data-*` (as scalars),
`className`, `style`, and `role`, `id`, `title`, `tabIndex`, `hidden`, `dir`, `lang`, `draggable`,
`scope`, `colSpan`, `rowSpan`, `abbr`, `headers`. Nothing else passes, whatever the types said:
no children, no markup, no URL attribute, no handler written as a string. `mergeAttributes` enforces
it at runtime, so an add-on can never hand the grid a sink the package does not have.

Merging: class names join, styles merge with the later value winning, handlers run in order with the
shell's own first, and every other attribute takes the last value.

## Failure

A slot function that throws renders nothing, and the error is reported to the console with the
add-on's name. An announcement contributor that throws loses its sentence. The grid keeps going:
the same rule a pipeline plugin follows. What a slot renders is ordinary React and fails the
ordinary way, so put an error boundary around a component that might throw.

Two owners of `headerLabel` or of `body` throw at render, naming both, unless one suppresses the
other. A duplicate name, a missing requirement and an ordering cycle throw too.

## Strings

`useAddonMessages(name, fallback)` in a component, or `addonMessages(translator, contributions, name)`
outside one, resolves a key in this order:

1. the grid's `translate` function, under `<name>.<key>`, unless it echoes the key back;
2. the grid's `messages`, under `<name>.<key>`;
3. the locale pack's `addons[name][key]`;
4. the add-on's own catalog for the grid's locale, then for its base language;
5. English;
6. the key itself, which `auditAddonMessages` exists to catch in a test.

```tsx
<Gridwright messages={{ 'gridwright:filters.apply': 'Go', 'acme:pay-band.legend': 'Top earners' }} />
```

The packs in `apsw-gridwright/locales` translate every built-in add-on, so `locale={pl}` translates
the whole grid. A pack of your own can translate a third-party add-on the same way:

```ts
const myPl: LocaleCatalog = { ...pl, addons: { ...pl.addons, 'acme:pay-band': { legend: '...' } } };
```

`auditAddonMessages({ en, pl })` reports, per language, the keys a catalog is missing and the keys it
invented. An empty result is a complete catalog.

## Column options of your own

The built-in add-ons read `edit` and `filter` from a column. An add-on of yours adds its own option to
`GridwrightColumn` by module augmentation, through the package's specifier:

```ts
declare module 'apsw-gridwright/react' {
    interface GridwrightColumn<TRow, TValue> {
        readonly heat?: { readonly above: number };
    }
}
```

Read it at render time from `grid.definitions.get(column.id)?.heat`. If `configure` reads it, add it
to `columnSignature` so a change reaches the engine.

## Composing by hand

The shell's parts render contributions from context, so a layout of your own keeps every add-on:

```tsx
const grid = useGridwright({ columns, data, addons: [columnFilters(), exportMenu()] });

<GridwrightProvider instance={grid}>
    <GridRoot>                          {/* the live region, providers and overlays */}
        <GridToolbar />                 {/* toolbar items */}
        <GridSlot name="aboveTable" />
        <GridTable aria-label="People">
            <GridHeader />
            <GridBody />
        </GridTable>
        <GridSlot name="belowTable" />
    </GridRoot>
</GridwrightProvider>;
```

A row menu of your own is `useBubbleMenu(trigger)` in `setup`, its `rowHandlers(row.id)` returned from
`rowAttributes`, and `<BubbleMenuView controller={menu} items={...} />` in `overlay`: exactly how
`rowActions()` is built.

Leave out `GridRoot` and the add-ons' providers are missing: the filter dialog, the tree context and
the windowed scroll have nowhere to live.
