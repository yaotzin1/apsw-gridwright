# The playground

Two pages that drive the **built** package from `dist/`, not a demo reimplementation. What you
click is what a consumer installs.

```bash
npm run example
```

That builds the package and serves it on <http://localhost:5173>.

| Page | What it shows |
| :--- | :--- |
| `/` | The headless core with no framework at all, plus live capability controls |
| `/examples/playground/react.html` | The published `<Gridwright />` component |
| `/examples/playground/tree.html` | Tree data, the bubble menu, inline editing |

A server is required. Browsers refuse ES module imports over `file://`, so opening either file
from disk cannot work. Both pages check the protocol on load and say so plainly rather than
failing with a module URL that sends you looking in the wrong place.
`scripts/serve-example.mjs` has no dependencies.

## What to try first

**Uncheck `sort` under "the server resolves".** The mock API then genuinely answers unsorted, so
the ordering you see afterwards is the in-memory pipeline working on the 25 rows that arrived. The
badges and the sentence beneath them change with it. This is the whole design in one interaction:
the component above the seam did not change, and neither did the columns.

**Turn off "send a total".** The range switches from `1-25 of 5,000` to `1-25 of many`, because a
paginating source that sends no count leaves the grid knowing only that another page exists. It
says so rather than computing a number from one page.

**Set latency to 1.5s and type quickly in the search box.** The event log shows one
`fetch:success` per settled query and never one for a superseded search. The engine drops stale
responses by sequence number before any listener runs.

**Click "fail the next request".** The rows stay on screen with a banner over them, because
`keepPreviousData` is on by default: losing the reader's place buys nothing. Retry recovers.

**Switch to the local array.** Five thousand rows, no network, and no loading state at all, because
an array resolves synchronously and the engine notices before publishing one.

**Open the tree page and switch the shape to "Flat, with two parents".** `Shared.pdf` appears
under both folders. Expand one of them and the other stays shut, because they are two placements of
one row. Rename it in one place and both change, because there is one row. The counters underneath
say it plainly: eight nodes for six distinct rows.

**Then switch to "Lazy children".** Children arrive on first expand. Team B always fails, and the
node stays open with the message so it can be retried; expanding a folder a second time does not
fetch again, because loading is keyed on the row.

**Hover a row on the tree page.** The bubble menu is a real menu of buttons: add a child, add a
sibling, move to root, delete. Tab to a row and it opens too, because a hover-only menu is
decoration some people cannot use. Every action goes through the tree controller, so each one is
optimistic and reverts if the commit is refused. Tick "refuse every edit" to watch that happen.

**Click a name, a kind or a size on the tree page.** Enter saves, Escape cancels, clicking away
saves. Editing is opt-in per column, which is why Owner and Size behave differently from each other.

**Switch the language on the React page.** Five bundled packs. Select rows and watch the count:
Polish needs `zaznaczono 1 wiersz`, `3 wiersze` and `5 wierszy`, and the category comes from
`Intl.PluralRules` rather than from anything the page wrote. Number grouping changes with it.

**Toggle the "active only" plugin.** It declares the `filter` capability, so it runs when the
client filters and is skipped when the server does. Same plugin, both data paths.

## The mock API

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

`GET /api/fail-next` arms a single 503 with a message, so the error path is reachable on demand.

## The React page and the network

`dist/react/index.js` imports `react` and `react/jsx-runtime` as bare specifiers, because React is
a peer dependency and is deliberately not bundled. The React page supplies them with an import map
pointing at a CDN, which is the only part of either page that needs network access. The vanilla
page needs none.

Neither page uses JSX, because neither has a build step. `cell` renderers there are written with
`React.createElement`, which is exactly what a compiled application produces anyway.

## Not shipped

`examples/` is excluded from the published tarball. These pages exist for the repository, and
`examples/react-remote/App.tsx` is type-checked and linted with the rest of the source so the API
it shows cannot drift.
