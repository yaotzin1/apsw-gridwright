# The playground

Two pages that drive the **built** package from `dist/`, not a demo reimplementation. What you
click is what a consumer installs, through the React component, which is the supported surface.

```bash
npm run example
```

That builds the package and serves it on <http://localhost:5173>.

| Page | What it shows |
| :--- | :--- |
| `/` | The published `<Gridwright />` over a paginating API: capability controls, row actions, inline editing, windowing and a tree, all as switches |
| `/examples/playground/tree.html` | Every option at once, over ten million rows: tree, windowing, row actions, inline editing, icons |

## Where the code is

Each page is markup plus one module under `js/`, not a thousand lines of JavaScript wrapped in
HTML. That split is what lets the pages share anything and lets ESLint see any of it:

| File | Holds |
| :--- | :--- |
| `js/react-page.js` | the published component over the mock API, with the capability controls |
| `js/features-page.js` | every option at once |
| `js/shared/load-package.js` | loads React and the built package, and says which one failed |


A server is required. Browsers refuse ES module imports over `file://`, so opening either file
from disk cannot work. Each page checks the protocol on load and says so plainly rather than
failing with a module URL that sends you looking in the wrong place.
`scripts/serve-example.mjs` has no dependencies.

## What to try first

**Uncheck `sort` under "the server resolves".** The mock API then genuinely answers unsorted, so
the ordering you see afterwards is the in-memory pipeline working on the 25 rows that arrived. The
badges beneath the controls change with it, one per facet, naming who did the work. This is the
whole design in one interaction:
the component above the seam did not change, and neither did the columns.

**Turn off "send a total".** The range switches from `1-25 of 5,000` to `1-25 of many`, because a
paginating source that sends no count leaves the grid knowing only that another page exists. It
says so rather than computing a number from one page.

**Set latency to 1.5s and type quickly in the search box.** The rows that land are the ones for
the term you stopped on, never an earlier one arriving late. The engine drops superseded responses
by sequence number before any listener runs.

**Click "fail the next request".** The rows stay on screen with a banner over them, because
`keepPreviousData` is on by default: losing the reader's place buys nothing. Retry recovers.

**Change something in a tree and reload the page.** The features page posts every change to
`/api/files`, which stores the tree as an adjacency list: one row per node naming its parent and its
position. It is under "Stored on the server". Renaming a file, adding one and deleting one are
three POSTs and three statements.

**Tick "tree".** The same component, over a hierarchy instead of the paginating
API, with the same menu, the same editors and the same icons. Hover a folder and the menu offers
"Add person"; hover a person and it does not, because `hidden` is asked per row.

**Tick "virtual".** The pagination footer is replaced by a scrollbar over all
five thousand rows, and the fetched page follows the scroll. There is no windowed source here: this
is the same mock REST endpoint, paging as it always did.

**Then tick "inline edit" and change a name.** The edit is written to the mock table and the source
is invalidated, so the row that comes back from the next fetch carries it. Editing over a remote
source that keeps refetching is the case that usually goes wrong.


**Open the features page and turn the switches off one at a time.** Tree, windowing, row actions,
inline editing and icons are five props on one `<Gridwright />`. Turning the tree off leaves the
menu and the editors working on a flat list; turning windowing on leaves the tree working,
indentation and all. Nothing on the page swaps components to do it.

**Switch the data to "10,000,000 rows, windowed".** The source is asked for a block of two hundred
rows, the cache keeps eight of them, and the body renders about forty. The panel underneath counts
what the browser is actually holding: four hundred rows out of ten million, and the number does not
grow as you scroll. Drag the scrollbar to the very bottom and row 10,000,000 is there. Rows you
outrun are skeletons waiting for their block, which is what a 140ms mock delay is there to show.

**Edit a name in that mode.** The commit writes to the mock table, drops every cached block and
asks again, because every block was built from the table that just changed. Watch "block requests"
move.

**Switch to "20,000 rows in memory".** The same `virtual` switch, with a plain array underneath and
no windowed source at all. Rendering a window and holding a window are different problems.

**Switch the shape to "Flat, with two parents".** `Shared.pdf` appears
under both folders. Expand one of them and the other stays shut, because they are two placements of
one row. Rename it in one place and both change, because there is one row. The counters underneath
say it plainly: eight nodes for six distinct rows.

**Then switch to "Lazy children".** Children arrive on first expand. Team B always fails, and the
node stays open with the message so it can be retried; expanding a folder a second time does not
fetch again, because loading is keyed on the row.

**Click a row on either page.** The menu opens on a left click, pinned until you click
elsewhere or press Escape; hovering previews it and a right-click pins it too. Clicking an editable
cell opens its editor instead, because that click belongs to the cell. On the features page the menu
appears beside the pointer and stays inside the grid when you click near the right edge. It is a real menu of
buttons: add a child, add a sibling, inspect, delete. Tab to a row and it opens too, because a hover-only menu is
decoration some people cannot use. Every action goes through the tree controller, so each one is
optimistic and reverts if the commit is refused. Tick "refuse every edit" to watch that happen.

**Click a name, a kind or a size on the features page.** Enter saves, Escape cancels, clicking away
saves. Editing is opt-in per column, which is why Owner and Size behave differently from each other.

**Switch the language.** Five bundled packs. Select rows and watch the count:
Polish needs `zaznaczono 1 wiersz`, `3 wiersze` and `5 wierszy`, and the category comes from
`Intl.PluralRules` rather than from anything the page wrote. Number grouping changes with it.

**Toggle the "active only" plugin.** It declares the `filter` capability, so it runs when the
client filters and is skipped when the server does. Same plugin, both data paths.

## The mock API

`GET /api/people/range?offset=&limit=` answers a range of a ten-million-row table, generated on
demand rather than held. It is what the features page's windowed source talks to, so the claim about
memory is about a real network boundary rather than a function pretending to be one.

`GET /api/people` honours exactly the capabilities the page says the source declares, passed as
`serverDoes`. A demo that quietly sorted server-side while claiming not to would prove nothing, so
this one cannot cheat on the point it exists to make.

| Parameter | Meaning |
| :--- | :--- |
| `page`, `pageSize` | one-based page and size |
| `sort` | `column:asc,other:desc` |
| `search` | the raw term |
| `filters` | JSON array of `{ columnId, operator, value }` |
| `serverDoes` | which facets this response actually applied |
| `latency` | artificial delay in milliseconds |
| `withTotal` | `false` to omit the count |
| `offset`, `limit` | on `/api/people/range` only: the window wanted |

`GET /api/files` returns the stored tree as an adjacency list and `POST /api/files` applies one
change to it: four statements, one per change type, which is the whole server side of a tree grid.
`POST /api/people/edit` stores one edited cell and refuses an empty value with a 422.

`GET /api/fail-next` arms a single 503 with a message, so the error path is reachable on demand.

## The pages and the network

`dist/react/index.js` imports `react` and `react/jsx-runtime` as bare specifiers, because React is
a peer dependency and is deliberately not bundled. Both pages supply them with an import map
pointing at a CDN, which is the part of each page that needs network access.

Neither page uses JSX, because neither has a build step. `cell` renderers there are written with
`React.createElement`, which is exactly what a compiled application produces anyway.

## Not shipped

`examples/` is excluded from the published tarball. These pages exist for the repository, and
`examples/react-remote/App.tsx` is type-checked and linted with the rest of the source so the API
it shows cannot drift.
