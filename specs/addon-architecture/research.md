# Research: add-on architecture

## The audit

Every spec under `specs/` and every feature in `src/` was reviewed on 2026-09-13 for how it can be
delivered as a plugin, which seams it needs, and where the current code or spec hard-wires it.

**Verdicts:** *engine plugin* means a `GridPlugin` or data-source decorator; *add-on* means a React
add-on on the contract in `data-model.md`; *core service* means public engine API with no privilege
and nothing to plug.

### Features that exist

| Feature | Engine today | Engine verdict | Adapter today (hard-wired at) | Add-on verdict and slots | Defects found |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Sorting | `sortingPlugin` | already a plugin | `GridHeader` sort button and `aria-sort`; sort diffing in `a11y/useAnnouncement` | `sorting()`: `headerLabel`, `headerAttributes`, `announce`, messages | header renders a sort button even when the sorting plugin is removed |
| Filtering stage | `filteringPlugin` | already a plugin | — | — | — |
| Column filters UI | uses `setFilter` | — | `Gridwright` (`columnFilters`, provider, clear button, toolbar visibility), `GridHeader` (trigger, `data-filtered`), `a11y` (filter diffing), 30 core catalog keys, `GridwrightColumn.filter` | `columnFilters()`: `provide`, `headerAfter`, `headerAttributes`, `toolbar`, `announce`, messages, column option augmentation | — |
| Global search | `searchPlugin` | already a plugin | `GridToolbar` search box behind `searchable` | `search()`: `toolbar`, messages | toolbar visibility is an OR of feature flags |
| Pagination | `paginationPlugin` | already a plugin | `Gridwright` footer, `hidePagination`, `pageSizeOptions`; `paginated` announcement flag | `pagination()`: `belowTable`, messages; virtual declares `navigation: 'window'` | — |
| Selection | engine state and API | core service | checkbox column in `GridHeader`, `GridBody`, `GridVirtualBody`; `aria-selected`; `aria-multiselectable`; selected count in `GridToolbar` | `selection()`: extra column, `rowAttributes`, `tableAttributes`, `toolbar`, messages | selection markup duplicated in two bodies |
| Stale notice | — | — | always rendered by `Gridwright` | `staleNotice()`: `aboveTable`, messages | the shell's error silence depends on it; documented as a dependency |
| Loading, empty, error | engine status | core service | `GridBody` render props; `GridVirtualBody` has none | shell defaults, replaceable through `status` | virtual body ignores the render props |
| Row actions | — | — | `Gridwright` props; DOM delegation on `.gw-row[data-row-id]`; hard-coded English `"… row actions"` | `rowActions()`: `overlay`, `rowAttributes` events, messages | untranslated string |
| Inline editing | — | — | `Gridwright` wraps columns and the provider; signature hard-codes `edit` and `icon` | `inlineEditing()`: `configure` (columns), `columnSignature`, `provide` | provider forced by scanning definitions |
| Icons | — | — | built into `GridCell` | stays a column field rendered by the cell | — |
| Tree | `treePlugin`, `createTreeDataSource`, `treeColumns` | plugin, but replaces the whole plugin list | `Gridwright` owner components and duck-typing, `TreeProvider`, `GridBody` hierarchy ARIA, `GridTable` role, `tree` prop, core catalog keys | `treeData()`: `configure` (source, columns, row id), plugins with `suppressStage`, `provide`, `rowAttributes`, `tableAttributes`, messages | drops `plugins` and `onSelectionChange`; virtualized tree has no hierarchy ARIA |
| Virtualization | `core/virtual`, windowed source | source already | `Gridwright` body swap, scroll ref and height, pagination suppression, announcement flag | `virtualRows()`: `body`, `tableWrapper`, `suppresses`, `navigation`, `useVirtualScroll()` | duplicated row markup |
| Export | `getMatchingRows`, `fetchAllRows`, serializers | core service and pure functions | `Gridwright` (`export` prop, toolbar visibility), core catalog keys, labels; own live region | `exportMenu()`: `toolbar`, messages, `announce` | second live region |
| Report templates | pure functions | — | through `export.formats` | a format helper for `exportMenu()`; suffixes move to the export add-on's messages | untranslated " (Markdown)", " (PDF)" |
| Live region | — | — | fixed field list and priorities in `GridRoot` and `a11y/*` | shell keeps loading, error and range; add-ons contribute through `announce` | events.md priority list already stale |
| i18n | closed `MessageKey`, `TranslateFn`, catalog | infrastructure | closed `GridwrightLabels`, monolithic `labelsFrom` | per-add-on `messages`, `useAddonMessages`, widened `TranslateFn` | no way for an add-on to ship strings |

### Draft specs (not implemented)

| Spec | Engine verdict | Add-on verdict and slots | Seams this architecture adds for it | Spec defects to fix |
| :--- | :--- | :--- | :--- | :--- |
| multi-column-sorting | `toggleSort({ additive })` already cycles and chains | extends or replaces `sorting()`: `headerLabel`, `headerAttributes`, `announce`, messages | one-owner `headerLabel` with suppression | claims headers only toggle asc/desc; cites nonexistent `GridHeaderCell.tsx`, `src/plugins/sort/index.ts`; duplicates `toggleSort`; `multiSort` prop |
| selection-controls | core service | options on `selection()`: hide checkboxes, hide select-all, click and Space selection through `rowAttributes` and `tableKeyDown` | extra columns, row events, table keyboard handling | "options on `<Gridwright />`" principle; hand-maintained `colSpan`; assumes focusable `<tr>` |
| column-layout | none | `columnLayout()`: `headerAfter` (resize handle), `headerAttributes` and `cellAttributes` (width, sticky offset), `configure` (hidden columns), `columnSignature`, `toolbar` (picker), `tableAttributes` (CSS variables), messages | `columnSignature` contribution; extra columns counted for offsets | `columnPicker` prop; `pinned` on core `ColumnDef`; nonexistent `GridHeaderCell.tsx`; a "row action column" that does not exist |
| cell-navigation-and-clipboard | none | `cellNavigation()`: `tableKeyDown`, `cellAttributes` (roving tabindex), `useVirtualScroll()`, `announce`, messages | table keyboard handling with ordered ownership; virtual scroll API | `cellNavigation` prop; ignores the virtual body; a notification channel that does not exist |
| grouping-and-aggregation | `groupingPlugin` at `TRANSFORM` with discriminated rows, plugin-owned options and `invalidatePipeline` | `grouping()`: `renderRow` by kind, `rowAttributes`, `tableFooter`, messages | `renderRow`, `tableFooter`, `PipelineStage.skip` | `groupBy` in the closed `GridQuery`; invented `capabilities.group`; wrong stage number |
| view-state-sync | none | `urlSync()`: `configure` (`initialQuery` before the first fetch), a lifecycle component in `provide` using `query:change` and `setQuery` | `configure` runs before engine creation, so there is no double fetch | `syncWith` prop; nonexistent `engine.subscribeQuery()` and `engine.getQuery()` |

### Spec-kit hygiene found on the way

Six draft specs (`cell-navigation-and-clipboard`, `column-layout`, `grouping-and-aggregation`,
`multi-column-sorting`, `selection-controls`, `view-state-sync`) carry template stubs for six of their
eight artifacts. `data-export/spec.md` still says "Clarified" with unticked criteria that disagree with
the code (`getFilteredRows`, `pdf`). `specs/DEPENDENCY_MAP.md` draws `LayoutMod`, `NavMod`, `SyncMod`
as if they existed. Each is corrected or annotated by this change (see `tasks.md`).

## Options considered

### Option A — keep feature props, make parts slot-aware

**How it works.** `<Gridwright export columnFilters tree />` stays; parts read contributions; props map
to built-in add-ons internally.

**Rejected because.** The component still imports every feature, so nothing tree-shakes, and a prop is
still a privilege a third-party add-on does not get. The package is unpublished, so compatibility does
not argue for it.

### Option B — render props and `components={{ Header, Body }}` overrides

**How it works.** The component accepts replacement components per part.

**Rejected because.** Replacement is all-or-nothing: two features that both want the header (filters
and sort badges) cannot both replace it. It also gives no seam for engine configuration, messages or
announcements.

### Option C — a portal-based plugin registry

**How it works.** Add-ons register portals into named DOM targets.

**Rejected because.** It needs `react-dom` in the entry, loses context ordering, breaks the table
semantics (a portal into a `<tr>` is not a cell), and moves content out of the root where the theme,
language and direction are set.

### Option D — add-ons with typed contribution slots (chosen)

**How it works.** An add-on is `{ name, requires, setup }`. `setup` is a hook returning a contribution
of render functions and attribute functions for named slots, engine plugins and option transforms,
messages and announcements. `useGridwright` resolves them in order; the parts render them.

**Chosen because.** It covers every slot the audit found, composes several add-ons in the same slot,
keeps one-owner slots explicit, tree-shakes because the component imports nothing, gives third parties
exactly the built-ins' reach, and keeps the table semantics because the shell still renders the table,
rows and cells.

## Prior art

- **TanStack Table** is headless with feature modules; it has no UI and no slots, which is where this
  package differs.
- **AG Grid** has modules for tree-shaking and component overrides by name, with privileged internal
  features.
- **MUI X Data Grid** uses `slots` and `slotProps` for replacement, one component per slot, which is
  Option B.
- **ProseMirror and Tiptap** extensions contribute keymaps, node views and plugins in order, the
  closest model to Option D.

## Measurements

| Scenario | Before | After |
| :--- | ---: | ---: |
| React entry + chunks, unminified, with column filters built in | 185.4 kB | to be measured at stage 7 |
| An entry importing only `Gridwright`, bundled and tree-shaken | includes every feature | to be measured at stage 7 (AC-20) |

## Open questions

None blocking. Resolved in `spec.md` §7.
