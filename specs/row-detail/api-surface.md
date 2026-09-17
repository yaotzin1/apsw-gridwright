# API surface contract: expandable rows (row detail panels)

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning:

- `rowAfter` is a new **optional** field on `AddonContribution`. The interface is produced by
  add-ons and consumed by the shell; an optional field added to it breaks neither direction. Every
  existing add-on keeps compiling and keeps behaving identically, because a contribution without
  `rowAfter` renders exactly what it rendered before.
- Everything else is a new export. Nothing is renamed, removed, or given a different signature.
- **No default changes.** A grid that does not list `rowDetail()` renders the same markup it renders
  today: `GridRowOrCustom` returns a fragment instead of a single element, which is invisible in the
  DOM and in every existing test's queries.
- The throw for `virtualRows()` + `rowDetail()` is not a breaking change: no released version
  accepts that combination, because `rowDetail()` does not exist.

The `GridwrightError` thrown for that combination is a runtime error in a configuration that has
never worked, so it is classified with the feature that introduces it rather than as a change to
`virtualRows()`.

## Exports added

Entry is `apsw-gridwright/react` for every row. Nothing is added to the core entry: a ReactNode is
not something the headless engine may name.

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `rowDetail` | `react` | `<TRow>(options: RowDetailOptions<TRow>) => GridAddon<TRow>` |
| `ROW_DETAIL_ADDON` | `react` | `'gridwright:row-detail'` |
| `rowDetailMessages` | `react` | `AddonMessages` |
| `RowDetailProvider` | `react` | `(props: RowDetailProviderProps) => ReactNode` |
| `useRowDetail` | `react` | `() => RowDetailController` — throws a `GridwrightError` outside a grid listing the add-on |
| `useOptionalRowDetail` | `react` | `() => RowDetailController \| null` |
| `GridDetailToggle` | `react` | `(props: GridDetailToggleProps) => ReactNode` |
| `GridRowDetail` | `react` | `(props: GridRowDetailProps) => ReactNode` — the presentational `<tr>`, for a body composed by hand |
| `columnCountOf` | `react` | `<TRow>(grid: GridContext<TRow>) => number` — moved from internal to public; no change to its behaviour |
| `RowDetailOptions` | `react` (type) | see data-model.md |
| `RowDetailController` | `react` (type) | see data-model.md |
| `RowDetailContext` | `react` (type) | `{ row, data, grid, close }` |
| `RowDetailProviderProps` | `react` (type) | `{ controller, rowLabel?, children }` (see Amendments) |
| `GridDetailToggleProps` | `react` (type) | `{ rowId, className? }` |
| `GridRowDetailProps` | `react` (type) | `{ rowId, children, className? }` |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `AddonContribution<TRow>` | no slot renders a row after a row | adds optional `rowAfter?: (row: GridRow<TRow>, grid: GridContext<TRow>) => ReactNode \| undefined` | **minor** — optional field, both directions safe |
| `GridRowOrCustom` | returns one `<tr>` (or a custom row) | returns that, followed by every add-on's `rowAfter` result | **minor** — the props and the rendered markup for a grid with no `rowAfter` contributor are unchanged |

`GridRowView`, `GridBody`, `GridVirtualBody`, `GridTable`, `GridApi`, `GridState`, `GridQuery`,
`ColumnDef` and `GridwrightProps` are untouched.

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes. Every default below belongs to an option that does not exist yet.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `rowDetail({ toggle })` | — | `'start'` |
| `rowDetail({ single })` | — | `false` |
| `rowDetail({ persistAcrossPages })` | — | `true` |
| `rowDetail({ hasDetail })` | — | every row has detail |
| `rowDetail({ rowLabel })` | — | the text of the first visible column |
| `rowDetail({ initialExpanded })` | — | `[]` |

## Behaviour contracts that are not types

Stated here because an implementation can satisfy every signature above and still be wrong.

1. **`rowAfter` is asked for every rendered row, in add-on order, and every non-empty result
   renders.** Not first-wins. Keyed by add-on name.
2. **`rowAfter` runs for a `renderRow` row too.**
3. **A throwing `rowAfter` renders nothing and reports itself** through `callSlot`, like every other
   slot.
4. **`onExpandedChange` never fires for `initialExpanded`**, and fires after the change has been
   committed and rendered.
5. **`canToggle` narrows and never widens.** A change the add-on already refuses stays refused
   whatever it returns.
6. **`expandAll()` covers the rows the grid is currently holding**, and no API reports an expanded
   count across the result set.
7. **`render` is called only for expanded rows**, and a collapsed panel is unmounted.
8. **Listing `virtualRows()` with `rowDetail()` throws a `GridwrightError`** naming both add-ons and
   the reason, detected from `AddonSetupContext.addons`.
9. **`GridTable`'s `onKeyDown` ignores an event whose closest `<table>` is not its own**, so a
   nested grid inside a panel does not drive the outer grid's `tableKeyDown` add-ons.

## Amendments during implementation

Stage 6 does not edit this file; it stops and returns to stage 3. This is that return, recorded
rather than absorbed.

**`RowDetailProviderProps` gains `rowLabel?: (rowId: RowId) => string`.** Stage 3 wrote
`{ controller, children }` and did not ask where the toggle's accessible name comes from. It cannot
come from `GridDetailToggleProps`, which is `{ rowId, className? }` so that a consumer can drop a
toggle into a cell renderer without repeating the naming rule; and it cannot be recomputed per
toggle, or a `<GridDetailToggle />` placed by hand would be named by the default rule while the
add-on's own column used the consumer's `rowLabel`. The provider is the one place both of them can
read it from. It stays optional: the provider derives the default from the grid's context, so a
consumer composing by hand passes `controller` alone and still gets named toggles.

The same context carries the panel's `id` prefix, from one `useId()` in the provider. That needed no
signature: the toggle's `aria-controls` and the region's `id` are both read from context, and two
`useId()` calls would have produced two different values.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported —
      `RowDetailOptions`, `RowDetailController`, `RowDetailContext`, `RowDetailProviderProps`,
      `GridDetailToggleProps`, `GridRowDetailProps`; `GridRow`, `GridContext`, `RowId`, `GridAddon`
      and `AddonMessages` already are
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
- [ ] `npm run test:smoke` imports `rowDetail` through `apsw-gridwright/react` and confirms the core
      entry does not carry it
