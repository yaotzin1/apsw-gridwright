# Research: data export

## Options considered

### Option A — export as a pipeline plugin

**How it works.** A stage registered at `STAGE_ORDER.POST` that, when a flag is set, serializes
the rows passing through it and hands the string to a callback.

**Rejected because.** A stage runs on every recompute, so the grid would serialize on every
keystroke of the search box to answer a question nobody asked. It also sees only what reaches it,
which after `PAGINATE` is one page, and before it is whatever the source left for the client. And
the download itself needs the DOM, which is banned in the layer a stage runs in.

### Option B — headless serializers plus an adapter trigger

**How it works.** Pure functions in `src/core/export/` turn resolved columns and rows into text.
The engine answers which rows to serialize. The React layer owns the menu, the download, and the
print document.

**Chosen because.** It puts the testable half where it can be tested without a renderer, and the
browser half where the browser already is. It is also the shape the bubble menu and inline editing
already use, so it adds no new kind of thing to the package.

## Prior art

Most grids export from the DOM or from the loaded page array. Exporting from the DOM is why so
many exported files contain `[object Object]` where a cell renderer was, and why a virtualized
grid exports forty rows. Exporting the loaded page array is why so many exports are silently page
one.

AG Grid and TanStack Table both leave the file writing to the consumer; AG Grid ships CSV and
Excel behind its enterprise tier. This package differs in one way worth naming: the row resolution
reports whether it is complete, and refuses rather than guessing. That follows the same rule the
grid already applies to totals.

Formula injection in spreadsheets is old and well documented: a cell whose text begins with `=`,
`+`, `-` or `@` is evaluated when the file is opened, so an exported cell is an execution path out
of whatever wrote the row. Prefixing with an apostrophe is the standard mitigation and is what the
comma-separated exporter does by default.

XML Spreadsheet 2003 is a documented Microsoft format that Excel and LibreOffice both open. Excel
warns about the extension when it is served as `.xls`, which is why the comma-separated format is
the default and the spreadsheet format is offered rather than assumed.

## Measurements

No performance claim is made, so none are required. The serializers allocate one array per row and
one string per cell, and run only when a person asks for a file.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |
| — | — | — | — |

## Open questions

None. The two that were open at the end of stage 2 are settled here: the full-row hook lives on
the data source as optional `fetchAll`, and the un-sliced row accessor reports completeness rather
than returning a bare array.
