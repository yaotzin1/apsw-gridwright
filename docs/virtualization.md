# Virtualization and windowing

Two different problems wear the same word. Rendering a hundred thousand `<tr>` elements is a
rendering problem. Holding ten million row objects is a memory problem. This page covers both, and
they are switched on separately because they solve different things.

| You have | You need |
| :--- | :--- |
| A large array already in memory | `virtualRows()` |
| An endpoint that pages, and a reader who would rather scroll | `virtualRows()` |
| More rows than you want in memory, behind an API | `virtualRows()` and `createWindowedDataSource` |
| A page of rows at a time, and a reader who navigates by page | Neither. Pagination is fine |

## Rendering a window

```tsx
import { Gridwright, virtualRows } from 'apsw-gridwright/react';

<Gridwright columns={columns} data={rows} addons={[virtualRows()]} />
```

`virtualRows` is an add-on (see [add-ons](addons.md)). Call it with no argument for the defaults, or
with an object:

| Option | Default | Means |
| :--- | :--- | :--- |
| `rowHeight` | `40` | Fixed height in pixels. Must match `--gw-row-height` |
| `height` | `420` | Height of the scrolling area |
| `overscan` | `6` | Rows rendered above and below the viewport |
| `renderSkeleton` | a skeleton bar | The content of a row whose data has not arrived, below |

The rows outside the window are not rendered. Their height is carried by two spacer `<tr>` rows, one
above and one below, so the element stays a real `<table role="grid">` with real rows. Absolutely
positioning rows over a container would be easier to write and would throw away column alignment and
every grid semantic a screen reader depends on.

`aria-rowcount` is the whole result set and `aria-rowindex` is the true position of each row, because
the row a screen reader is reading is row four million, not row four of what happens to be mounted.

Every row in the window is rendered through the same `GridRowView` as a paged row, so nothing is
lost by windowing: a tree's `aria-level` and `aria-expanded`, the selection checkbox, and the row and
cell attributes other add-ons contribute are all on it.

The add-on owns the table's body and its scrolling wrapper, and it suppresses the pagination add-on
(`gridwright:pagination`). A scrollbar over the whole result set is already the navigation, and page
controls underneath it would be a second one that disagrees with it. The engine still pages
underneath; only the controls go. It also declares `navigation: 'window'`, so the live region
announces the total number of rows rather than a range the reader never paged to.

### The row height contract

The arithmetic is deliberate: no per-row measurement, no `ResizeObserver` per row, no DOM reads
while scrolling. That buys the speed, and it costs one thing, stated rather than hidden: a row
taller than `rowHeight` overflows its slot. If you change `--gw-row-height`, pass the same number.

Variable row heights need a measuring virtualizer, which is a different piece of work and is not in
this release.

### Scrolling from inside the grid

A component rendered inside the grid, in the toolbar or in an add-on of your own, reaches the
scroller with `useVirtualScroll()`:

```tsx
import { useVirtualScroll } from 'apsw-gridwright/react';

function BackToTop() {
    const scroll = useVirtualScroll();
    if (!scroll) return null;          // the grid does not list virtualRows()
    return <button type="button" onClick={() => scroll.scrollToIndex(0)}>Back to top</button>;
}
```

It returns `{ containerRef, scrollToIndex(index) }`, or `null` when the grid is not windowed, so one
component can sit in either kind of grid. `index` is the position in the whole result set.

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

<Gridwright columns={columns} dataSource={source} addons={[virtualRows()]} />;
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
    addons={[
        virtualRows(),
        inlineEditing({
            commit: async (rowId, columnId, value) => {
                await api.save(rowId, columnId, value);
                source.invalidate();
            },
        }),
    ]}
/>
```

`invalidate()` drops every block and notifies the grid, which asks for the current window again by
itself. Do not also call `refresh()`: that is a second fetch racing the first for the same rows.

Every block goes, not just the edited row's, because every block was built from the table that just
changed. A fetch already in flight when you call `invalidate()` will not put its rows back into the
cleared cache.

### Over an endpoint that pages

`virtualRows()` needs no windowed source. Point it at any paginating source and the scrollbar
replaces the page controls: as the window moves, the grid asks for the page the rows on screen
belong to.

```tsx
<Gridwright columns={columns} dataSource={restSource} pageSize={100} addons={[virtualRows()]} />
```

`pageSize` stops being a page anyone turns and becomes how many rows one request brings, so it is
usually worth raising. The rows of a page that is still loading show as skeletons rather than as
the previous page drawn in the wrong place: an ordinary source does not say where its rows start,
so until they settle their positions are not known.

### Rows that have not arrived

A row inside the viewport whose block is still loading renders as a skeleton row, marked
`aria-busy`. Replace its content with the add-on's `renderSkeleton` option:

```tsx
virtualRows({ renderSkeleton: (absoluteIndex) => <Placeholder index={absoluteIndex} /> })
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

Windowing is not a mode. It is one add-on among the others:

```tsx
<Gridwright
    columns={columns}
    data={folders}
    addons={[
        treeData({ getRowId: (row) => row.id, getChildren: (row) => row.children }),
        virtualRows(),
        rowActions({ items }),
        inlineEditing({ commit }),
    ]}
/>
```

A virtualized tree virtualizes the *visible* nodes, which is what the tree stage already produces:
collapsing a node removes its subtree from the count, and the scrollbar shortens.

[`columnLayout()`](column-layout.md) composes with it unchanged — both bodies render their rows
through `GridRowView`, so widths, pinning and order reach a windowed row exactly as they reach a
paged one. The one difference is auto-fit: double-clicking a resize handle measures the cells that
are mounted, which here is the rows on screen rather than every row in the result. Fitting a column
to rows nobody has scrolled to would mean fetching them, and a double-click is not a request for a
download.

Adding or removing `virtualRows()` changes the add-on list, which remounts the grid: the scroll
position, the page and the selection start again. Changing its options does not.

## Composing by hand

The component's arrangement is not privileged. List the add-on on the hook and use the ordinary
parts; the add-on supplies the scrolling wrapper through `GridTable` and the windowed body through
`GridBody`:

```tsx
const grid = useGridwright({ columns, data, addons: [virtualRows({ rowHeight: 40, height: 480 })] });

<GridwrightProvider instance={grid}>
    <GridRoot>                            {/* provides the scroll context useVirtualScroll reads */}
        <GridTable aria-label="People">
            <GridHeader />
            <GridBody />                  {/* renders GridVirtualBody */}
        </GridTable>
    </GridRoot>
</GridwrightProvider>;
```

`GridVirtualBody` is exported for a body placed by hand without the add-on. It takes
`containerRef` (the scrolling element, which you then size and make scrollable yourself),
`rowHeight`, `overscan` and `renderSkeleton`.

`useVirtualRows` is exported too, for a body of your own: give it a count, a row height and the
scroll container, and it answers with `startIndex`, `endIndex`, the two paddings, `firstVisibleIndex`,
`scaled` and `scrollToIndex`. Render each row with `GridRowView` or `GridRowOrCustom` so the other
add-ons keep applying.

## What the engine does on its own

The arithmetic is not a React concern, so it does not live in the adapter, which is what makes it
testable without a renderer. `computeVirtualWindow` is in the core, takes four numbers and returns
the window:

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
    renderBody(view.paddingTop, view.startIndex, view.endIndex, view.paddingBottom);

    api.setPage(Math.floor(view.firstVisibleIndex / pageSize));
});
```

`scrollOffsetForIndex` is its inverse, for scrolling to a row. The React hook is these two functions
plus a scroll listener coalesced to one read per frame. Both are core and neither imports React,
which is what makes the window arithmetic testable without a renderer.

## Limits worth knowing before you commit

- Fixed row height, as above.
- Selection across a windowed source is by row id, and ids for rows nobody has fetched are not known,
  so "select all" cannot mean all ten million. Select what is loaded, or hold the selection as a
  query on your side.
- Client-side sorting cannot work over rows the browser does not have. A windowed source declares
  `sort: true` for that reason: the endpoint sorts, or nothing does.
