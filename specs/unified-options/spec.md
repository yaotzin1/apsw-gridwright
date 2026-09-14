# Specification: unified options, virtualization and windowing

> **Status**: Implemented
> **Stage entry**: 8
> **Semver impact**: minor (confirmed in api-surface.md)

---

## 1. The consumer problem

Two problems, and the second is what caused the first.

**Capabilities had become components.** A tree was `<TreeGridwright />`, row actions were
`<BubbleMenu />` composed by hand, editing was `editableColumns()` plus `<InlineEditProvider>`
composed by hand. Each worked. None of them worked *together* without the consumer reassembling the
component's own arrangement, and one of them, the tree, was a parallel implementation that could
never gain anything added to `<Gridwright />`. The consumer had to know which component to reach for
before knowing what they wanted, and the wrong first choice was expensive.

**A large result set had no answer.** Every row the source returned was rendered. Twenty thousand
rows meant twenty thousand `<tr>` elements. Ten million rows meant roughly a gigabyte of objects and
several seconds of sorting before any DOM existed. The honest advice was "paginate", which is not
advice a consumer with a scrolling requirement can take.

## 2. User stories

- **US-01.** As a developer with a tree, I want row actions and inline editing on it without
  reassembling the component, because they are not tree features.
- **US-02.** As a developer with a flat grid, I want a row menu with one prop.
- **US-03.** As a developer with 100,000 rows already in memory, I want the grid to render only what
  is on screen.
- **US-04.** As a developer with ten million rows behind an API, I want the browser to hold a window
  and nothing more.
- **US-05.** As a person reading a grid, I want to scroll to the end of the result set and have the
  last row be the last row.
- **US-06.** As a person using a screen reader, I want to be told which row of how many I am on,
  truthfully, whatever is mounted.
- **US-07.** As a developer, I want an icon beside a value without writing a `cell` renderer that
  re-implements the default one.

## 3. Acceptance criteria

- [x] AC-01 `tree`, `virtual`, `rowActions`, `onCellEdit` and column `icon` are options on
      `<Gridwright />`, and any combination of them renders.
- [x] AC-02 A tree with `virtual` on expands, collapses and indents exactly as without it.
- [x] AC-03 `virtual` renders a window: 5,000 rows produce fewer than 80 rendered rows.
- [x] AC-04 `virtual` replaces the pagination footer rather than showing two navigations.
- [x] AC-05 `aria-rowcount` is the result set and `aria-rowindex` is the true position.
- [x] AC-06 A windowed source reports ten million rows while holding at most `maxBlocks` blocks.
- [x] AC-07 Only the blocks covering the window are fetched.
- [x] AC-08 Every block is dropped when the sort, filters or search change.
- [x] AC-09 The last row of ten million is reachable by scrolling, despite the browser's element
      height limit.
- [x] AC-10 A column without `edit` stays read-only when `onCellEdit` is set.
- [x] AC-11 `tree.controllerRef` receives the controller once, and `null` on unmount.
- [x] AC-12 `<Gridwright instance={useTreeGridwright(...)} />` renders a tree, not a flat list of
      nodes.
- [x] AC-13 Two overlapping window fetches leave the surviving one with its rows.

## 4. Non-goals

- **Variable row heights under virtualization.** The arithmetic is what makes it fast: no per-row
  measurement, no `ResizeObserver` per row, no DOM reads while scrolling. A measuring virtualizer is
  a different piece of work with a different cost, and pretending one hook can be both produces a
  slow one.
- **Horizontal virtualization.** Column counts that would need it are rare, and the cost is column
  alignment, which is most of what a grid is for.
- **Select-all across rows nobody has fetched.** Selection is by row id, and the ids of unfetched
  rows are not known. A grid that reported ten million selected ids it had never seen would be
  inventing them.
- **Client-side sorting over a windowed source.** It cannot work over rows the browser does not
  have. The source declares `sort: true` so the endpoint owns it.
- **A `mode` prop.** Options are independent switches, not a mode enumeration. The moment they are
  a mode, two of them cannot be on at once, which is the failure this feature exists to undo.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | `virtual` renders a window over the pipeline's own output. The pipeline still filters, searches, sorts and paginates in memory; `pageSize` becomes the size of the data window the body moves, not a page the reader navigates. |
| everything (server) | Unchanged. `virtual` is a rendering decision and does not alter the query. |
| pagination only | Unchanged; the pipeline still applies the rest to the window received. |
| a windowed source | Declares `paginate: true` always, so the pagination stage never slices the window twice. Sort, filter and search default to `true`, because nothing local can apply them to rows that were never fetched. |

The tree stage is unaffected: it flattens whatever rows arrived, and virtualization windows the
visible nodes it produced.

## 6. Accessibility and interface copy

- `aria-rowcount` on the grid is the whole result set. `aria-rowindex` on each row is its true
  one-based position, not its position among the mounted rows.
- A row whose data has not arrived is a real row marked `aria-busy="true"`, so it is announced as
  loading rather than as an empty row.
- The table stays a `<table role="grid">` with real `<tr>` children; spacing is carried by two
  spacer rows. Absolute positioning was rejected for exactly this reason.
- `rowActions` renders the existing `BubbleMenu`, which opens on focus as well as hover and is a
  `role="menu"` of real buttons.
- The skeleton animation is disabled under `prefers-reduced-motion`, as is the menu's entry
  animation.
- No new strings. Nothing here renders text of its own, so nothing here needs translating.

## 7. Clarifications

**Does switching `tree` on and off preserve state?** No, and it should not. A tree and a flat list
are different grids with different row identities. The component renders a different owner
component, so React remounts. Every other option changes in place.

**What does `pageSize` mean under `virtual`?** The size of the data window the body moves, not a
page anyone navigates. The pagination footer is hidden because a scrollbar over the whole result set
is already the navigation and two disagreeing ones is worse than either.

**Which `rowId` does `onCellEdit` receive on a tree?** The row's own id, shared by every placement,
not the placement's node id. Editing a row under one parent edits it under all of them, because it
is one row.

**Why does the component not wrap columns when given an `instance`?** Because in a tree the editor
belongs *inside* the tree cell and in a flat grid it wraps the cell, and only the code that built
the instance knows which order it used. Wrapping it again from outside would produce an edit trigger
where the indentation and the toggle should be.

**What happens above the browser's height limit?** The scroll position becomes a ratio over the
result set rather than a pixel offset. This is a real trade, so it is reported as `scaled` and
written down: one pixel of scrollbar covers more than one row, and `scrollToIndex` lands close
rather than exact. The alternative is that nine and a half million rows are unreachable, silently.

---

## 8. Delivery as a plugin

> **Superseded in part by `specs/addon-architecture`:** the options this spec put on `<Gridwright />`
> are now add-ons. `tree` is `treeData(options)`; `virtual` is `virtualRows({ rowHeight, overscan,
> height, renderSkeleton })`; `rowActions` is `rowActions({ items, trigger, placement })`;
> `onCellEdit` is `inlineEditing({ commit })`. Column `icon` stays a column field rendered by the
> shell's cell. `<TreeGridwright />` and `useTreeGridwright` (AC-12) were removed; `instance=` over
> `useGridwright({ addons: [treeData(...)] })` replaces it. The §7 answer "switching `tree` remounts,
> every other option changes in place" is now general: switching any add-on on or off changes the
> list of add-on names, which is the grid's key, so it remounts. The "No new strings" line no longer
> holds: the row menu's accessible name is the `gridwright:row-actions` add-on's `menu` message.

**Engine.** `createWindowedDataSource` (`src/data/windowed.ts`) is a data source, not a plugin: it
declares `paginate: true` and defaults `sort`, `filter` and `search` to `true`, so the pipeline's
capability rules already do the right thing. `src/core/virtual.ts` holds the pure arithmetic
(`scrollOffsetForIndex` and the scaled range above the browser's height limit). The tree's engine
side is described in `specs/tree-data`.

**React add-ons.** None of them is in `coreAddons()`.

| Add-on | Name | Slots |
| :--- | :--- | :--- |
| `virtualRows()` | `gridwright:virtual` | `body` (one owner: `GridVirtualBody`, rows through `GridRowView`), `tableWrapper` (scroll ref, height), `provide` (scroll context for `useVirtualScroll()`), `suppresses: ['gridwright:pagination']`, `navigation: 'window'` (the live region says the total, not a range) |
| `rowActions()` | `gridwright:row-actions` | `overlay` (`BubbleMenu`, which finds its row from the markup every body renders, `.gw-row[data-row-id]`), `messages` |
| `inlineEditing()` | `gridwright:inline-editing` | `configure` (wraps columns with `editableColumns`), `columnSignature` (`edit`, `icon`), `provide` (`InlineEditProvider`), `before: ['gridwright:tree']`, column option `edit` by augmentation |
| `treeData()` | `gridwright:tree` | see `specs/tree-data` |

AC-01 ("any combination renders") is now the add-on contract's guarantee: every add-on contributes to
named slots, and the only exclusions are explicit (`body` has one owner; `virtualRows()` suppresses
pagination's rendering while the pagination plugin keeps cutting the data window). §4's "options are
independent switches, not a mode" is exactly what the add-on list is.

**What cannot be an add-on.** The windowed data source and the virtual arithmetic are not React
concerns, so they stay in `src/data` and `src/core`. The scroll container has to be the table's own
wrapper, which is why `tableWrapper` exists as a slot rather than the add-on rendering a wrapper of
its own around the shell.
