# API surface contract: column virtualization

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: everything is additive. A new add-on, new core functions, new optional fields on
`AddonContribution` and `AddonSetupContext`, a new optional prop on `GridCell`, and new exported helpers.
No default changes. A grid that does not list `virtualColumns()` renders the same markup as before: no
`aria-colcount`, no `aria-colindex`, no gap cells (tested).

Two behaviour changes are corrections, not new defaults, and are listed so review can disagree:

- `GridTable` now sets **every** contributed `tableWrapper` ref instead of only the last. Anything that
  worked before still works; an add-on that was silently starved of the element now gets it.
- Under fixed table layout (`columnLayout()` or `virtualColumns()`), a header's content no longer widens
  its column past the declared width (`contain: inline-size` in the stylesheet). The declared width was
  always the contract; Chrome broke it for narrow columns with long labels.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `columnOffsets` | `apsw-gridwright` | `(widths: readonly number[], start?: number) => readonly number[]` |
| `computeColumnWindow` | `apsw-gridwright` | `(input: ColumnWindowInput) => ColumnWindow` |
| `scrollLeftForColumn` | `apsw-gridwright` | `(input: ScrollLeftForColumnInput) => number` |
| `ColumnWindowInput` | `apsw-gridwright` | `{ offsets: readonly number[]; scrollLeft: number; viewportWidth: number; overscan?: number }` |
| `ColumnWindow` | `apsw-gridwright` | `{ startIndex; endIndex; firstVisibleIndex; endVisibleIndex }` (numbers) |
| `ScrollLeftForColumnInput` | `apsw-gridwright` | `{ offsets; index; scrollLeft; viewportWidth; insetStart?; insetEnd? }` |
| `virtualColumns` | `apsw-gridwright/react` | `<TRow>(options?: GridVirtualColumnsOptions) => GridAddon<TRow>` |
| `GridVirtualColumnsOptions` | `apsw-gridwright/react` | `{ defaultWidth?: number; extraColumnWidth?: number; overscan?: number }` |
| `VIRTUAL_COLUMNS_ADDON` | `apsw-gridwright/react` | `'gridwright:virtual-columns'` |
| `useVirtualColumnScroll` | `apsw-gridwright/react` | `() => VirtualColumnScroll \| null` |
| `VirtualColumnScroll` | `apsw-gridwright/react` | `{ scrollToColumn(columnId: string): void }` |
| `columnWindowOf` | `apsw-gridwright/react` | `<TRow>(grid: GridContext<TRow>) => ColumnWindowPlan<TRow> \| null` |
| `renderedColumnsOf` | `apsw-gridwright/react` | `<TRow>(grid: GridContext<TRow>) => readonly ColumnWindowEntry<TRow>[]` |
| `GridColumnGap` | `apsw-gridwright/react` | component, props `GridColumnGapProps` |
| `GridColumnGapProps` | `apsw-gridwright/react` | `{ entry: ColumnWindowEntry gap; header?: boolean }` |
| `ColumnGeometry` | `apsw-gridwright/react` | `{ widthOf(columnId): number; pinOf(columnId): 'left' \| 'right' \| null }` |
| `ColumnWindowEntry` | `apsw-gridwright/react` | `{ kind: 'column'; column; index } \| { kind: 'gap'; key; width; columns }` |
| `ColumnWindowPlan` | `apsw-gridwright/react` | `{ entries: readonly ColumnWindowEntry[]; columnCount: number }` |
| `GridCellProps` | `apsw-gridwright/react` | `{ column; row; ariaColIndex?: number }` (the props `GridCell` already took, plus one) |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `AddonContribution` | — | adds optional `columnGeometry?: ColumnGeometry` and `columnWindow?: (grid) => ColumnWindowPlan \| null` | minor: optional fields |
| `AddonSetupContext` | — | adds optional `columnGeometry?: ColumnGeometry` | minor |
| `GridCell` | props `{ column, row }` | adds optional `ariaColIndex` | minor |
| `columnCountOf` | visible data columns + extra columns | the cell positions the header renders + extra columns; identical without a column window | minor: same value when no window |
| `columnLayout()` contribution | — | publishes `columnGeometry` | minor |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `virtualColumns({ defaultWidth })` | — | `160` |
| `virtualColumns({ extraColumnWidth })` | — | `48` |
| `virtualColumns({ overscan })` | — | `2` |

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types (`npm run check:exports`, pending)
- [ ] `npm run check:exports` passes (pending: npm unreachable where this was written)
