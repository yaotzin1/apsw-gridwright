# API surface contract: unified options, virtualization and windowing

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: everything added is an optional property or a new export. No signature changes, no
removals, no changed defaults. `TreeGridwright` keeps its props and its behaviour; only its
implementation moved behind `<Gridwright tree={...} />`, which is not observable from a consumer's
type-checker or their rendered output.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `createWindowedDataSource` | `.` | `<TRow>(options: WindowedDataSourceOptions<TRow>) => WindowedDataSource<TRow>` |
| `WINDOW_OFFSET_META` | `.` | `'gridwright:windowOffset'` |
| `computeVirtualWindow` | `.` | `(input: VirtualWindowInput) => VirtualWindow`, the window arithmetic with no DOM |
| `scrollOffsetForIndex` | `.` | `(input: ScrollOffsetInput) => number`, its inverse |
| `MAX_SCROLL_HEIGHT` | `.` | the tallest scrolling area a browser will render |
| `RangeRequest` | `.` | `{ offset, limit, query, signal }` |
| `RangeResult` | `.` | `{ rows, totalRows }` |
| `WindowedDataSource` | `.` | `DataSource<TRow> & { invalidate(): void; readonly cachedBlockCount: number }` |
| `WindowedDataSourceOptions` | `.` | `{ fetchRange, blockSize?, maxBlocks?, capabilities?, kind? }` |
| `GridVirtualBody` | `./react` | `<TRow>(props: GridVirtualBodyProps<TRow>) => ReactNode` |
| `useVirtualRows` | `./react` | `(options: VirtualRowsOptions) => VirtualRows` |
| `GridCell` | `./react` | the body's own cell, so a custom body renders identical cells |
| `GridTreeOptions` | `./react` | the object `tree` takes |
| `GridVirtualOptions` | `./react` | the object `virtual` takes |
| `rowDataOf` | `./react` | `<TRow>(row: GridRow<TRow> \| GridRow<TreeNode<TRow>>) => TRow`, so one row handler works on both |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridwrightProps` | no `tree`, `virtual`, `rowActions`, `rowActionsTrigger`, `onCellEdit`, `renderSkeleton` | all six, all optional | minor |
| `GridwrightColumn` | no `icon` | `icon?: (context: CellContext) => ReactNode` | minor |
| `GridTableProps` | no `scrollRef`, no `maxHeight` | both optional | minor |
| `TreeGridwright` | own implementation | alias over `<Gridwright tree={...} />`, plus `controllerRef` | minor |

`GridTreeOptions.controllerRef` is the only member with no equivalent before this feature: the
controller was previously reachable only by calling `useTreeGridwright` yourself.

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

Nothing is deprecated. `TreeGridwright`, `BubbleMenu`, `InlineEditProvider` and `editableColumns`
all remain first-class: the options are a default arrangement of them, not a replacement, and a
consumer composing a layout by hand needs every one.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `virtual.rowHeight` | — | `40`, matching `--gw-row-height` |
| `virtual.overscan` | — | `6` |
| `virtual.height` | — | `420` |
| `blockSize` | — | `200` |
| `maxBlocks` | — | `12`, so about 2,400 rows resident |

No existing default changed. A grid that passes none of the new options renders exactly as it did in
0.3.0, which is the property that makes this a minor.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
