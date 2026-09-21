# The playground

Two pages that run the **built** package from `dist/` against a mock API. What you click is what a
project gets from `npm install apsw-gridwright`, used through the React component. Every switch that
turns a feature on adds an add-on to the grid's `addons` list, and turning it off takes the add-on
out again.

```bash
npm run example        # builds the package, then serves http://localhost:5173
```

| Page | URL | Shows |
| :--- | :--- | :--- |
| Employees | <http://localhost:5173/> | One grid over a paginating REST API: server capabilities, row actions, editing, windowing, a tree, column filters, column layout and a rule that refuses one, exporting, a report template editor, and an add-on of the page's own |
| Every option at once | <http://localhost:5173/examples/playground/tree.html> | The same component over trees of every shape, 20,000 rows and ten million rows |

Every panel on both pages has a **source:** link to the file that implements it.

---

## How a page is put together

```
index.html
 ├─ ../../dist/styles.css            the grid's stylesheet      app: import 'apsw-gridwright/styles.css'
 ├─ playground.css                   the page around the grid   (not part of the package)
 ├─ <script type="importmap">        React from a CDN           app: react and react-dom from npm
 ├─ js/shared/served-check.js        explains a page opened from disk
 └─ js/employees/main.js             renders the page
      └─ app.js                      ← start here: the switches become add-ons on <Gridwright />
           ├─ columns.js             what each column shows, exports, edits and filters by
           ├─ data-source.js         the REST source, and what it tells the grid it does itself
           ├─ export-formats.js      the options for exportMenu(): built-in formats, report templates, your own
           ├─ row-actions.js         the items for rowActions()
           ├─ pay-band.js            an add-on of the page's own, written against the public exports
           ├─ column-layout.js       columnLayout() with the layout saved and a canChange rule, plus pin controls built on useColumnLayout()
           ├─ controls.js            page UI: the Controls panel
           └─ report-editor.js       page UI: the Export formats panel

tree.html
 └─ js/files/main.js
      └─ app.js                      the switches and panels
           ├─ shape-demo.js          ← start here: the grid and its add-ons over every in-memory shape
           ├─ huge-demo.js           the grid over ten million rows
           ├─ columns.js             columns, and a report over them
           └─ data.js                the data for each shape, the stored tree, the windowed source

js/shared/
 ├─ package.js                       React and the built package, for every module
 ├─ load-package.js                  loads them, and says which one failed
 └─ ui.js                            panels, switches and source links used by both pages
```

The JavaScript is plain ES modules with no build step, so an edit shows up on reload. ESLint checks
every file under `js/` (`npm run lint`).

## I want to…

| …do this | Look at | Package API | Docs |
| :--- | :--- | :--- | :--- |
| offer my own report, as Markdown and PDF | `employees/export-formats.js` → `REPORTS`, `reportFormats` | `markdownReportFormats` | [Exporting](../../docs/export.md#one-template-as-markdown-and-as-a-pdf) |
| try a template without writing code | the **Export formats** panel on the Employees page | — | — |
| add a format that is not Markdown (JSON, XLSX…) | `employees/export-formats.js` → `jsonFile` | `{ id, label, serialize }` | [A format of your own](../../docs/export.md#a-format-of-your-own) |
| have a server render the document | `employees/export-formats.js` → `serverReport` | `serialize` returning a `Blob` | same |
| change CSV, Excel or print options | `employees/export-formats.js` → `exportOptions` | `csv`, `excel`, `print` | [The formats](../../docs/export.md#the-formats) |
| export different text than the screen shows | `employees/columns.js` → `salary` | `exportValue` | [What gets exported](../../docs/export.md#what-gets-exported) |
| connect my own API | `employees/data-source.js` | `createRemoteDataSource`, `capabilities`, `fetchAll` | [Data sources](../../docs/data-sources.md) |
| switch a feature on or off | `employees/app.js` → `gridProps`, the `addons` list | `addons`, `coreAddons` | [Add-ons](../../docs/addons.md) |
| filter columns from the header | `employees/columns.js` → `filter`, `employees/app.js` → `columnFilters()` | `columnFilters()`, `filter: { type }` | [Filtering](../../docs/filtering.md) |
| add a row menu item | `employees/row-actions.js` | `rowActions({ items })` | [Tree data](../../docs/tree.md) |
| make a column editable and store the edit | `employees/columns.js` → `edit`, `employees/app.js` → `inlineEditing` | `edit`, `inlineEditing({ commit })` | [Persistence](../../docs/persistence.md) |
| show a tree | `employees/app.js` → `treeProps`, `files/shape-demo.js` → `treeOptions` | `treeData()` | [Tree data](../../docs/tree.md) |
| render a million rows | `files/data.js` → `hugeSource`, `files/huge-demo.js` | `virtualRows()`, `createWindowedDataSource` | [Virtualization](../../docs/virtualization.md) |
| write an add-on of my own | `employees/pay-band.js` | `GridAddon`, `cellAttributes`, `belowTable`, `useAddonMessages` | [Add-ons](../../docs/addons.md#writing-an-add-on) |
| keep the view in the URL, for reloads, links and Back | `employees/app.js` → `urlSync()` | `urlSync({ prefix })` | [The view in the URL](../../docs/url-sync.md) |
| translate the grid | `employees/app.js` → `locale` | `locale`, `apsw-gridwright/locales` | [Translation](../../docs/i18n.md) |
| add a page to the playground | this README, [Adding a page](#adding-a-page) | — | — |

## From the playground to your application

Playground code is written to be copied. Four things differ, because these pages have no bundler:

| In the playground | In your application |
| :--- | :--- |
| `import { gridwright, core } from '../shared/package.js'` then `const { Gridwright } = gridwright` | `import { Gridwright } from 'apsw-gridwright/react'` (core names are re-exported there too, or `from 'apsw-gridwright'`) |
| `h(Gridwright, { columns, data, addons: [search()] })` | `<Gridwright columns={columns} data={data} addons={[search()]} />` |
| `<link href="../../dist/styles.css">` | `import 'apsw-gridwright/styles.css'` |
| `/api/people`, `/api/reports` (the mock server) | your own endpoints |

A report from the Employees page, as it looks in an application:

```tsx
import { Gridwright, exportMenu, markdownReportFormats } from 'apsw-gridwright/react';
import 'apsw-gridwright/styles.css';

const employeeCards = markdownReportFormats<Employee>({
    id: 'acme:employee-cards',
    label: 'Employee cards',
    header: (rows) => `# Employee cards\n\n${rows.length} people`,
    template: '## {name}\n\n- Department: {department}\n- Salary: {salary}',
    footer: '*Printed from the grid.*',
});

export function Employees({ rows }: { rows: Employee[] }) {
    return <Gridwright columns={columns} data={rows} addons={[exportMenu({ formats: ['csv', ...employeeCards] })]} />;
}
```

`examples/react-remote/App.tsx` is the same set of features in TypeScript and JSX, type-checked with
the package, for exactly this kind of copying. The pay band add-on is there too, typed as a
`GridAddon<Employee>`.

## Adding a page

1. Copy `index.html` to `my-page.html` and change the module at the bottom to
   `/examples/playground/js/my-page/main.js`.
2. Create `js/my-page/main.js`:

   ```js
   import { React, createRoot, h } from '../shared/package.js';
   import { App } from './app.js';

   createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(App)));
   ```

3. Create `js/my-page/app.js` exporting `App`. Import the grid from `../shared/package.js` and the
   panels from `../shared/ui.js`, and give each panel `sources: ['my-page/app.js']` so the next
   reader can find the code.
4. Open <http://localhost:5173/examples/playground/my-page.html>. No restart is needed for a new
   file; a change to `scripts/serve-example.mjs` does need one.

---

## What to try

**The server does less, the grid does more.** Untick `sort` under "The server resolves" and the mock
API genuinely answers unsorted; the grid sorts the rows that arrived, and the badge says
`pipeline: sort`. Untick `paginate` and the server returns everything while the grid pages it. The
component above did not change.

**No total, no invented total.** Untick "sends a total" and the range becomes `1-25 of many`.

**Out-of-order responses.** Set latency to 1.5s and type quickly in the search box. The rows that
land are for the term you stopped on.

**A failed refresh.** Click "fail the next request". The rows stay, with a banner saying they could
not be updated, and Retry recovers.

**A report template.** Tick "export". In **Export formats**, pick a template or edit one, then open
the grid's Export menu: the report is there as Markdown and as PDF. `{salary}` writes `62000`, because
the salary column's `exportValue` says so, while the grid shows `$62,000`. The panel prints the
`markdownReportFormats` call your application would make.

**Which rows are exported.** The Export menu asks first: all matching rows, this page, or the rows you
ticked. Untick "can export everything" and "All matching rows" is off, with the reason.

**Column filters.** Tick "column filters" and filter Salary between 130,000 and 135,000: 270 of 5,000,
filtered by the server. Untick `filter` while `paginate` stays ticked and the grid can only filter the
25 rows the server sent, so a narrow filter can find nothing on them.

**Switching an add-on off.** Tick "column filters", filter a column, move to page two, then untick
it. The grid remounts without the add-on, because the list of add-on names is the grid's identity:
the filter buttons, the dialog and "Clear filters" are gone, and the grid is back on page one.

**An add-on of your own.** Tick "pay band (this page's own add-on)". Salaries above $130,000 are
tinted, with a tooltip, and a legend appears under the table. `employees/pay-band.js` does it with a
`cellAttributes` slot and a `belowTable` slot, the same contract the built-in add-ons use. Switch to
Polski or Deutsch and the legend follows, from the add-on's own catalog.

**Editing over a remote source.** Tick "inline edit" and change a name. The edit goes to the mock
table and the source is invalidated, so the row that comes back carries it.

**Trees, on the features page.** "Flat, with two parents" puts `Shared.pdf` under two folders: rename
it once and both change. "Lazy children" loads on expand, and Team B always fails so the retry can be
seen. "Stored on the server" survives a reload. Tick "refuse every edit" to watch a change revert.

**Ten million rows.** Switch the data to "10,000,000 rows, windowed" and watch "rows resident" stay at
a few hundred as you scroll to row 10,000,000.

**Languages.** Switch to Polski and select rows: `zaznaczono 1 wiersz`, `3 wiersze`, `5 wierszy`.

## The mock API

`scripts/serve-example.mjs`, no dependencies. `GET /api/people` applies only what `serverDoes` names,
so a demo cannot quietly do work it claims not to.

| Endpoint | Does |
| :--- | :--- |
| `GET /api/people` | 5,000 people. `page`, `pageSize`, `sort` (`col:asc,other:desc`), `search`, `filters` (JSON `FilterSpec[]`), `serverDoes`, `latency`, `withTotal=false` |
| `GET /api/people/range` | A window of a ten-million-row table: `offset`, `limit` |
| `POST /api/reports` | Markdown in, a printable HTML document out, standing in for a PDF service |
| `GET /api/files`, `POST /api/files` | The stored tree, and one change applied to it |
| `POST /api/people/edit` | Stores one edited cell; an empty value is refused with a 422 |
| `GET /api/fail-next` | Makes the next `/api/people` request fail with a 503 |

## Not shipped

`examples/` is not in the published tarball. The pages need network access for React, which comes
from a CDN through the import map because it is a peer dependency, not bundled.
