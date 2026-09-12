# Specification: Markdown report templates and custom export formats

> **Status**: Implemented
> **Stage entry**: 1 & 2
> **Semver impact**: minor (confirmed in api-surface.md)

## 1. The consumer problem

The export feature writes a table. What people ask a grid for next is a *document*: a monthly
report, a delivery note, a summary somebody can hand to a stakeholder. The shape of that is not
rows and columns, it is a title, a section per row, and a note at the bottom, and the format people
want it in is PDF.

Three things stood in the way.

1. The Markdown template rendered one block per row and nothing around them, so the caller had to
   concatenate a header themselves and get the blank lines right.
2. Nothing turned Markdown into anything. A consumer could produce the text and had nowhere to send
   it, and the obvious answer, a Markdown library plus a PDF engine, is megabytes of dependency in
   a package that declares none.
3. The export menu offered exactly four formats. A consumer could replace one of them, but could
   not add a fifth called "Monthly report", which is the thing they actually wanted. By this
   repository's own plugin rule, a built-in being able to do something a consumer's code cannot is
   a defect rather than a missing feature.

## 2. User stories

- **US-01.** As a developer, I want a report template with a title above the rows and a note below
  them, where the title can say how many rows the report covers.
- **US-02.** As a developer, I want that report as a PDF without adding a PDF engine to my bundle.
- **US-03.** As a developer with a service that renders Markdown into a PDF, I want to send it the
  same template output and have the grid save what comes back.
- **US-04.** As a developer, I want my report to appear in the grid's own export menu, beside the
  built-in formats, rather than as a button I have to place and style myself.
- **US-05.** As a person reading a report, I want a cell that contains markup or a script URL to be
  text in the document, not markup and not a link.

## 3. Acceptance criteria

- [x] **AC-01** `formatMarkdownTemplate` takes `header` and `footer`, each `string` or
      `(rows) => string`, separated from the body by a blank line.
- [x] **AC-02** `markdownToHtml` renders headings, paragraphs, emphasis, inline and fenced code,
      links, rules, blockquotes, ordered and unordered lists, and GitHub Flavored tables with
      alignment. Anything else survives as the text it was written as.
- [x] **AC-03** The source is escaped before markup is decided, and a link whose scheme is not
      `http`, `https`, `mailto` or `tel` renders as text.
- [x] **AC-04** `formatMarkdownDocument` wraps a rendered report in the printable document, and
      `printMarkdownDocument` prints it from the adapter.
- [x] **AC-05** `formats` accepts `{ id, label, serialize }` beside the built-in names, and the
      entry renders in the menu with its own label.
- [x] **AC-06** `serializers` is keyed by id, `exportAs` takes any id, and an unregistered id is
      reported as an error rather than silently doing nothing.
- [x] **AC-07** `ExportFile.content` accepts a `Blob`, so a service that answers with a PDF or a
      workbook rides the same downloader.
- [x] **AC-08** Zero runtime dependencies, still.

## 4. Non-goals

- **A complete Markdown implementation.** Footnotes, reference links, HTML blocks, nested lists and
  setext headings are not rendered. A report template needs none of them, and the alternative is a
  parser in a package that has no dependencies.
- **Rendering a PDF in the package.** The browser writes it, or a service does. What this package
  produces is the document.
- **A template editor, or storing templates.** Where a report template lives, who may edit it and
  how it is versioned is the application's business, and every application already has somewhere to
  put it. The grid takes a template.
- **Message keys for custom formats.** A label only the consumer defines is a string only the
  consumer can translate.

## 5. Behaviour across the capability seam

Unchanged. A report is built from the rows a scope resolved, by the same rules: everything matching
the query, the page, or the selection, and a paginating source without `fetchAll` refuses rather
than reporting on one page.

## 6. Accessibility and interface copy

A custom format is a `menuitem` like any other, reached by the same arrow keys, announced through
the same live region using its `name` or its label. No new message keys: the four built-in labels
already exist, and a custom label arrives translated.

## 7. Clarifications

- **Why is the custom label not a message key?** Because the catalogue is this package's copy. A
  key the package does not ship cannot fall back to English, and a consumer who has a translation
  system already has the string in it.
- **What happens to a cell containing `**bold**`?** It renders as bold. A template language
  interprets its own syntax, and the cell text is part of the template's output. A consumer who
  needs literal text can escape it in `exportValue`.
- **Why is the print route the default rather than a service?** It costs nothing and works offline.
  The trade is that page size, margins and the header the browser adds are the reader's settings,
  not the application's. A report that must be identical everywhere belongs on a service.

---

## 8. Addendum: one template, as Markdown or as a PDF (2026-09-12)

> **Stage entry**: 1 (a consumer's request) · **Semver impact**: minor

### 8.1 The problem

The pieces exist: `formatMarkdownTemplate` fills a template whose `{columnId}` placeholders read the
grid's columns, `formatMarkdownDocument` and `printMarkdownDocument` turn Markdown into a printable
document, and `formats` takes custom entries. What a consumer asked for is the obvious composition:
*define a report once, and let the reader take it as a `.md` file or as a PDF.* Today every project
that wants that writes two custom formats around one template by hand, keeps them in sync, picks a
MIME type and an extension, and remembers to pass the document title through to the print. The only
example of it lived in the playground, which is not something an installed package can import.

### 8.2 User stories

- **US-06.** As a developer who installed the package, I want to describe a report as a template
  over my columns and get menu entries for it, without writing a serializer.
- **US-07.** As a person reading a grid, I want the same report as a Markdown file I can paste or
  keep, or as a PDF I can send, from the same menu.

### 8.3 Acceptance criteria

- [x] **AC-09** `markdownReportFormats(options)` from `apsw-gridwright/react` returns custom export
      formats for one report: a Markdown download and a print-to-PDF entry, in that order, spread
      into `formats`.
- [x] **AC-10** Both are rendered from one call to `formatMarkdownTemplate` with the scoped rows and
      the grid's columns, so placeholders use `exportValue`, then `formatValue`, exactly as every
      other format does, and the two outputs cannot disagree.
- [x] **AC-11** The Markdown entry saves `<filename>.md` as `text/markdown`. The PDF entry opens the
      print dialog with the report rendered, titled by `title` (string or function of the rows),
      with `print` options passed through; it saves nothing itself.
- [x] **AC-12** `outputs` chooses which entries appear (`['markdown', 'pdf']` by default). Ids are
      `<id>:markdown` and `<id>:pdf`. Labels default to `<label> (Markdown)` and `<label> (PDF)`,
      and `labels` overrides either.
- [x] **AC-13** Nothing new below the adapter: the core already has every function this composes.

### 8.4 Behaviour across the capability seam

Unchanged. The entries are custom formats, so they receive the rows of the scope the reader chose,
through the same resolution as every other format.

### 8.5 Clarifications

- **Why in the adapter and not the core?** The PDF half opens the print dialog, which is browser
  work. The Markdown text itself is still `formatMarkdownTemplate`, in the core, for Node.
- **Why "(Markdown)" and "(PDF)" in untranslated labels?** They are format names, like "CSV" in
  `export.csv`. The report's own name is the consumer's, passed translated, as every custom label
  is; `labels` replaces the whole string when a language wants a different order.
- **Why an array rather than one entry with a sub-choice?** The menu is a list of formats and a
  reader chooses one. Two entries need no new menu behaviour and keep keyboard use identical.
