# Research: expandable rows (row detail panels)

## The question that decides the feature

Where does an extra row come from? Everything else follows from the answer, because the add-on is
small and the seam is public.

### Option A — `renderRow`, the slot that already exists

**How it works.** `rowDetail()` contributes `renderRow`, returning a fragment of the default row
plus its panel row. `customRowOf` already takes the first add-on's non-undefined result.

**Rejected because.** `renderRow` is first-wins and replaces. `rowDetail()` would own every row in
the grid, and would have to render the default row itself — either by calling the exported
`GridRowView`, which couples it to the shell's row rendering forever, or by reimplementing it, which
is the kind of duplication `GridBody`'s own comment warns about ("two would drift, and the one that
drifts is the one fewer people look at"). Worse, it takes the slot: any add-on that legitimately
wants a row of its own kind — a group header, which `specs/grouping-and-aggregation` needs — loses
to whichever of the two is listed first. Two features fighting over one slot for two unrelated
purposes is the signal that the slot is the wrong one.

### Option B — own the whole `<tbody>` through `body`

**How it works.** `rowDetail()` becomes a body owner and renders rows and panels itself.

**Rejected because.** `body` has exactly one owner, and `virtualRows()` is already it. A grid could
then have panels or windowing but never both — and it would be the *resolution* that refuses it,
opaquely, rather than a named error that explains why. It also makes a trivially small feature into
a second body implementation, which is the same duplication as Option A with more of it.

### Option C — render the panel inside the row's cells

**How it works.** No extra row. `cellAttributes` or a wrapping cell renderer draws the panel inside
the first `<td>`, absolutely positioned or overflowing.

**Rejected because.** Content overflowing a table cell is not laid out by the table: it does not push
the following rows down, it overlaps them. Making it push means taking the cell out of the table's
layout, which takes the column alignment and the grid semantics with it — the same trade-off
`GridVirtualBody` refuses when it uses spacer rows instead of absolute positioning. A nested table
inside a `<td>` bounded by one column's width is also not the feature anyone asked for.

### Option D — a new slot, `rowAfter`, on the public contract ✅

**How it works.** `AddonContribution` gains
`rowAfter?: (row, grid) => ReactNode | undefined`. `GridRowOrCustom` renders the row, then every
add-on's non-empty result, keyed by add-on name. `rowDetail()` is the first consumer and gets no
privileges.

**Chosen because.** It is what the architecture rule already prescribes: a feature that needs a seam
that does not exist gets the seam added for everyone. It is roughly ten lines in the shell, it
composes (two add-ons may both add a row), it leaves `renderRow` and `body` free for the features
that genuinely need to own them, and it applies to the paged body and the windowed body at once
because both call `GridRowOrCustom`. `specs/grouping-and-aggregation`'s subtotal row is the obvious
second consumer.

---

## Virtualization: measured, guessed, or refused

`useVirtualRows` is deliberately pure arithmetic — "no measurement of individual rows, no
ResizeObserver per row, no DOM reads in the hot path" — and its own comment already states the
consequence: "a row taller than `rowHeight` overflows its slot. Variable heights need a measured
virtualizer, which is a different piece of work."

| Route | What it costs |
| :--- | :--- |
| **Measure every row** | A `ResizeObserver` per mounted row, a height cache keyed by row id, an offset index rebuilt on every change. It is a rewrite of the virtualizer and it is a different feature with its own spec. |
| **A fixed `detailHeight` option** | Cheap arithmetic, and it lies: the consumer's panel is whatever height their content is, and a nested grid's height changes when its own page does. A scrollbar that is wrong by a few hundred pixels is worse than no windowing. |
| **Render the panel outside the scroll arithmetic** | A floating panel over the grid. That is a dialog with extra steps, and §4 refuses to build one. |
| **Refuse the combination, by name** ✅ | `AddonSetupContext.addons` lists every add-on in the grid, so `rowDetail()` can see `virtualRows()` and throw a `GridwrightError` naming both and the reason. The contract already throws for a missing `requires`, so a configuration error at setup is the established shape. |

A grid needing both is a grid needing a measured virtualizer, and that is the spec to write next,
not a flag to add here.

---

## The ARIA question, and what other grids do

The problem is stated in spec.md §6: a `role="grid"` owns rows, and this package computes
`aria-rowcount` and `aria-rowindex` from the **result set**, not from what is mounted
(`src/react/a11y/rows.ts`).

Surveying the field: the widely shipped grids that have detail rows either (a) emit a real
`role="row"` and leave `aria-rowcount` alone, so the count and the indices disagree, or (b) emit no
ARIA row numbering at all, so the question does not arise. Neither is available here — (a) is the
exact defect `rowNumbering` was written to fix, and (b) would be a regression.

The `aria-rowindex` specification permits non-contiguous indices when rows are hidden, which is the
case the attribute was designed for. It does not offer a way to say "this element sits between two
rows and is not one", and no assistive technology behaviour depends on one existing.

So the choice is between a structural liberty and a numeric lie, and this repository has a rule
about numeric lies. `role="presentation"` on the `<tr>` and the `<td>`, with a named
`role="region"` inside, takes the liberty: the panel is reachable, named after its row, and pointed
at by the toggle's `aria-controls`, while every row of the result set keeps a correct index.
Recorded as a known gap with the condition that would justify revisiting it.

The disclosure pattern itself is unambiguous and is followed exactly: a real button, `aria-expanded`,
`aria-controls` only while the target exists, focus left on the button.

---

## Nested grids: what actually breaks

Rendering a `<Gridwright />` inside a `<td>` is valid HTML and works. Three things go wrong, and
two of them are this package's fault.

1. **Keyboard events bubble into the outer grid.** `GridTable` puts `onKeyDown` on the outer
   `<table>`; a keydown inside the inner table bubbles to it, and every `tableKeyDown` contributor
   on the outer grid — `cellNavigation()` in `specs/cell-navigation-and-clipboard` — acts on arrow
   keys the reader pressed in the inner one. **This is a defect in the shell that this feature
   surfaces**, and the fix belongs here: ignore an event whose closest `<table>` is not
   `event.currentTarget`. `columnLayout()` already reaches the table with `closest('table')` for a
   related reason, so the technique is established in the codebase.
2. **`useGridwrightContext()` inside the panel resolves to the inner grid.** Ordinary React context
   behaviour, surprising the first time. Documentation, not code: a panel that wants the outer grid
   captures it from `render`'s `grid` argument, which is handed to it before the inner provider
   exists.
3. **Two live regions and two announcers.** Each grid has its own; the inner one announces its own
   row range. Correct, and nothing to fix — but worth one line in the docs, because a reader who
   opens six panels has six live regions on the page.

Pinned columns paint over the panel, because pinned cells are `position: sticky` and the panel is
not. Giving the panel's inner region `position: sticky; left: 0` keeps its content at the reader's
left edge with no measurement at all, which is the cheapest answer available and does not require
the table wrapper's ref — the ref `GridTable` keeps only one of, and `virtualRows()` already holds.

---

## What the tree already answers

`treeData()` is the closest prior art in this repository and settles three questions without
discussion:

- **A controller in `useState`, options in a ref, `controllerRef` fired from an effect.** The
  pattern is proven here and avoids rebuilding on every render when a callback is defined inline in
  JSX.
- **`rowDataOf` for unwrapping.** The tree turns rows into nodes, and the decision was deliberately
  kept out of every column definition. A detail renderer gets the same courtesy: `render` receives
  `data` already unwrapped.
- **Two different `aria-expanded` values on one row are fine** when they are on two different
  elements with two different accessible names. The tree's is on the `<tr>` and is about children;
  the toggle's is on a button and is about a panel.

What it does *not* answer is the Strict Mode teardown dance, because this add-on has no controller
to destroy: its whole model is a `Set` in React state, so a double mount costs nothing.
