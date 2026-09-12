# Self-review: report templates and custom formats

## 1. Boundary and layering

Rendering Markdown is text in, text out, so it sits in `src/core/export/` beside the serializers,
where the headless lint glob already covers it. The printable document wrapper was pulled out of
the table print so both documents share it rather than each carrying a copy of the stylesheet.
Printing stays in the adapter, in the function that already owned the frame.

Format resolution is its own adapter module rather than inline in the menu, because the hook needs
the same answer: the menu needs a label, the announcement needs a name, and both come from one
place.

## 2. The local/remote seam

Untouched. A report is built from rows a scope already resolved, so exporting everything from a
paginating source still asks `fetchAll` and still refuses when there is none. A custom serializer
is handed the resolved rows and cannot reach around that.

## 3. Public surface and semver

Minor. Two optional fields on an options object, three core exports, two adapter exports, and five
widenings that accept strictly more than before. The one rename, `downloadTextFile` to
`downloadFile`, is of a name added in this same unreleased cycle, so nothing published carries it;
the old name would have been a lie once the content could be bytes.

`ExportFormat` stayed a union of the four names this package writes. The escape hatch is a separate
type, `ExportFormatOption`, which is the union plus an object. That keeps autocomplete useful for
the built-in names instead of degrading them to `string`.

## 4. Accessibility and i18n

A custom format is a `menuitem` like any other, in the same `role="menu"`, reached by the same
arrow keys, announced through the same region. No new message keys: the four built-in labels
already existed, and a custom label arrives already translated. That is a deliberate limitation,
and `spec.md` says why: a key this package does not ship has nothing to fall back to.

## 5. Supply chain and packaging

Still zero runtime dependencies, and the audit checks it. Both routes to a PDF avoid an engine: the
browser writes one from a document, or a service writes one from the same Markdown and hands back
bytes the downloader saves.

The renderer is the new attack surface and it is the one thing here worth reading twice. Every
character is escaped before any markup is decided, so a cell holding a script tag is text. A link
whose target carries a scheme outside `http`, `https`, `mailto` and `tel` is rendered as the text
somebody wrote rather than as an anchor. Both are tested, including the script-URL case.

## 6. Honest output

The subset is documented rather than implied, and anything outside it survives as its own text, so
a template using an unsupported construct produces a document with that construct visible in it
instead of a section that silently vanished. The limits of printing, that page size and margins
belong to the reader's settings, are written down beside the feature rather than discovered.

An unregistered format id throws. The alternative was a menu item that does nothing, which is the
hardest kind of bug to find and the easiest to ship.

## 7. Verification

```
> apsw-gridwright@0.5.0 verify

      Tests  407 passed (407)
      Tests  20 passed (20)

  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   core ESM entry exports 25 expected names
  ok   react ESM entry exports 17 expected names
  ok   both entries share one module instance

the published package resolves cleanly.
```

Checked in Chrome against the built package, through the module the page itself loads. The
playground's own report format appears in the menu as a fifth item beside the four built-in ones.
Rendering a report from `dist/index.js` produced the heading, the per-row sections, the export
value rather than the formatted currency, emphasis in the footer, and no anchor at all for a link
written with a script URL. The adapter's print path was driven far enough to prove the document,
the frame is created with the rendered report and the paged-media rules, and torn down in the same
task so no dialog opened. The switch went back off, the grid returned to its plain state, and the
console stayed empty.

## Addendum: one template, as Markdown or as a PDF (2026-09-12)

1. **Boundary.** `markdownReportFormats` is adapter code composing core functions that already
   existed: `formatMarkdownTemplate` for the text, `printMarkdownDocument` for the PDF. Nothing below
   the adapter changed. The Markdown half stays usable in Node through `formatMarkdownTemplate`.
2. **Seam.** The entries are ordinary custom formats, so they receive the rows the scope resolved;
   "All matching rows" from a paginating source still needs `fetchAll`.
3. **Surface.** Minor: one function and two types in `./react`, recorded in `api-surface.md`, listed by
   the export audit, imported by the smoke suite through `apsw-gridwright/react`.
4. **Accessibility and i18n.** Two ordinary `menuitem`s. The report's label is the consumer's,
   translated; the "(Markdown)" and "(PDF)" suffixes are format names like "CSV", and `labels`
   replaces the whole string for a language that wants another order.
5. **Packaging.** No dependency. Two defects found on the way were fixed in the package rather than
   worked around in the playground: `printHtmlDocument` promised a fallback removal timer it did not
   have, and every built-in data source silently ignored a misspelled capability (the playground had
   declared `pagination` instead of `paginate`, so its paginate switch had never worked). Both have
   tests.
6. **Honest output.** The file and the PDF come from one render of one template, so they cannot
   disagree. An unknown placeholder stays visible in the output.
7. **Verification.** `npm run verify` passed: skills and doc sync, typecheck, lint, 457 tests in 29
   files, 22 smoke tests through the built package, and the export audit listing 22 React names with
   no runtime dependency and one shared module instance. In Chrome, on the
   restructured Employees page: the report exported as `employees.md` with 5,000 cards and salaries
   through `exportValue`; editing the per-row template in the page's editor changed the next export
   at once; the PDF entry built the print frame with the edited report (the print call was
   intercepted so no modal opened); switching the preset to "Contact list" renamed both entries;
   the JSON format and the server-rendered report both downloaded. Unticking `paginate` now really
   moved paging into the browser. On the features page the file inventory report exported from the
   tree. Every switch on both pages was turned on and off with an empty console.

**The playground was restructured for developers** as part of this addendum: each page is a folder of
named modules (`js/employees/`, `js/files/`) behind a short HTML shell, every panel links to its
source file, one shared stylesheet replaced two inline copies, and the README maps pages to files and
"I want to…" tasks to files, package API and docs, with a table translating playground imports into
`apsw-gridwright/react`. CI now requests every playground module, not only the ones the HTML names.

## Known gaps

- **The print dialog was again not opened.** It is modal and freezes the automation session. What
  is proven is the document handed to it.
- **The Markdown subset is a subset.** Nested lists, reference links, footnotes, inline HTML and
  setext headings are not rendered. They appear as text.
- **A cell containing Markdown syntax is interpreted.** A value holding asterisks emphasises. That
  is what a template language does; `exportValue` is where to neutralise it.
- **No page numbers, running headers or footers in the printed output.** Those are print settings,
  and CSS paged-media support for them is uneven across browsers.
