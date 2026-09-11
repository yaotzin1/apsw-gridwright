# Self-review: data export

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Serialization is in `src/core/export/`: pure functions over resolved columns and rows, with no
DOM, no React and no engine. The lint gate covers it automatically, since the headless glob already
matches `src/core/**`. Everything that touches the browser is in `src/react/export/`: the object
URL and anchor, the print iframe, the menu.

Export is not a pipeline stage, and the reasoning is in `plan.md`. A stage would serialize on every
recompute to answer a question nobody asked, would see one page when registered after `PAGINATE`,
and would need the DOM to deliver anything.

The engine gained the two methods that only it could answer, because it alone holds the retained
source rows, the registered stages and the source's capabilities.

## 2. The local/remote seam

Nothing branches on where the rows came from. `fetchAllRows` branches on `capabilities.paginate`,
which is the declared seam, and then on whether the source offers `fetchAll`, which is a capability
of the source rather than a kind of source. Whatever the rows come from, they then run through the
same stages below `PAGINATE`, so a client-side filter still applies to rows a server handed over in
one go.

The refusal is the point of the feature. A paginating source with no `fetchAll` produces an error
naming itself and saying what to add; it never falls back to the page in memory.
`getMatchingRows().isComplete` carries the same fact synchronously, and is false whenever the
source paginates, whatever the row count happens to be.

## 3. Public surface and semver

Minor, as classified in `api-surface.md` before the code was written. Every addition is optional:
two methods on an interface consumers receive rather than implement, two optional column fields,
one optional data source method, seven labels, seven message keys. No default changed, no signature
changed, no event payload changed. `npm run check:exports` passes, and both entries still resolve
types under `import` and `require`.

One deviation from `spec.md`, recorded rather than hidden: the format is called `print`, not `pdf`,
and its message key is `export.print`. The browser's dialog decides whether the output is a PDF or
paper, and naming it after a file the package does not write would be the same species of claim as
inventing a total. The label a reader sees is still "Print", and the live region says PDF, which is
what they get when they save.

## 4. Accessibility and i18n

The trigger is a real `<button>` with `aria-haspopup="menu"` and `aria-expanded`. The menu is a
`role="menu"` of buttons: arrow keys wrap through the items, Escape closes, and focus returns to
the trigger both on Escape and after a format is chosen. That last one matters because saving a
file moves focus nowhere, and a reader left on the body has no way back.

Progress announces in the export control's own visually hidden `role="status"`, not the grid's. The
grid's region carries one sentence derived from engine state, and an export changes no state; the
two never speak at once, because the export region is empty unless an export is running. A failure
is a visible `role="alert"`, deliberately not announcement-only.

Every string comes from the catalogue, in all five locales. The format name spliced into the two
announcements is a product noun, not a translated word, and the label file says so.

## 5. Supply chain and packaging

No dependency added; `check:exports` still reports none. The formats were chosen for that: text,
Markdown, XML Spreadsheet 2003 and an HTML document are all things a string can express, where a
binary workbook or a PDF engine would be megabytes and a supply chain.

Two injection surfaces existed and are closed. Every cell and header reaching XML or HTML passes
through one escaper, which also strips the control characters XML rejects. Every cell reaching
delimiter-separated text that begins `=`, `+`, `-`, `@`, a tab or a return is prefixed with an
apostrophe, because a spreadsheet executes those on open and the rows were written by somebody
else. Both are on by default and both are tested.

The smoke suite imports the serializers and the menu through the package specifiers, and the
packaging audit now lists the seven new core exports and the three new React ones.

## 6. Honest output

No invented anything. The file contains the rows that were resolved, and when they cannot be
resolved there is no file. The spreadsheet types a cell only when the exported text is the plain
value, so a column that formatted `$120,000` or `Active` exports those words in every format rather
than disagreeing with itself between the CSV and the XML. That rule was found by exporting the
playground and reading the result, not by reasoning about it.

## 7. Verification

```
> apsw-gridwright@0.5.0 verify
> npm run clean && npm run validate:skills && npm run sync:check && npm run typecheck && npm run lint && npm test && npm run test:smoke && npm run check:exports

 Test Files  25 passed (25)
      Tests  395 passed (395)

 Test Files  1 passed (1)
      Tests  18 passed (18)

  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   core ESM entry exports 22 expected names
  ok   core CommonJS entry matches the ESM entry
  ok   react ESM entry exports 16 expected names
  ok   both entries share one module instance

the published package resolves cleanly.
```

Driven in Chrome against the built package as well, because a download and a print frame are not
things jsdom can prove. With the endpoint paging and `fetchAll` in place, the comma-separated export
saved all 5,000 mock rows while 25 were on screen, with a byte order mark, CRLF endings, `Kraków`
intact and the salary column as a raw number through `exportValue`. With `fetchAll` removed, the
same click produced the visible alert and no file at all. Markdown and the spreadsheet saved
correctly, the spreadsheet typing 5,000 numeric cells. The tree exported its flattened visible rows.
Every switch was turned back off and the grid returned to its plain state with an empty console.

The features page was driven the same way. Its export switch is on by default, so "every option at
once" now includes this one. Over the nested tree it wrote exactly the six rows on screen. Switched
to the ten-million-row windowed source it wrote the 200 rows of the loaded window, under a filename
that says so, because a block cache is not the table and the source has no `fetchAll` to ask.

## Known gaps

- **Print was not exercised in a real browser.** The dialog it opens is modal and would have frozen
  the automation session. What is proven there is the document: the jsdom test asserts the frame is
  built with every scoped row and the paged-media rules, and the serializer is unit tested.
- **A tree exports what is expanded.** The tree stage flattens the visible hierarchy, so a
  collapsed branch is not in the file. That is consistent with exporting the grid the reader is
  looking at, and a consumer who wants the whole tree can expand it or serialize their own rows.
- **`scope: 'selected'` is limited to loaded rows**, exactly as `getSelectedRows` already was. An id
  selected on another page cannot be resolved to a row without fetching it, and the export does not
  pretend otherwise.
- **No column-level number or date formats in the spreadsheet.** Cells are typed, not styled.
