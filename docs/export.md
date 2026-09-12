# Exporting

One prop puts an export control in the toolbar:

```tsx
<Gridwright columns={columns} data={people} export />
```

That gives comma-separated text, Markdown and print. Name the formats to change the list, and the
order is the order of the menu:

```tsx
<Gridwright
    columns={columns}
    data={people}
    export={{ formats: ['csv', 'excel', 'markdown', 'print'], filename: 'people' }}
/>
```

Nothing is bundled to make this work. The package still declares no runtime dependencies: the
formats it writes are ones a string can express.

## What gets exported

**The reader chooses the rows, in the menu.** Above the formats sits a "Rows" group of three radio
items, and the first is checked when the menu opens:

| Item | Writes | Off when |
| :--- | :--- | :--- |
| All matching rows | every row matching the query: filters, search and sort apply, pagination does not | the source pages and has no `fetchAll` |
| This page | what the reader can see | never |
| *n* selected rows | the ticked rows that are loaded, and says how many | nothing loaded is ticked; not drawn at all without selection |

An item that is off stays in the menu, reachable by the arrow keys, and "All matching rows" is
described by a sentence saying why. When the checked item goes off, the menu checks the next one
that is on, so a format click always writes the rows the menu shows as chosen.

**Or fix the rows yourself.** A `scope` option decides for the reader and hides the group:

```tsx
export={{ scope: 'all' }}       // every matching row
export={{ scope: 'page' }}      // what the reader can see
export={{ scope: 'selected' }}  // what they ticked, of the rows that are loaded
```

**The columns on screen, minus the ones that opted out.** A hidden column is not exported, because
it is not part of the grid the reader is looking at. A column whose cell is a control rather than a
value should say so:

```ts
{ id: 'actions', header: '', exportable: false }
```

The selection checkbox, the tree toggle and the row action menu need no opt-out. None of them is a
column: they are cells the adapter renders.

**The text the column already produces.** A cell exports through `exportValue` when the column has
one, and through `formatValue` otherwise, which is the same text global search matches on. Use the
first when the screen and the file want different things:

```ts
{
    id: 'salary',
    formatValue: (value) => currency.format(value),   // $120,000 on screen
    exportValue: (value) => String(value),            // 120000 in the spreadsheet
}
```

## Exporting everything from a server

A source that paginates for itself has one page in memory. Asking it for every matching row is a
question only the server can answer, so the grid asks:

```ts
const source: DataSource<Person> = {
    kind: 'people',
    capabilities: { sort: true, filter: true, search: true, paginate: true },
    fetch: ({ query, signal }) => api.page(query, signal),
    // The same request, with the pagination ignored.
    fetchAll: ({ query, signal }) => api.all(query, signal),
};
```

Without `fetchAll`, "All matching rows" is off in the menu and says why, and the reader can still
write this page or their selection. A fixed `scope: 'all'` refuses with the same sentence and
writes nothing. Neither falls back to the page in memory under the name of everything: a file
containing 25 of 4,000 rows, named as though it held all of them, is worse than no file, because
nothing about it looks wrong until somebody acts on it.

The same rule is readable from your own code:

```ts
api.canFetchAllRows();                                // would fetchAllRows answer? No fetch.
const { rows, isComplete } = api.getMatchingRows();   // synchronous, no fetch
const all = await api.fetchAllRows();                 // fetches, or throws
```

`fetchAllRows` changes nothing on screen. No loading state, no `fetch` event, no new rows. An
export is not a navigation.

## The formats

| Format | Extension | Notes |
| :--- | :--- | :--- |
| `csv` | `.csv` | RFC 4180 quoting, a byte order mark by default, formula escaping by default |
| `excel` | `.xls` | XML Spreadsheet 2003, typed cells, column widths |
| `markdown` | `.md` | GitHub Flavored table, alignment markers, escaped pipes |
| `print` | — | A standalone document, sent to the browser's print dialog |

A cell is typed in the spreadsheet only when its exported text is the plain value. A column with a
`formatValue` asked for those words, so `$120,000` and `Active` travel as text, in the spreadsheet
exactly as everywhere else. `exportValue` is how to have both: `$120,000` on screen, `120000` in
the file, typed as a number because the text now matches it.

**Why comma-separated text is the default.** Excel opens the XML spreadsheet with a warning that
the extension and the format do not match. That warning is the price of writing a typed spreadsheet
with no dependency, and it is worth paying when you want numbers to stay numbers, but it should not
be the first thing a reader sees. Text with a byte order mark opens silently, in the right
encoding, everywhere.

**Why a cell beginning `=` is prefixed.** A spreadsheet evaluates it when the file is opened, so an
exported cell is a way into the machine of whoever opens it, and the rows usually came from
somebody else. The apostrophe is standard and is on by default. Switch it off only for a file no
spreadsheet will open:

```tsx
export={{ formats: ['csv'], csv: { escapeFormulas: false, bom: false, delimiter: ';' } }}
```

**Why printing builds its own document.** A windowed grid holds forty rows in the page, so printing
the live table prints forty rows and two spacers. The print export renders every scoped row into a
standalone document with its own stylesheet, repeats the header on each sheet of paper, and keeps a
row from being cut in half. Replace the stylesheet with `print: { styles }` when the default is not
yours.

## A Markdown template as a report, and a PDF

The Markdown template is a report format, not only a table dump. `formatMarkdownTemplate` fills one
block per row and puts a header and a footer around them, and both of those can be functions when
the title needs to say how many rows it covers:

```ts
const markdown = formatMarkdownTemplate({
    rows,
    columns,
    header: (covered) => ['# Monthly report', '', `${covered.length} people.`].join('\n'),
    template: ['## {name}', '', '- Department: {department}', '- Salary: {salary}'].join('\n'),
    separator: '\n\n',
    footer: '*Generated from the rows on screen.*',
});
```

Placeholders resolve through the same export text as every other format, so `exportValue` applies
here too. The header and footer describe the document rather than a row, so braces in them are left
alone.

`markdownToHtml` renders that into HTML, and `formatMarkdownDocument` wraps the result in the same
printable document the table print uses. In the browser, `printMarkdownDocument` does both and
opens the print dialog, where the reader saves a PDF. Nothing is bundled for any of it: the
renderer covers headings, paragraphs, emphasis, code, links, rules, quotes, lists and tables, and
the browser already has a PDF writer.

Every character of the source is escaped before the renderer decides what is markup, and a link
whose target carries a scheme other than `http`, `https`, `mailto` or `tel` is rendered as the text
somebody wrote rather than as something clickable. Rows come from elsewhere, and a report is opened
by whoever asked for it.

## A format of your own

The menu is not a closed list of four. Pass an object instead of a name and it appears beside the
built-in formats, with its own label and its own writer:

```tsx
const monthlyReport = {
    id: 'acme:monthly',
    label: 'Monthly report',
    serialize: ({ rows, columns }) => printMarkdownDocument(buildReport(rows, columns)),
};

<Gridwright columns={columns} data={people} export={{ formats: ['csv', monthlyReport] }} />
```

Namespace the id the way a plugin namespaces a stage. The label is a string you pass already
translated, because a format only you define is a string only you can translate.

A serializer returning nothing delivered the export itself, which is what printing and uploading
look like. Returning a file saves it, and the file may be a `Blob`, so a service that answers with
a PDF or a real workbook hands it back and the grid saves the bytes:

```ts
serialize: async ({ rows, columns }) => {
    const response = await fetch('/api/reports', { method: 'POST', body: buildReport(rows, columns) });
    return { content: await response.blob(), mimeType: 'application/pdf', extension: '.pdf' };
},
```

That is the backend route, and it is the one to take when the report has to look identical on every
machine. The client-side route costs nothing in the bundle and is at the mercy of the reader's
print settings. Both start from the same Markdown.

## Serializing it yourself

Bring your own writer for any format. Return a file and the grid saves it; return nothing and the
grid assumes you delivered it:

```tsx
<Gridwright
    columns={columns}
    data={people}
    export={{
        formats: ['excel'],
        serializers: {
            excel: async ({ rows, table, filename }) => {
                await api.buildWorkbook({ filename, rows });   // your backend, your .xlsx
            },
        },
    }}
/>
```

The `table` in that context is the same resolved text every built-in format writes from, so a
custom serializer and the built-in one export the same cells.

## Without the component

The serializers are headless and exported from the core entry. They run in Node, in a worker, or in
a test with no renderer at all:

```ts
import { buildExportTable, formatCsv, resolveColumns } from 'apsw-gridwright';

const table = buildExportTable({ rows, columns: resolveColumns(columns) });
await writeFile('people.csv', formatCsv(table));
```

`useGridExport` is the same behaviour without the menu, for a toolbar of your own, including the
scope choice the menu draws:

```tsx
const { exportAs, busy, message, error, scope, setScope, isScopeAvailable, selectedCount } =
    useGridExport<Person>({ formats: ['csv'] });

exportAs('csv');                        // the chosen scope
exportAs('csv', { scope: 'selected' }); // this once
```

`exportAs` takes a built-in id or the id of a custom format. An id that is neither is reported as
an error rather than doing nothing, because a button that appears inert is the worst way to find a
typo.

## When an export fails

The reader sees a translated sentence about their rows: "The CSV export could not be produced", or
for a source that cannot hand over the rest, the sentence the menu shows beside the item. They never
see the thrown message. That one is written for you, names internals like the source's `kind`, and
is English under every locale, so it goes to `onError`, and to `console.error` when there is no
`onError`, so it is never simply lost.

```tsx
export={{ onError: (cause) => reportToSentry(cause) }}
```

## Accessibility

The trigger is a real button carrying `aria-haspopup` and `aria-expanded`. The menu is a
`role="menu"` of buttons, reachable with the arrow keys and dismissed with Escape, and focus
returns to the trigger both ways. The scopes are `menuitemradio` items in a labelled `group`,
carrying `aria-checked`; one that is off is `aria-disabled` rather than `disabled`, so it stays in
the arrow-key order and can be described by the reason it is off. Saving a file moves focus nowhere by itself, which is exactly
why the return is explicit.

Progress is announced in the export control's own visually hidden `role="status"` region, separate
from the grid's, because an export changes nothing about the rows and the grid's region is for what
did change. A failure is a visible `role="alert"`, not only an announcement: a button that appears
to do nothing is the worst possible report of a failed export.
