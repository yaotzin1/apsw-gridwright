# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

A changed default is treated as a breaking change even though nothing fails to compile: the
consumer's build stays green and their grid behaves differently, which is exactly what makes it
worth a major.

## [Unreleased]

### Added

- **Exporting, as one prop.** `<Gridwright export />` puts a menu in the toolbar that writes
  comma-separated text, an Excel spreadsheet, a GitHub Flavored Markdown table, or a printable
  document, and the package still declares zero runtime dependencies: no workbook engine, no PDF
  library. `formats`, `filename`, `scope`, per-format options and a `serializers` map for bringing
  your own writer. The trigger is a real button with `aria-haspopup`, the menu is a `role="menu"`
  reachable by arrow keys and dismissed with Escape, focus returns to the trigger, and progress is
  announced in the control's own `role="status"` region.
- **The serializers are headless and exported.** `buildExportTable`, `formatCsv`, `formatExcelXml`,
  `formatMarkdownTable`, `formatMarkdownTemplate` and `formatPrintHtml` come from the core entry
  and run in Node, in a worker or in a test with no renderer. The adapter half is
  `GridExportMenu`, `useGridExport`, `downloadFile`, `printHtmlDocument` and
  `printMarkdownDocument` under `apsw-gridwright/react`.
- **An export file may be bytes.** `ExportFile.content` takes a `Blob` as well as a string, and
  the downloader saves either, so a service answering with a PDF or a real workbook needs no
  download code of its own. The utility is named `downloadFile` for the same reason.
- **`GridApi.getMatchingRows()` and `GridApi.fetchAllRows()`.** `state.rows` is one page; these
  answer for the rows behind it. The first is synchronous and returns `{ rows, isComplete }`,
  where `isComplete` is false whenever the source paginates for itself, because what is in memory
  is then a page rather than the result. The second fetches the rest through a source's new
  optional `fetchAll`, and rejects with a `GridwrightError` when there is none rather than passing
  off one page as everything. Neither touches grid state: no loading status, no `fetch` event.
- **`exportable` and `exportValue` on a column.** `exportable: false` leaves a column out of every
  export, for a column whose cell is a control rather than a value. `exportValue` gives the file a
  different string from the screen, so a salary can render as `$120,000` and export as `120000`.
  A cell with neither exports through `formatValue`, the same text global search matches on.
- **A cell that a spreadsheet would execute is defused.** A value beginning `=`, `+`, `-`, `@`, a
  tab or a return is prefixed with an apostrophe in comma-separated output, because an exported
  cell is opened on a machine belonging to somebody who did not write the row. `escapeFormulas`
  switches it off. Every cell reaching XML or HTML is escaped for markup on the way.
- **Seven message keys**, in all five shipped locales: `export.action`, `export.csv`,
  `export.excel`, `export.markdown`, `export.print`, `export.inProgress` and `export.complete`,
  behind the labels `exportAction`, `exportCsv`, `exportExcel`, `exportMarkdown`, `exportPrint`,
  `exportInProgress` and `exportComplete`. Adding a key is a minor; a catalogue without them falls
  back to English.
- **The Markdown export is a report template.** `formatMarkdownTemplate` now takes a `header` and a
  `footer`, each a string or a function of the rows the export covers, so a report can open with a
  title that counts them and close with a note. The per-row template is unchanged.
- **Markdown renders, and prints as a PDF.** `markdownToHtml` covers what a report is made of:
  headings, paragraphs, emphasis, code, links, rules, quotes, lists and GitHub Flavored tables.
  `formatMarkdownDocument` wraps the result in the same printable document the table print uses,
  and `printMarkdownDocument` does both and opens the print dialog, where the reader saves a PDF.
  Still no runtime dependency: no Markdown parser, no PDF engine. Every character is escaped before
  the renderer decides what is markup, and a link whose scheme is not `http`, `https`, `mailto` or
  `tel` is rendered as text rather than as something clickable.
- **The export menu takes formats of your own.** `formats` accepts `{ id, label, serialize }`
  alongside the built-in names, and the entry appears in the menu with nothing privileged about the
  four that ship. `serializers` is keyed by id, `exportAs` takes any id, and an id nobody
  registered is reported as an error instead of doing nothing. This is the plugin rule applied to
  exporting: a built-in must not be able to do something yours cannot.
- **`formatPrintDocument`**, the printable document wrapper on its own, for markup you produced.
- **[docs/export.md](docs/export.md)**, covering the scopes, the server case, the formats, the
  report template and why each default is what it is.

### Changed

- **The headless lint boundary now covers `src/tree`.** The rule banning `document`, `window` and
  React under the engine listed core, data, plugins, i18n and locales. The tree was clean and
  unprotected; it is now protected.


## [0.5.0] — 2026-09-11

React is the supported surface, and the grid now reports its own state to assistive technology.

### Added

- **A stale-data banner.** `keepPreviousData` is on by default, so a failed refresh leaves the
  previous rows on screen. Until now the grid said nothing about it: the `role="alert"` error only
  renders when no rows are left, so a refresh that failed over a full page changed nothing a person
  could see, and the grid went on presenting stale rows as current. `GridStaleNotice` renders above
  the table, with `role="alert"` and a retry button, and clears on the next successful fetch. It is
  exported and attached as `Gridwright.StaleNotice` for layouts composed by hand. Two labels,
  `staleTitle` and `staleMessage`, behind `error.stale` and `error.staleDetail`, plus a `stale`
  class-name override and `.gw-stale` styles.
- **The live region says what changed.** Sorting, paging, searching, filtering and failing all
  announce through the visually hidden `role="status"` region in `GridRoot`, which previously
  carried the word "Loading" and then went empty. One sentence at a time, in a fixed priority
  order: loading, then the sort that changed, then the result summary. It stays silent on failure,
  because a `role="alert"` is already announcing that. A change that leaves the sentence identical
  announces nothing, so selecting a row stays silent.
- **`aria-rowindex` on every row of a paginated grid.** A row is numbered by its position in the
  whole result set. On page two of eight a screen reader previously announced "row 1 of 200" while
  the reader was on row 26.
- **`aria-multiselectable` on a grid whose selection mode is `multiple`.** Checkboxes do not
  distinguish the two: a single-selection grid has them as well.
- **The tree reports its shape.** A tree grid is now `role="treegrid"`, and each row carries
  `aria-level`, `aria-posinset`, `aria-setsize`, and `aria-expanded` when it has children.
  `TreeCell`'s comment has claimed this since the tree shipped; nothing rendered it, so the
  hierarchy reached a screen reader as indentation, which is to say not at all.
- **Five labels and eight message keys**, in all five shipped locales: `sortAnnouncement`,
  `rowsShown` and `rowsTotal`, behind `a11y.sortedAscending`, `a11y.sortedDescending`,
  `a11y.sortCleared`, `a11y.rowsShown`, `a11y.rowsShownUnknown` and `a11y.rowsTotal`. Adding a key
  is a minor; a catalogue without them falls back to English.
- **The capability controls are on the React playground.** Which facets the endpoint resolves,
  whether it sends a total, and arming a failure, with a badge per facet naming who did the work.
- **[docs/accessibility.md](docs/accessibility.md)**, covering the whole contract: row positions,
  the live region and its priority order, the tree hierarchy, focus, and what is deliberately
  absent. The README section pointed at it rather than growing to the same length.

### Fixed

- **`aria-rowcount` and `aria-rowindex` disagreed by one.** ARIA counts every row of a table,
  header rows included, so the header row is row 1 and data rows start at 2. `aria-rowcount` is
  now `totalRows + 1`, and the virtualized body's indices moved from `absolute + 1` to
  `absolute + 2`. It stays `-1` when the total is not exact. **A test asserting on the old numbers
  will need updating**; the old numbers were internally inconsistent rather than merely different.
- **A failed refresh over rows already on screen was reported by nothing.** See the stale-data
  banner above. It is listed as an addition rather than only a fix because closing it needed a new
  component and two new strings.
- **Paging to the last page ejected keyboard users from the grid.** A focused control that becomes
  disabled sends focus to `<body>`. Focus now moves to the sibling page control, and only when the
  reader activated the control that disabled itself.

### Changed

- **React is the only supported surface.** `apsw-gridwright/react` is what the README, the docs and
  the playground describe. Nothing is removed from the public API: the core entry keeps every
  export it had, stays headless, stays lint-enforced and stays tested. It is now documented as the
  engine the component is built on rather than as a second way to build a grid.
- **`aria-expanded` moved off the tree toggle button onto the row.** In a `treegrid` the expanded
  state belongs to the row, and a row and a button both carrying it is announced twice. **A test
  asserting on the button's `aria-expanded` will need updating.**
- **The live region can now repeat visible text.** The empty message, for instance, appears both in
  the body and in the region that announces it. A test using `getByText` on a status string may
  need `getAllByText` or a query scoped to the table.

### Removed

- **The framework-free playground page**, its tree panel, and the three DOM helpers that existed
  only for them. It was a second grid implementation with no tests, no packaging audit and none of
  the accessibility work done in `src/react`, and every decision made in the adapter had to be made
  a second time there or silently not made at all. The React playground is now the landing page and
  carries the capability controls it used to own. Nothing published changes: `examples/` is not in
  the tarball.

## [0.4.0] — 2026-09-10

Every capability is now an option on one component rather than a component of its own.

### Added

- **One component with switchable options.** `<Gridwright />` gained `tree`, `virtual`,
  `rowActions`, `rowActionsTrigger`, `onCellEdit` and `renderSkeleton`, and columns gained `icon`
  and `edit`. They compose: a virtualized tree with a row menu and two editable columns is four
  props on the same element. Each piece is still exported on its own for a layout composed by hand,
  and the component has no privileged access to any of them.
- **Virtualization.** `virtual` renders only the rows on screen, carrying the rest in two spacer
  `<tr>` rows so the element stays a real `<table role="grid">` with real rows and real column
  alignment. `aria-rowcount` and `aria-rowindex` carry the true positions. Exported separately as
  `GridVirtualBody` and `useVirtualRows`.
- **A data source that holds a window.** `createWindowedDataSource({ fetchRange })` answers ranges
  instead of tables, keeping `blockSize * maxBlocks` rows however large the result set is, evicting
  least-recently-used and furthest-away blocks first, and dropping everything when the sort, filters
  or search change. `WINDOW_OFFSET_META` publishes where the held rows start. Ten million rows is
  now a scrolling problem rather than an impossible one.
- **Scroll scaling past the browser's height limit.** A browser will not render an element taller
  than about 2^24 pixels, which is roughly 419,000 rows and no error message. Above that the scroll
  position becomes a ratio over the result set, so the last row of ten million is reachable. The
  cost is stated: one pixel of scrollbar then covers more than one row.
- **`computeVirtualWindow` and `scrollOffsetForIndex` in the core.** The window arithmetic is four
  numbers in and a slice plus two spacer heights out, with no DOM anywhere in it, so it is not a
  React concern and no longer lives in a React hook. `useVirtualRows` is now the binding that reads
  two DOM numbers once per frame, and a page with no framework virtualizes ten million rows with a
  scroll listener.
- **Per-row icons.** A column's `icon` is a renderer like `cell` is, marked `aria-hidden` because
  the text beside it already says what it says. On a tree column it lands between the toggle and the
  label rather than before the indentation.
- **`tree.controllerRef`**, which hands back the tree controller the component owns, since
  insertion, movement and removal live on it. `<Gridwright instance={...} />` now recognises an
  instance built by `useTreeGridwright` and supplies the tree context itself.
- **`rowDataOf(row)`**, which answers with the consumer's row whether the grid is a tree, whose
  rows are placements, or flat, where the row is already the row. One row handler then survives the
  tree being switched on or off, which is the point of it being a switch.
- **A left click opens the row menu**, pinned until you click elsewhere or press Escape.
  `rowActionsTrigger` gained `click`, and the default includes it: a right-click-only menu is one
  nobody finds. A click landing on a button, a link or a field is left alone, because that click
  belongs to the control it landed on.
- A styled bubble menu: layered shadow, entry animation that respects `prefers-reduced-motion`, an
  inset focus ring, a destructive tint, a pinned-state accent, and a transform that flips with the
  writing direction.
- `docs/virtualization.md`, and all three playground pages rebuilt around the new options: the
  vanilla page gains the windowed source over ten million rows and a tree it draws itself, both with
  no framework involved, the React page gains row actions, inline editing, windowing and a tree over
  its paginating API, and the third page is every option at once. The mock API gained `/api/people/range`, so the ten million rows are a
  real network boundary rather than a function pretending to be one.
- `docs/persistence.md`: what to send to a database when a cell is edited or a tree is changed, what
  the four change shapes map onto, and why the nested set is derived rather than stored. Both
  playground trees now post their changes to the mock API and survive a reload, and the vanilla page
  gained virtualization, inline editing and a row menu it draws itself. Each page is now markup plus
  one module under `examples/playground/js/`, with the loader, the row menu, the icons and the DOM
  helpers shared, and ESLint covers all of it: the first run found a piece of dead state.

### Changed

- **`TreeGridwright` is now an alias** for `<Gridwright tree={...} />`. Same props, same behaviour,
  one implementation. It was a parallel component, which is how a tree ended up unable to use
  windowing, row menus or icons.
- `docs/tree.md`, the README and the playground now lead with the option form.

### Fixed

- **A tree whose rows arrived from a server rendered as a list of roots.** `defaultExpandedDepth`
  was consumed on the first normalise, which for an asynchronous source happens with no rows in
  hand, so it expanded nothing and never applied again. It now waits for the first build that
  produced a tree.
- **`hidden` did not hide a grid part.** Every layout rule uses a class selector, which has the same
  specificity as a bare `[hidden]` and comes first, so the pagination footer stayed on screen under
  a virtualized body.
- **Virtualization over an ordinary paginating source never placed its rows.** Only the windowed
  source publishes where its rows start, and the body read a missing offset as zero, so page three
  was drawn over rows one to a hundred while the rows on screen stayed skeletons. It now falls back
  to the query, and treats rows as unplaceable until they settle rather than drawing them somewhere
  wrong.
- **Switching editing off took the grid down.** The engine resolves columns in an effect, so for one
  render the rows still held editable cells while the prop was already gone, and those cells threw
  for want of a provider. The tree made it permanent: its column wrapping was keyed on column ids
  alone, so it never re-wrapped at all. Toggling an icon on a column had the same cause.
- **A column's icon was not part of its editable cell.** It sat beside the trigger, so clicking the
  icon did nothing, which reads as "this cell is not editable". It is now inside the trigger.
- **The row action menu appeared at the far edge of the table.** It now opens beside the pointer, on
  the row the pointer is over, clamped inside the grid, and falls back to the row's trailing edge
  when the row was reached by keyboard. At the edge of a wide table it was both a journey away from
  the row it belonged to and sitting on top of the last column.
- **The row action menu opened a row too low.** It is positioned inside a zero-height anchor but was
  measured against the grid root, so every menu was out by whatever sat above it, usually the
  toolbar. It is now measured against the anchor and centred on the row it belongs to.
- **Two overlapping window fetches could leave the grid empty and `ready`.** A block already being
  loaded for a request that was then aborted was joined by the next request, resolved carrying
  nothing, and the surviving request built its window from an empty cache. It now only joins a load
  whose own request is still alive, and looks again afterwards.
- **A fetch in flight across `invalidate()` put its rows back into the cache that was just
  cleared.** Blocks now carry the generation of the cache they were fetched for.
- **A changed `dataSource` prop never reached the engine.** The guard compared the new prop against
  a helper that reads the current props, so it compared the prop against itself, which is always
  equal, and `setDataSource` was never called. Present since 0.1.0 and invisible because no test
  swapped the prop.
- **Changing the tree's input shape left every row a root.** The controller chose between nested
  children and parent references when it was built, so switching afterwards silently flattened the
  tree. It now asks on every normalise, which also means the controller is never rebuilt and
  expansion, loaded children and pending edits survive.
- **Expanding a node with children already present fetched an empty list and replaced them.**
  Lazy loading now runs only for a node that declared children and has none.

Every one of those was found by using the playground rather than by running the suite. The
ten-million-row demo went blank after an edit; the last rows of ten million turned out to be
unreachable; switching a checkbox off took the grid down; and the row menu pointed at the wrong row
in a screenshot. Each now has a regression test.


## [0.3.0] — 2026-09-10

### Added

- **Tree data**, modelled as a nested set. Every node carries a `left`/`right` interval, so
  ancestry is two comparisons, subtree size is arithmetic, and the interval order is already the
  render order. `TreeGridwright` and `useTreeGridwright` for React; `buildTreeIndex`,
  `createTreeController`, `createTreeDataSource` and `treePlugins` for the headless core.
- **A row can sit under several parents.** Nested set encodes a strict tree, so a row placed twice
  produces two *nodes* sharing one row object. Editing the row reaches both; expanding, selecting
  and paging act on one placement. Node ids are paths and escape the separator, so a row id
  containing a slash cannot collide.
- **Cycles are handled rather than crashed on.** A row already on its own path is placed once,
  marked, and not descended into. A graph that is entirely a cycle has no root, so unreached rows
  are promoted to roots and nothing vanishes.
- **Expandable rows**, with `defaultExpandedDepth`, `expandAll`, `collapseAll` and an expansion set
  you can persist and restore. Toggling recomputes the pipeline and never refetches.
- **Lazy children** through `hasChildren` and `loadChildren`, keyed on the row so a second
  placement reuses the first fetch. Per-node loading and error state, with an abort signal.
- **Tree-aware query semantics.** Filtering keeps and opens the ancestors of a match, sorting
  orders siblings within each parent, and the total counts visible nodes. Data source capabilities
  still apply: a facet the server resolved is not redone.
- **Optimistic mutations with rollback**: `updateRow`, `insertRow`, `moveNode`, `removeNode`. A
  rejected change restores the tree exactly and reports on the row. Inserting as a child opens the
  parent; a move into a node's own subtree is refused.
- **`BubbleMenu`**, a floating row-action menu. A real `role="menu"` of buttons that opens on focus
  as well as hover, with a pinning context-menu trigger and arrow-key navigation.
- **Inline editing**: `edit` on a column plus `InlineEditProvider` and `editableColumns`. Opt-in
  per column, Enter commits, Escape cancels, blur commits, and the trigger is a real button.
- **`invalidatePipeline()`** on the grid API: recompute the visible rows from the last settled
  result without asking the source again.
- **`plugins`** on `useGridwright`, so a React grid can replace the default plugin set.
- Five new message keys for the tree, translated in all five bundled locales.
- [docs/tree.md](docs/tree.md).

### Fixed

- `BubbleMenu` compared `data-row-id` strictly against the row id, so a grid keyed on numbers never
  opened a menu. Found by the smoke suite, which is the only layer that exercised numeric ids.


## [0.2.0] — 2026-09-10

### Added

- **A message catalog for translation.** Flat dot-separated keys, ICU-style `{placeholder}`
  interpolation, and plural forms using the CLDR categories `Intl.PluralRules` returns. That is the
  format i18next, FormatJS, Lingui, Weblate and Crowdin already consume, so a catalog is a file
  translators can open. No plural table and no CLDR data ship with the package.
- **Locale packs** at `apsw-gridwright/locales`: `en`, `de`, `es`, `fr`, `pl`. Its own entry point,
  so a bundler drops the ones you do not import. `<Gridwright locale={pl} />` switches the text,
  the plural rules, the number formatting and the text direction together.
- **`translate` prop**, taking the `(key, values) => string` function every major i18n library
  already exposes. A library that echoes an unknown key back is treated as untranslated and falls
  through to the catalog, so a dotted identifier never reaches the screen.
- **`messages` prop** for overriding individual keys over a catalog.
- **Right-to-left support.** Direction is resolved from the locale through `Intl.Locale`, and the
  grid root carries `dir` and `lang`. The stylesheet already used logical properties, so the layout
  mirrors without a second stylesheet. No RTL catalog ships yet.
- **`createTranslator`** in the headless core, usable with no React, and `useTranslator` plus
  `translator` on the React context so a part you wrote yourself translates from the same catalog.
- **`auditCatalog`**, which reports the keys a catalog is missing and the keys it invented, so
  drift fails a test instead of rendering English into the middle of a translated page.
- **Documentation** under `docs/`: data sources, extensibility and its deliberate limits, writing a
  plugin with worked recipes, translation, and the spec-driven process the repository runs on.

### Changed

- Interface copy now resolves through the catalog. `labels` still works and is still the escape
  hatch for a single string or a label that needs logic a message cannot express; it is applied
  above the catalog. No existing call breaks.
- `defaultLabels` is now derived from the English catalog rather than written separately, so the
  two cannot drift.


## [0.1.0] — 2026-09-10

Initial release.

### Added

- **Headless grid engine** (`createGridEngine`) with sequenced, abortable fetching, a plugin
  pipeline, selection, and one published state shape for every kind of data source.
- **Capability negotiation.** A data source declares which query facets it resolved through
  `capabilities`; the pipeline applies the rest. An in-memory array and a paginating endpoint use
  the same code path, so moving between them changes one prop and nothing else.
- **Data sources.** `createLocalDataSource` for an array, answering synchronously so a local grid
  renders on the first paint. `createRemoteDataSource` for any async function, with backoff on
  retryable failures, abort handling, and `invalidate()`. `createRestDataSource` for REST
  endpoints, with parameter encoding, envelope tolerance across five common shapes, `X-Total-Count`
  support, and extraction of the server's own error message.
- **Plugins.** Filtering, search, sorting and pagination ship as ordinary plugins with no
  privileged access. `STAGE_ORDER` names seven slots, including a `TRANSFORM` slot reserved for
  grouping. A stage that throws loses its own effect and nothing else.
- **React adapter** (`apsw-gridwright/react`): the `Gridwright` component, the `useGridwright`
  hook, and five composable parts usable independently under `GridwrightProvider`.
- **Unstyled stylesheet** (`apsw-gridwright/styles.css`): structural CSS over `--gw-*` custom
  properties, dark mode in both directions, reduced-motion support.
- **Full interface copy in `labels`.** Sixteen strings, all replaceable. `pageRange` is a function
  because word order around numbers differs by language.
- **Accessibility.** A real `<table>` with `role="grid"`, sort controls as buttons, `aria-sort` on
  the header cell, states rendered inside the table, a live region for loading, `role="alert"` for
  errors.
- **Honest totals.** A paginating source that sends no count produces `isTotalExact: false`, and
  the grid says "of many" rather than computing a number from one page.
- Dual ESM and CommonJS output with separate `.d.ts` and `.d.cts` type entry points, and a shared
  chunk so both entries are one module instance.

### Notes

- Zero runtime dependencies. React 18 or 19 is an optional peer dependency, needed only for the
  React entry.
- `selectionMode` defaults to `none`. A checkbox column nobody asked for is a column the reader has
  to account for.
- Not included: row virtualization, inline editing, column resize and reorder, grouping and
  aggregation. See the non-goals in `specs/gridwright-core/spec.md`.

[Unreleased]: https://github.com/yaotzin1/apsw-gridwright/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.5.0
[0.4.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.4.0
[0.3.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.3.0
[0.2.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.2.0
[0.1.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.1.0
