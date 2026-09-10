# Data model: unified options, virtualization and windowing

## Types added

```ts
/** Turns the grid into a tree. Every other option keeps working on top of it. */
interface GridTreeOptions<TRow> {
    getRowId: (row: TRow) => RowId;
    getChildren?: (row: TRow) => readonly TRow[] | undefined;
    getParentIds?: (row: TRow) => readonly RowId[] | RowId | null | undefined;
    hasChildren?: (row: TRow) => boolean;
    loadChildren?: (context: LoadChildrenContext<TRow>) => Promise<readonly TRow[]>;
    maxDepth?: number;
    defaultExpandedDepth?: number;
    onCommit?: (change: TreeChange<TRow>) => Promise<void> | void;
    onExpandedChange?: (nodeIds: readonly string[]) => void;
    treeColumnId?: string;
    keepAncestorsOfMatches?: boolean;
    /** Receives the controller once, and `null` on unmount. Its identity is stable. */
    controllerRef?: (controller: TreeController<TRow> | null) => void;
}

/** Renders only the rows on screen. Works over a flat grid and over a tree alike. */
interface GridVirtualOptions {
    rowHeight?: number;   // default 40, must match --gw-row-height
    overscan?: number;    // default 6
    height?: number | string;   // default 420
}

/** A range of the result set, which is all a windowed source is ever asked for. */
interface RangeRequest {
    offset: number;
    limit: number;
    /** Sort, filters and search. Pagination is expressed by offset and limit instead. */
    query: GridQuery;
    signal: AbortSignal;
}

interface RangeResult<TRow> {
    rows: readonly TRow[];
    /** Required, not optional: it is the scrollbar's height. */
    totalRows: number;
}

interface WindowedDataSource<TRow> extends DataSource<TRow> {
    invalidate(): void;
    readonly cachedBlockCount: number;
}

/** What the virtualizer answers with. */
interface VirtualRows {
    startIndex: number;
    endIndex: number;
    paddingTop: number;
    paddingBottom: number;
    firstVisibleIndex: number;
    visibleCount: number;
    /** True when there are more rows than the browser will give pixels to. */
    scaled: boolean;
    scrollToIndex(index: number): void;
}
```

## Types changed

**Before**

```ts
interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    instance?: GridwrightInstance<TRow>;
    className?: string;
    // ...
}

interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?: (context: CellContext<TRow, TValue>) => ReactNode;
    headerCell?: (context: HeaderContext<TRow>) => ReactNode;
    edit?: ColumnEditOptions<TRow>;
}
```

**After**

```ts
interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    instance?: GridwrightInstance<TRow>;
    tree?: GridTreeOptions<TRow>;
    virtual?: boolean | GridVirtualOptions;
    rowActions?: readonly BubbleMenuItem<TRow>[];
    rowActionsTrigger?: BubbleMenuTrigger;
    onCellEdit?: CommitEdit;
    renderSkeleton?: (absoluteIndex: number) => ReactNode;
    className?: string;
    // ...
}

interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?: (context: CellContext<TRow, TValue>) => ReactNode;
    headerCell?: (context: HeaderContext<TRow>) => ReactNode;
    edit?: ColumnEditOptions<TRow>;
    /** A per-row glyph, rendered before the text and hidden from assistive technology. */
    icon?: (context: CellContext<TRow, TValue>) => ReactNode;
}
```

Every addition is optional, which is what keeps this a minor.

## State shape

No new field on `GridQuery`. One new key in `GridState.meta`, written by the source rather than the
engine:

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| `meta['gridwright:windowOffset']` | `number` | absent | `createWindowedDataSource`, per result |

It is published rather than derived because while a new window loads, the previous rows are still on
screen and the query has already moved on. A reader computing the offset from
`pageIndex * pageSize` would place those rows at positions they do not occupy.

Virtualization holds no grid state at all. Scroll position lives in the DOM, and the two numbers
derived from it (`scrollTop`, `clientHeight`) live in the hook's own React state. Putting them in
`GridState` would publish a render to every consumer of the grid on every scroll frame.

## The block cache

Not state, and not serialisable: an implementation detail of the source, described here because its
shape is what makes the memory claim true.

| Piece | Shape | Why |
| :--- | :--- | :--- |
| `blocks` | `Map<number, { rows, usedAt }>` | keyed by block index, so a window is two lookups |
| `inFlight` | `Map<number, { promise, signal }>` | the signal is kept so a load belonging to an aborted request is never joined |
| `queryKey` | `JSON.stringify([sort, filters, search])` | a change renames every position, so every block is dropped |
| `generation` | `number` | bumped on every reset, so a fetch crossing an `invalidate()` cannot repopulate the cache it was cleared from |

## Serialisation

`RangeRequest` carries `offset` and `limit` as numbers and the query as the same object every other
source receives, so nothing new has to survive JSON. `WINDOW_OFFSET_META` is a number in `meta`,
which is already `Record<string, unknown>`.
