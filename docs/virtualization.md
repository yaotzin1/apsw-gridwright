# Virtualization and windowing

Two different problems wear the same word. Rendering a hundred thousand `<tr>` elements is a
rendering problem. Holding ten million row objects is a memory problem. This page covers both, and
they are switched on separately because they solve different things.

| You have | You need |
| :--- | :--- |
| A large array already in memory | `virtual` |
| An endpoint that pages, and a reader who would rather scroll | `virtual` |
| More rows than you want in memory, behind an API | `virtual` and `createWindowedDataSource` |
| A page of rows at a time, and a reader who navigates by page | Neither. Pagination is fine |

## Rendering a window

```tsx
<Gridwright columns={columns} data={rows} virtual />
```

`virtual` accepts `true` for the defaults, or an object:

| Option | Default | Means |
| :--- | :--- | :--- |
| `rowHeight` | `40` | Fixed height in pixels. Must match `--gw-row-height` |
| `height` | `420` | Height of the scrolling area |
| `overscan` | `6` | Rows rendered above and below the viewport |

The rows outside the window are not rendered. Their height is carried by two spacer `<tr>` rows, one
above and one below, so the element stays a real `<table role="grid">` with real rows. Absolutely
positioning rows over a container would be easier to write and would throw away column alignment and
every grid semantic a screen reader depends on.

`aria-rowcount` is the whole result set and `aria-rowindex` is the true position of each row, because
the row a screen reader is reading is row four million, not row four of what happens to be mounted.

Virtualization replaces the pagination footer. A scrollbar over the whole result set is already the
navigation, and page controls underneath it would be a second one that disagrees with it.

### The row height contract

The arithmetic is deliberate: no per-row measurement, no `ResizeObserver` per row, no DOM reads
while scrolling. That buys the speed, and it costs one thing, stated rather than hidden: a row
taller than `rowHeight` overflows its slot. If you change `--gw-row-height`, pass the same number.

Variable row heights need a measuring virtualizer, which is a different piece of work and is not in
this release.

## Holding a window

Rendering a window does nothing about memory. Ten million rows in an array is roughly a gigabyte and
several seconds of sorting, all of it before any DOM exists. The fix is to stop holding them:

```tsx
import { createWindowedDataSource } from 'apsw-gridwright';

const source = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 12,
    fetchRange: async ({ offset, limit, query, signal }) => {
        const response = await fetch(`/api/people?offset=${offset}&limit=${limit}`, { signal });
        const body = await response.json();
        return { rows: body.data, totalRows: body.total };
    },
});

<Gridwright columns={columns} dataSource={source} virtual />;
```

The source is asked for ranges, never for a table. It keeps the blocks covering the current window
plus a few neighbours, and evicts the least recently used, furthest first, so a scroll that reverses
direction still finds what it just left behind. The browser holds `blockSize * maxBlocks` rows
whether the result set has ten thousand rows or ten million.

`totalRows` is required rather than optional. It is the scrollbar's height, and a grid that does not
know the total cannot draw one.

### What the source declares

`paginate` is always `true`: the source answers with exactly the window asked for, so the pagination
stage must not slice it again. `sort`, `filter` and `search` default to `true` as well, since your
endpoint is the only thing that can apply them across rows nobody has fetched. Every cached block is
dropped when the sort, the filters or the search change, because a block describes positions in a
result set that no longer exists.

### After a mutation

```tsx
<Gridwright
    columns={columns}
    dataSource={source}
    virtual
    onCellEdit={async (rowId, columnId, value) => {
        await api.save(rowId, columnId, value);
        source.invalidate();
    }}
/>
```

`invalidate()` drops every block and notifies the grid, which asks for the current window again by
itself. Do not also call `refresh()`: that is a second fetch racing the first for the same rows.

Every block goes, not just the edited row's, because every block was built from the table that just
changed. A fetch already in flight when you call `invalidate()` will not put its rows back into the
cleared cache.

### Over an endpoint that pages

`virtual` needs no windowed source. Point it at any paginating source and the scrollbar replaces
the page controls: as the window moves, the grid asks for the page the rows on screen belong to.

```tsx
<Gridwright columns={columns} dataSource={restSource} pageSize={100} virtual />
```

`pageSize` stops being a page anyone turns and becomes how many rows one request brings, so it is
usually worth raising. The rows of a page that is still loading show as skeletons rather than as
the previous page drawn in the wrong place: an ordinary source does not say where its rows start,
so until they settle their positions are not known.

### Rows that have not arrived

A row inside the viewport whose block is still loading renders as a skeleton row, marked
`aria-busy`. Replace it with `renderSkeleton`:

```tsx
<Gridwright ... renderSkeleton={(absoluteIndex) => <Placeholder index={absoluteIndex} />} />
```

Where the held rows start is published in `state.meta[WINDOW_OFFSET_META]` rather than derived from
the query, because while a new window loads the previous rows are still on screen and the query has
already moved on. The two would disagree, and the rows would be drawn at the wrong positions.

A source that publishes nothing gets the query instead, and its rows are placed only once they have
settled. Publishing the offset is therefore worth doing in any source that answers ranges: it is
the difference between keeping the previous rows visible during a fetch and showing skeletons.

## The browser's height limit

A browser will not make an element arbitrarily tall. Chrome stops at 2^24 pixels and Firefox not far
above it, silently, with no error and no exception. At forty pixels a row that is about 419,000
rows, so a spacer tall enough for ten million rows does not exist.

Past that height the grid stops treating scroll position as a pixel offset and starts treating it as
a ratio over the whole result set. `useVirtualRows` reports this as `scaled`, and the consequences
are exactly two:

- One pixel of scrollbar covers more than one row, so the smallest possible drag skips a few. At ten
  million rows and a fifteen-million-pixel area that is under one row per pixel; at a billion rows it
  would be sixty.
- `scrollToIndex` lands close to the row asked for rather than exactly on it, close enough that the
  row is on screen.

Everything else keeps working in row numbers, including `aria-rowindex`.

## Composing

Windowing is not a mode. It stacks with everything else:

```tsx
<Gridwright
    columns={columns}
    data={folders}
    tree={{ getRowId: (row) => row.id, getChildren: (row) => row.children }}
    virtual
    rowActions={rowActions}
    onCellEdit={commit}
/>
```

A virtualized tree virtualizes the *visible* nodes, which is what the tree stage already produces:
collapsing a node removes its subtree from the count, and the scrollbar shortens.

## Composing by hand

The component's arrangement is not privileged. The same body is exported:

```tsx
const scrollRef = useRef<HTMLDivElement>(null);

<GridwrightProvider instance={grid}>
    <GridTable scrollRef={scrollRef} maxHeight={480}>
        <GridHeader />
        <GridVirtualBody containerRef={scrollRef} rowHeight={40} />
    </GridTable>
</GridwrightProvider>;
```

`useVirtualRows` is exported too, for a body of your own: give it a count, a row height and the
scroll container, and it answers with `startIndex`, `endIndex`, the two paddings, `firstVisibleIndex`,
`scaled` and `scrollToIndex`.

## Without React

The arithmetic is not a React concern, so it does not live in the adapter. `computeVirtualWindow` is
in the core, takes four numbers and returns the window:

```ts
import { computeVirtualWindow } from 'apsw-gridwright';

scroller.addEventListener('scroll', () => {
    const view = computeVirtualWindow({
        count: state.totalRows,
        rowHeight: 40,
        scrollTop: scroller.scrollTop,
        viewportHeight: scroller.clientHeight,
    });

    // Two spacer rows and the slice between them, which is the whole technique.
    tbody.innerHTML =
        spacer(view.paddingTop) +
        rowsBetween(view.startIndex, view.endIndex) +
        spacer(view.paddingBottom);

    api.setPage(Math.floor(view.firstVisibleIndex / pageSize));
});
```

`scrollOffsetForIndex` is its inverse, for scrolling to a row. The React hook is these two functions
plus a scroll listener coalesced to one read per frame, and the vanilla playground page uses them
directly over ten million rows.

## Limits worth knowing before you commit

- Fixed row height, as above.
- Selection across a windowed source is by row id, and ids for rows nobody has fetched are not known,
  so "select all" cannot mean all ten million. Select what is loaded, or hold the selection as a
  query on your side.
- Client-side sorting cannot work over rows the browser does not have. A windowed source declares
  `sort: true` for that reason: the endpoint sorts, or nothing does.
