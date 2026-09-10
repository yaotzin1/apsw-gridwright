# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

A changed default is treated as a breaking change even though nothing fails to compile: the
consumer's build stays green and their grid behaves differently, which is exactly what makes it
worth a major.

## [Unreleased]

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

[Unreleased]: https://github.com/yaotzin1/apsw-gridwright/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.3.0
[0.2.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.2.0
[0.1.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.1.0
