# API surface contract: variable row heights

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional option on `virtualRows()` and one new exported core function and type. No existing
signature changes, no default changes, and `rowHeight` keeps its type and meaning. A grid that does not pass
`rowHeightOf` renders identically (AC-02), which is the property that separates a minor from a major here.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `GridVirtualOptions.rememberedRows` | `apsw-gridwright/react` | `readonly rememberedRows?: number` |
| `GridVirtualOptions.rowHeightOf` | `apsw-gridwright/react` | `readonly rowHeightOf?: (row: TRow, absoluteIndex: number) => number \| undefined` |
| `createRowOffsets` | `apsw-gridwright` | `(base: number) => RowOffsets` |
| `RowOffsets` | `apsw-gridwright` | see below |
| `computeVirtualWindow` input `offsets` | `apsw-gridwright` | `readonly offsets?: RowOffsets` on `VirtualWindowInput` (additive, optional) |
| `ScrollOffsetInput.offsets` | `apsw-gridwright` | `readonly offsets?: RowOffsets` (additive, optional) |

`GridVirtualOptions` is generic over the row type once it gains a function of a row. It is `GridVirtualOptions<TRow = unknown>`;
the default keeps every existing `GridVirtualOptions` reference valid.

```ts
/** A sparse record of the rows whose height is not the base height. */
export interface RowOffsets {
    /** The height every row has unless set otherwise. */
    readonly base: number;
    /** Records a row's height. A height equal to `base` removes the record. */
    set(index: number, height: number): void;
    /** Forgets every recorded height. */
    clear(): void;
    /** Drops recorded heights farthest from `anchor` until at most `max` remain. */
    trim(anchor: number, max: number): void;
    /** The height of one row. */
    heightOf(index: number): number;
    /** The distance from the top to the start of a row: the sum of the heights before it. O(log n) in recorded rows. */
    offsetOf(index: number): number;
    /** The row at a distance from the top. O(log n) in recorded rows. */
    indexAt(offset: number, count: number): number;
    /** The height of `count` rows in total. */
    totalHeight(count: number): number;
}
```

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridVirtualOptions` | non-generic interface | `GridVirtualOptions<TRow = unknown>` with one optional member | none: the default type parameter keeps existing uses valid |
| `VirtualWindowInput` | five members | the same plus optional `offsets` | none; absent means today's arithmetic |
| `ScrollOffsetInput` | four members | the same plus optional `offsets` | none; absent means today's arithmetic |
| `virtualRows` | `(options?: GridVirtualOptions) => GridAddon<TRow>` | `(options?: GridVirtualOptions<TRow>) => GridAddon<TRow>` | none for callers; inference now types `rowHeightOf`'s row |
| `useVirtualScroll().scrollToIndex` | uses a fixed `rowHeight` | uses the recorded offsets when present | none visible without `rowHeightOf` |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `rowHeightOf` | n/a | `undefined`: every row takes the base height |
| `rememberedRows` | n/a | `100_000` custom heights kept; `Infinity` for no cap |

Nothing else changes. In particular the base height order (density, then `rowHeight`, then `40`) and `overscan`
(6) are the same.

## Type entry points

- [ ] `RowOffsets` and `createRowOffsets` are exported from the core entry, so the core stays usable without React
- [ ] `GridVirtualOptions<TRow>` is exported from the React entry as it is today
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
- [ ] `npm run test:smoke` imports `createRowOffsets` through the package specifier and confirms React did not leak into the core bundle
