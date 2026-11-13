# Writing a renderer for another framework

The grid is an engine plus an adapter, and the adapter is now split in two. Everything that *decides* what the grid is
(which columns, which rows, which attributes each cell carries, what a click means, what the live region says) is
written once, with no framework, in the **view layer**. A renderer only *draws* it. React is the first renderer; this
page is for the second one (Vue, Angular, Svelte, a custom element, a terminal), and for anyone who wants to write a
feature once instead of once per framework.

Why it was done, and what it costs, is on [Why a view layer](architecture.md).

Nothing here changes how you use the React grid. `<Gridwright />`, `useGridwright` and every existing add-on behave as
before; this is an additional road, and the React grid travels it too.

```text
engine (src/core, ...)        rows, query, state, pipeline          no DOM, no framework
   │
view layer  (@apsw/gridwright/view)
   │   createGridHost  ->  TableModel  ->  tableNode  ->  ViewNode (plain data)
   │   neutral add-ons: sorting(), selection(), pagination(), and yours
   ▼
renderer    (@apsw/gridwright/react: renderNode;  or yours)
```

Two package entries carry this, and both import where no UI framework is installed:

| Entry | Holds |
| :--- | :--- |
| `@apsw/gridwright/view` | the table model, the node description and its allowlist, the neutral add-on contract, the three core add-ons written once, a text renderer, `createGridHost` |
| `@apsw/gridwright/conformance` | scenarios a renderer runs against its own grid to show it behaves as the React one does |

## The node description

A grid is drawn from a `ViewNode`: plain data, built with `h`, `text`, `fragment`, `slot` and `component`.

```ts
import { h } from '@apsw/gridwright/view';

h('button', { attrs: { type: 'button', className: 'gw-sort-button' }, on: { click: (event) => void doSomething(event.shiftKey) } }, 'Name');
```

It is deliberately small. A node can name only a tag from `ALLOWED_TAGS`, an attribute from `NODE_ATTRIBUTES`, an event
from `HANDLER_NAMES` (`click`, `keydown`, `keyup`, `input`, `change`, `focus`, `blur`, `pointerdown`), and a style value
that is plain data. `sanitizeNode(node)` applies that allowlist and reports what it dropped; **every renderer must call
it first**, and `renderNode` and `renderToText` do. This is what lets a third-party add-on contribute markup without
being able to contribute a script, a `url()` that fetches, an `on*` string or a `javascript:` link.

- A handler receives a `ViewEvent`, never the native event: `key`, `shiftKey`, `ctrlKey`, `metaKey`, `altKey`, `button`,
  `value`, `checked`, `preventDefault()`, `stopPropagation()`, and a lazy `origin` (see below).
- A handler may return an action. The one action that does something is `{ type: 'focus', key }`, which moves focus to
  the element **drawn with that `key`** in the same drawing. It never reaches another grid or an element elsewhere on
  the page, and a name that matches nothing is ignored.
- A `slot` node is filled by name by the renderer; a `component` node is resolved from a registry **the renderer owns**.
  The data never names what runs.

## A neutral add-on

Not sure whether you need one? If the add-on is for a React application, you probably do not: see
[React add-on or neutral add-on?](addons.md#react-add-on-or-neutral-add-on) for the decision and what each contract can
reach.

A neutral add-on is the same idea as a React add-on (a name, `requires`/`after`/`before`, a `setup` that returns
contributions) with nodes instead of JSX and a `ViewEvent` instead of `KeyboardEvent`. It is a separate type from
`GridAddon`, so no existing add-on's types changed, and it is accepted anywhere a `GridAddon` is.

```ts
import { defineAddon, h } from '@apsw/gridwright/view';

export const rowCount = <TRow,>() =>
    defineAddon<TRow>({
        name: 'acme:row-count',
        setup: ({ state }) => {
            const clicks = state('clicks', 0); // a Store kept per grid; writing it redraws the grid
            return {
                messages: { en: { total: '{count} rows' } },
                belowTable: (grid) => {
                    const t = grid.messages('acme:row-count', { en: { total: '{count} rows' } });
                    return h(
                        'button',
                        { attrs: { type: 'button' }, on: { click: () => clicks.update((n) => n + 1) } },
                        t('total', { count: grid.state.rows.length }),
                    );
                },
            };
        },
    });
```

What a neutral add-on can contribute, all optional: `headerLabel`, `headerAttributes`, `columns` (extra columns, such as
a checkbox column), `tableAttributes`, `rowAttributes`, `rowHandlers`, `tableKeyDown`, `toolbarStatus`, `belowTable`,
`settled`, `announce`, `messages`, `suppresses`, `navigation`. Three things worth knowing:

- **`state(key, initial)`** gives a `Store` that lives as long as the grid, so state survives a re-render and changed
  options. A slot function never subscribes by hand; the host redraws when a store changes.
- **Contributed attributes go through the same allowlist** as the rest, header, table and row bags included, so a
  `style` with a `url()` is refused whole rather than trimmed.
- **`settled`** runs after the grid commits a change that moved the page (`state.version`, `hasNextPage` or
  `hasPreviousPage` changed) and may return `{ type: 'focus', key }`. This is how the pager keeps focus on a button that
  still exists after the page changes. The key is looked up only in this add-on's own drawing.

`sorting()`, `selection()` and `pagination()` are written exactly this way, and the React `sorting()`, `selection()` and
`pagination()` are those add-ons adapted, so the behaviour is shared rather than copied. Read `src/view/addons/*` as the
worked examples.

## Writing a renderer

You need five things, in this order.

1. **A host.** `createGridHost` owns the engine, the add-ons and their per-grid state, and the live region. You do not
   need a hook or a store library to lean on.

   ```ts
   import { createGridHost, pagination, selection, sorting } from '@apsw/gridwright/view';

   const host = createGridHost<Person>({
       columns,
       data,                      // or dataSource
       pageSize: 25,
       selectionMode: 'multiple',
       coreAddons: [sorting(), pagination()],   // default: sorting only; `false` for a bare table
       addons: [selection()],
   });
   ```

2. **A model, and a node.** `host.getModel()` returns the table as plain data: `root`, `live`, `table`, `caption`,
   `header`, `toolbar`, `belowTable`, `body`. The body is `{ kind: 'rows', rowCount, row(index) }` (rows are built on
   request, so a million-row grid does not build a million row models to draw ten) or `{ kind: 'status', ... }` for
   loading, empty and error. `tableNode(model)` turns the whole thing into one `ViewNode`; use it unless you want to lay
   the pieces out yourself.

3. **A draw.** Walk `sanitizeNode(tableNode(model)).node`, creating your framework's elements: tag and attributes as they
   are, `on.<name>` as a listener that builds a `ViewEvent` (with `viewEvent({ ... })`) and calls the handler, `slot`
   from your slots, `component` from your registry. `renderToText` and `stringRenderer` in `src/view/text-renderer.ts` are
   the shortest complete example.

4. **A redraw.** `host.subscribe(listener)` fires after the model changes; call `host.getModel()` again and update. Then
   `host.takeFocusRequest()` returns, once, the `key` an add-on's `settled` asked focus to move to; focus the element you
   drew with that `key`. Call `host.destroy()` when the grid goes away.

5. **The live region.** `model.live` is the sentence for a polite, atomic, visually hidden region. A screen reader is
   told a sort or a page changed only through it, so a renderer that forgets it passes every look-at-the-markup test and
   fails every user of assistive technology. The conformance kit checks it.

### Answering `origin`

A row click means "select this row" only when it did not start on a control, a text selection, or a nested grid. A
`ViewEvent` carries a lazy `origin` for exactly this: `{ cell?: { rowId, columnId, holdsControl, targetIsCell },
fromControl, fromNestedGrid, textSelected }`. Compute it when asked and **only while the handler runs** (after dispatch
the native event is gone, and the safe answer is "from a control, so select nothing"). The React renderer's
`toViewEvent` is the reference.

### What the model leaves to you

Be honest with your users about the gaps in the current model; they are recorded in
`specs/adapter-architecture/review.md`:

- `extraCellAttributes` and `extraHeaderAttributes`, and `aria-colindex` under a column window, are not modelled.
- A handler that throws propagates out of the model rather than being isolated per add-on.
- `settled` is drawn together with `belowTable`.
- Virtualized rows and columns, row detail, the tree and the other feature add-ons are React add-ons today. They keep
  working in React unchanged; they have no neutral version yet.

## Proving it behaves: the conformance kit

```ts
import { describe, it } from 'vitest';
import { conformanceSuite } from '@apsw/gridwright/conformance';
import type { ConformanceDriver } from '@apsw/gridwright/conformance';

const driver: ConformanceDriver = { mount: async (options) => { /* draw, return a DriverGrid */ }, unmount: () => { /* clean up */ } };

conformanceSuite(driver, { describe, it }, { skip: { 'sorting/multi-sort': 'Shift is not wired yet' } });
```

The kit imports no test library: you pass your runner's `describe` and `it`. It asks only what a reader of the page
could answer (role, accessible name, text, attribute, checked, value, what has focus, what the live region says), never
how your adapter is built, so one set of scenarios holds a React grid, a Vue grid and a string renderer to the same
behaviour. A skip must carry its reason, and the reason becomes part of the test name, so an adapter cannot quietly drop
behaviour. A skipped id that is not a scenario throws.

There are 17 scenarios in three families, `sorting/*`, `selection/*` and `pagination/*`, covering the sort cycle and
`aria-sort`, the select-all checkbox and its mixed state, the range and "of many", focus after a page change and the
live-region sentences.

Three drivers ship in this repository's tests and are the templates to copy:

| Driver | Renderer | What its passing shows |
| :--- | :--- | :--- |
| `tests/helpers/react-conformance-driver.tsx` | `<Gridwright />`, through Testing Library | the reference behaviour |
| `tests/helpers/node-conformance-driver.ts` | none: the node tree is read by role and name, with **no DOM at all** | the model describes a grid completely enough that a renderer needs nothing from React |
| `tests/helpers/dom-conformance-driver.ts` | `tests/helpers/dom-renderer.ts`, a renderer on the **plain DOM**, driven with `user-event` | the contract also holds against a lifecycle that is not React's |

The plain-DOM renderer is the closest thing to a second framework adapter in this repository, and the shortest one to
read before writing yours (about 300 lines). It imports nothing from React (a test checks), and it differs from React
exactly where another framework would: it keeps and patches its elements between drawings instead of describing new
ones, it attaches one native listener per element and event instead of using a synthetic event system, it redraws in
a microtask so several store writes cost one drawing, and it answers `origin` from the DOM during dispatch. It passes
all 17 scenarios with no skips. Removing either of its two renderer obligations (applying `takeFocusRequest()` after a
redraw, answering `origin` while the handler runs) fails a scenario, so the kit does notice when a renderer forgets them.

### What this does and does not prove

It proves that `sorting()`, `selection()` and `pagination()`, the table model and the allowlist work through two
renderers with different event and lifecycle models and through none. It does **not** prove that a Vue, Angular or
Svelte adapter is a small job, for three reasons worth knowing before you start one:

- **Each framework's own reconciler sits between you and the DOM.** The plain-DOM renderer controls when elements are
  created, moved and removed. In Vue or Svelte the framework decides, so focus survives a redraw only if your
  template keys rows, cells and the pager's buttons the way the description does (`node.key`). Use the key.
- **`origin` is renderer code.** The questions it answers (did the event start on a control, in this grid's own table,
  over selected text) are read from the DOM by each renderer, and the React and plain-DOM renderers each carry their
  own copy of the same selector. A renderer that answers them differently selects rows the React grid would not, and
  only `selection/row-click` notices.
- **Coverage is three add-ons.** Everything that measures, scrolls or opens an overlay is a React add-on today, so a
  non-React grid has sorting, selection and paging and none of the rest until those are migrated.

## What does not change

- Headless means headless: `@apsw/gridwright/view` and `@apsw/gridwright/conformance` import no React, no DOM and no
  framework, and `npm run check:exports` and the smoke suite verify that on the built files, in ESM and CommonJS.
- One copy of the engine and of each add-on's logic: the view entry shares chunks with the core and React entries, so an
  error thrown by the view layer is `instanceof` the `GridwrightError` you import from the core entry.
- Every visible string is in `labels` or an add-on's `messages`, for a neutral add-on as for a React one.
- Security has no exceptions: the allowlist is the only door. If you need a tag, attribute or event it does not name, the
  answer is a change to the allowlist, reviewed once, not a renderer that passes it through.
