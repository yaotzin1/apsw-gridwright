# The view in the URL

`urlSync()` keeps the grid's search, sort, filters and page in the address bar. A reader who reloads
gets the same view back, a link sent to a colleague opens on the same rows, and Back and Forward step
through the pages the reader visited.

```tsx
import { Gridwright, columnFilters, search, urlSync } from 'apsw-gridwright/react';

<Gridwright columns={columns} dataSource={tickets} addons={[search(), columnFilters(), urlSync()]} />
```

```
/tickets?q=printer&sort=priority:desc,opened:asc&f=status:in:open:pending,score:gt:50&page=3
```

It is an add-on like any other: nothing on `<Gridwright />` changes, and it works the same over an
array and over a paginating server, because what it writes is the query and the query is the same
object either way.

## What is in the URL

| Parameter | Holds | Example |
| :--- | :--- | :--- |
| `q` | the search text | `q=north%20wing` |
| `sort` | `column:asc` or `column:desc`, in priority order | `sort=priority:desc,opened:asc` |
| `f` | `column:condition:value`, one per filter | `f=status:in:open:pending,score:between:10:50` |
| `page` | the page, counted from 1 | `page=3` |
| `size` | rows per page | `size=50` |

**Only what differs from the grid's own starting view is written.** A grid with no `initialQuery`
and nobody touching it has a clean URL. A grid that starts sorted and was unsorted by the reader
writes `sort=`, so that a reload does not sort it again.

**Values keep their type.** A value is written as it is, unless it would read back as something
else: `score:gt:50` is the number 50, `code:eq:"50"` is the text "50", `flag:eq:true` is the boolean.
A server therefore receives exactly the value a click would have sent, and a `select` column finds
its ticked choices again. A filter whose value is not text, a number, a boolean or `null` (an object,
a `Date` set by code) cannot be written, and is left out rather than written as something it is not.

`:` and `,` inside a value are escaped, so a value can hold either.

## Opening a link

The link's query becomes the grid's initial query before the engine is created, so opening a link
fetches **once**, straight into the linked view, with no default view flashing first.

Every parameter is checked against the grid's columns. A sort on a column that no longer exists or is
not sortable, a filter on a column that is not filterable, an unknown condition, a page that is not a
positive number: each is dropped, the rest applies, and the URL is rewritten to what was actually
applied, so the link the reader copies next is the view they see. Nothing in a URL can make the grid
throw.

`size` is capped by `maxPageSize`, which defaults to the larger of 100 and the grid's own page size.
A link is written by whoever sent it, and without a cap `size=1000000` would render a million rows or
ask your server for them.

A linked page past the end is corrected by the grid once the total is known, and that correction
replaces the URL rather than adding an entry, so Back never leads back into it.

## Back and Forward

A page change adds a history entry; every other change replaces the current one, after 300 ms of
quiet, so typing a search does not leave a history entry per keystroke. When a filter change also
moves the reader back to the first page, it is the filter that changed, and nothing is added.

```tsx
urlSync({ push: ['page', 'sort'] })   // sorting adds an entry too
urlSync({ debounceMs: 0 })            // write every change at once
```

Back applies the whole entry: a facet the entry does not name returns to the grid's starting value,
because that is what its absence meant when the entry was written. Applying it does not write
anything back.

Under `virtualRows()` the page follows the scroll position, so it is neither written nor pushed.

## Two grids on one page

Give each a prefix:

```tsx
<Gridwright ... addons={[urlSync({ prefix: 'open_' })]} />
<Gridwright ... addons={[urlSync({ prefix: 'closed_' })]} />
// ?open_sort=priority:desc&closed_page=4
```

Parameters that are not the grid's own are never touched, and neither is the hash.

## Only some of it

```tsx
urlSync({ facets: ['search', 'filters'] })   // keep sort and page out of the URL
```

## With a router

By default the add-on reads `location`, writes with `history.pushState` and `replaceState`, and
listens to `popstate`. When a router owns the URL, hand it the router instead, so there is one thing
changing the address bar:

```tsx
import { useSearchParams } from 'react-router-dom';
import { urlSync, type UrlSyncAdapter } from 'apsw-gridwright/react';

function Tickets() {
    const [params, setParams] = useSearchParams();
    const adapter: UrlSyncAdapter = {
        getParams: () => params,
        setParams: (next, mode) => setParams(next, { replace: mode === 'replace' }),
    };
    return <Gridwright columns={columns} dataSource={tickets} addons={[urlSync({ adapter })]} />;
}
```

```tsx
// Next.js (app router)
const params = useSearchParams();
const router = useRouter();
const pathname = usePathname();
const adapter: UrlSyncAdapter = {
    getParams: () => new URLSearchParams(params.toString()),
    setParams: (next, mode) => {
        const url = `${pathname}?${formatSearchParams(next)}`;
        if (mode === 'push') router.push(url, { scroll: false });
        else router.replace(url, { scroll: false });
    },
};
```

`getParams` is read on every render of the grid. A router that delivers new parameters by
re-rendering, as both of these do, needs nothing else. `subscribe(onChange)` is for a URL that changes
without re-rendering the grid; the default adapter uses it for `popstate`.

`setParams` receives every parameter, the grid's and everyone else's, so the adapter writes the whole
query string. `formatSearchParams(params)` gives it the readable form, with `:` and `,` left as they
are; `params.toString()` works too and encodes them.

**Server rendering.** The default adapter reads no parameters on the server, so the server renders the
starting view and the client the linked one. A router adapter that reads the request's parameters, as
Next.js's `useSearchParams` does, renders the same view on both sides.

## Without the add-on

The codec is exported on its own, for a link built somewhere else — an email, a dashboard tile, a
server redirect — or a query read from one:

```ts
import { formatSearchParams, parseGridQuery, serializeGridQuery } from 'apsw-gridwright/react';

const link = `/tickets?${formatSearchParams(serializeGridQuery({
    search: '',
    sort: [{ columnId: 'priority', direction: 'desc' }],
    filters: [{ columnId: 'status', operator: 'in', value: ['open'] }],
    pagination: { pageIndex: 0, pageSize: 25 },
}))}`;
// /tickets?sort=priority:desc&f=status:in:open

const query = parseGridQuery(new URLSearchParams(location.search), columns);
```

`parseGridQuery` validates exactly as the add-on does and returns only the parts the parameters name.
Pass `baseline`, the grid's own starting query, to both functions when the grid has one.

## Options

See [the API reference](api.md#urlsyncoptions) for every option and its default.

## What it does not do

- **Column layout, expanded rows, a tree's open nodes.** They are the reader's arrangement rather
  than the query, and their add-ons already hand you that state through `onChange` to keep wherever
  you like. See [storing what the reader changes](persistence.md#the-readers-own-layout).
- **Remove its parameters when the grid unmounts.** The URL still describes the view the reader left;
  changing route is the application's decision.
- **Write a filter it cannot read back.** See "Values keep their type" above.
