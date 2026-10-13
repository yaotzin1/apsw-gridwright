# Gridwright

[![npm version](https://img.shields.io/npm/v/apsw-gridwright)](https://www.npmjs.com/package/apsw-gridwright)
[![CI](https://github.com/yaotzin1/apsw-gridwright/actions/workflows/ci.yml/badge.svg)](https://github.com/yaotzin1/apsw-gridwright/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/npm/l/apsw-gridwright)](https://github.com/yaotzin1/apsw-gridwright/blob/main/LICENSE)

**A React data grid with real table semantics and zero runtime dependencies.** Tree data, grouping
with aggregates, Excel export and windowing to ten million rows are all in the MIT package, with no
enterprise licence to buy. Hand it an array today and a paginating API
tomorrow: swap `data` for `dataSource` and the columns and add-ons stay exactly as they were.

<a href="https://yaotzin1.github.io/apsw-gridwright/examples/playground/index.html">
  <picture>
    <source srcset="https://raw.githubusercontent.com/yaotzin1/apsw-gridwright/main/site/playground-dark.webp" media="(prefers-color-scheme: dark)">
    <img src="https://raw.githubusercontent.com/yaotzin1/apsw-gridwright/main/site/playground-light.webp" width="1108" alt="The grid in the playground: a searchable, sortable employee table with a selection column and status chips.">
  </picture>
</a>

**[Live playground](https://yaotzin1.github.io/apsw-gridwright/examples/playground/index.html)** ·
**[Docs](https://yaotzin1.github.io/apsw-gridwright/docs/getting-started.html)** ·
**[Website](https://yaotzin1.github.io/apsw-gridwright/)** ·
[Six-step quickstart](https://yaotzin1.github.io/apsw-gridwright/steps/) ·
[The full tour](docs/tour.md)

## Quick start

```bash
npm install apsw-gridwright
```

```tsx
import { Gridwright } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

export const People = () => <Gridwright columns={[{ id: 'name', header: 'Name' }]} data={people} />;
```

That is a grid with sorting, paging, an empty state and a live region for screen readers.
Add features by listing add-ons, and swap the array for a server without touching anything else:

```tsx
import { Gridwright, columnFilters, exportMenu, search } from 'apsw-gridwright/react';

<Gridwright
    columns={[{ id: 'name', header: 'Name' }, { id: 'salary', header: 'Salary', align: 'end' }]}
    data={people} // or dataSource={createRestDataSource({ url: '/api/people' })}
    addons={[search(), columnFilters(), exportMenu({ formats: ['csv', 'excel', 'print'] })]}
/>;
```

React 18 or 19 is an optional peer dependency, needed only for `apsw-gridwright/react`. Using MUI?
`apsw-gridwright-mui` takes the grid's colours, type and dark mode from your MUI theme in one prop
([details](packages/mui/README.md)).

## What's in the box

Sorting, selection and pagination are on by default. Everything else is an add-on you list in
`addons={[...]}`.

| You need | Add-on | Guide |
| :--- | :--- | :--- |
| A search box | `search()` | [Add-ons](docs/addons.md) |
| Filters per column: numbers, dates, sets of values | `columnFilters()` | [Filtering](docs/filtering.md) |
| Rows with children, lazy loading, moves with rollback | `treeData()` | [Tree data](docs/tree.md) |
| Group headers with sum, average, min, max or your own aggregate | `grouping()` | [Grouping](docs/grouping.md) |
| CSV, Excel, Markdown, print and PDF reports | `exportMenu()` | [Exporting](docs/export.md) |
| Hundreds of thousands to ten million rows | `virtualRows()` and a windowed source | [Virtualization](docs/virtualization.md) |
| Resize, reorder, pin and hide columns | `columnLayout()` | [Column layout](docs/column-layout.md) |
| Editing in place | `inlineEditing()` | [Persisting changes](docs/persistence.md) |
| A panel under a row: a nested grid, a form | `rowDetail()` | [Expandable rows](docs/row-detail.md) |
| Spreadsheet-style arrow keys and copy | `cellNavigation()` | [Accessibility](docs/accessibility.md) |
| Phones and narrow containers | `responsive()` | [Responsive](docs/responsive.md) |
| The view in the URL: reload, share, Back | `urlSync()` | [The view in the URL](docs/url-sync.md) |
| A row menu on hover, click or right-click | `rowActions()` | [Add-ons](docs/addons.md) |
| Compact, comfortable or spacious rows | `density()` | [Density](docs/density.md) |
| WCAG 2.2 AA sizing and colours where the default is not | `wcag()` | [Accessibility](docs/accessibility.md) |

Built in everywhere: a real `<table>` with `role="grid"`, one live region, translations for en, de,
es, fr and pl, dark mode, CSS custom properties for theming, TypeScript types, ESM and CommonJS.
[The full tour](docs/tour.md) walks through every one of these with code.

## Why Gridwright

- **The enterprise features are free.** Tree data, grouping with aggregates and Excel export are
  in the MIT package, not behind a licence.
- **One pipeline for local and remote data.** A data source declares which parts of the query it
  resolved (sort, filter, search, paginate), and the grid does the rest in memory. Moving from an
  array to a server is a one-line change, and an endpoint that only pages still gets sorting and
  filtering.
- **Real table semantics.** A real `<table>` with `role="grid"`, sort state on the header cell,
  row positions that count across pages, and a live region that says what changed. A
  per-criterion WCAG 2.2 report, interim and honest about the gaps, is in
  [docs/conformance.md](docs/conformance.md).
- **Small and dependency-free.** About 16 kB gzipped for the component, with no runtime
  dependencies and no install scripts.
- **Every feature is an add-on, and yours has the same reach.** There is no internal API the
  built-in add-ons use and yours cannot.
- **It never invents a number.** When a paginating API sends no total, the grid says "of many"
  rather than a count computed from one page.

## How it works

One pipeline serves local and remote data. A data source says which parts of the query it already
resolved; the pipeline does whatever is left. Nothing above the pipeline knows where the rows came
from, which is why switching sources is a one-line change.

```text
 reader: sort, filter, search, page
        |
        v
      Query
        |
        v
 data source: array, REST or your fetcher
        |   rows, plus what it resolved
        v
 pipeline: search, filter, sort, paginate (only what is left)
        |
        v
 Gridwright shell: table, rows, one live region
   ^  add-ons: sorting, filters, export, tree, editing and more
   ^  responsive(): hides columns or stacks rows by container width (view only, never the query)
```

## Size

Gridwright is about 16 kB gzipped for the component, about 24 kB with search, column filters and export.

The figures are `Gridwright` (and, for the second one, `search`, `columnFilters` and `exportMenu`)
imported from `dist/react`, bundled with esbuild with `react` external, minified, then gzipped at
level 9. Measured on 0.16.0. They are an upper bound for what a bundler adds, not a promise: your
own toolchain tree-shakes differently.

## Try it

New here? [**docs/getting-started.md**](docs/getting-started.md) ([on the site](https://yaotzin1.github.io/apsw-gridwright/docs/getting-started.html)) walks from an empty React project to
a grid over a paginating API in six steps, each one a component you can paste. Already have a
requirement? [**docs/react-playbook.md**](docs/react-playbook.md) is indexed by the job rather than
the feature, and [**docs/agent-playbook.md**](docs/agent-playbook.md) is the same rules condensed for
a coding agent. There is a runnable app beside them:

```bash
git clone https://github.com/yaotzin1/apsw-gridwright && cd apsw-gridwright
npm install
npm run example:react     # the six steps, as a real React app on :5174
npm run example:mui       # every feature in an MUI app: a switch per add-on, four tabs, dark mode, on :5175
npm run example           # the playground: every add-on, switchable, on :5173
```

The playground runs the built package against a mock API. Uncheck `sort` under "the server
resolves" and watch the work move from the server to the in-memory pipeline without the component
above it changing. See [examples/playground](examples/playground/README.md) and
[examples/react-quickstart](examples/react-quickstart/README.md).

## What it does not do

So you can rule it in or out quickly. Gridwright has no pivot tables, no built-in charts and no
selecting a range of cells. Under virtualization, rows have a fixed height. Trees do not yet support
drag-and-drop reparenting or cascading selection down a subtree. If one of these is a hard
requirement, it is better to know now.

## Documentation

Every feature in the table above has its own guide, linked there.

| Page | Covers |
| :--- | :--- |
| [The full tour](docs/tour.md) | Every feature, one section each, with the code: data sources, add-ons, tree, grouping, windowing, export, selection, errors, security |
| [Getting started](docs/getting-started.md) | Six steps from an empty React project to a grid over a paginating API |
| [React playbook](docs/react-playbook.md) | Recipes indexed by the job rather than the feature |
| [API reference](docs/api.md) | Every prop, column field and add-on option, with its type and default |
| [Add-ons](docs/addons.md) | Every built-in add-on, writing your own, slots, ordering, the attribute allowlist, strings |
| [Data sources](docs/data-sources.md) | Capabilities, totals, aborts, retries, writing your own |
| [Extensibility](docs/extensibility.md) | Every seam, and what is closed on purpose |
| [Writing a plugin](docs/plugins.md) | The rules, plus grouping, aggregation, persistence, telemetry |
| [Accessibility](docs/accessibility.md) | The keyboard and screen-reader contract, including cell navigation, and what is deliberately absent |
| [Translation](docs/i18n.md) | Catalogs, plurals, direction, add-on strings, wiring an existing i18n library |
| [Spec-driven development](docs/spec-driven-development.md) | How this repository is built |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Adapters for frameworks other than React are not planned. The core stays headless because that is
what makes the pipeline testable without a renderer and keeps the plugin and data-source contracts
honest, not because a second adapter is coming.

Changes here move through a written process, with the rules in `workflow.ai.yml` and the skill
documents under `.agents/`. A change picks a track (feature, fix, chore or release) that decides
which of eight stages it goes through. `AGENTS.md`, `GEMINI.md` and `.claude/skills/` are generated
from that one file, CI fails when they drift, and it fails when the file claims something about the
repository that is not true. The file separates what is enforced from what is guidance, and says
which is which.

`npm run verify` is the gate everything passes through: typecheck, lint, both test suites, the
build, a smoke suite against `dist/`, and a packaging audit. See
[docs/spec-driven-development.md](docs/spec-driven-development.md) for why.

## Support the project

If Gridwright saves you time, a star on GitHub is the cheapest way to help: it is how other
developers find the project. If it saved you the week it takes to build a grid that handles remote
data properly, the Sponsor button at the top of the repository takes you to the ways to fund it.

The package stays MIT and zero-dependency either way. Bug reports and locale contributions are
worth more than coffee.

## License

MIT © [yaotzin1](https://github.com/yaotzin1)
