# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

A changed default is treated as a breaking change even though nothing fails to compile: the
consumer's build stays green and their grid behaves differently, which is exactly what makes it
worth a major.

## [Unreleased]

### Added

- **Multi-column sorting shows its order** (minor). Shift-activating a header already added its
  column to the sort; now the reader can see and hear the result. See
  [docs/accessibility.md](docs/accessibility.md#sorting) and `specs/multi-column-sorting`.
  - While more than one column is sorted, each sorted header shows its priority in a
    `.gw-sort-priority` badge (`1`, `2`, `3`). The badge is `aria-hidden`, so the button's
    accessible name stays the header text.
  - The announcement names the priority while more than one column is sorted: "Salary, sort
    priority 2, sorted ascending". A single sorted column is announced exactly as before.
  - With `multiSort` on (the default), the sort button's `title` now says what Shift does: "Sort
    ascending (Shift: keep other columns sorted)". With `sorting({ multiSort: false })` it is
    unchanged.
  - New `gridwright:sorting` messages `sortedAscendingPriority`, `sortedDescendingPriority` and
    `actionWithShift`, translated in `de`, `es`, `fr` and `pl`. An override written against the
    existing keys keeps working.

- **Selection without checkboxes, and without select-all** (minor). Two options on `selection()`,
  reached as `coreAddons({ selection: { ... } })`. See [docs/api.md](docs/api.md) and
  `specs/selection-controls`.
  - `selectAll: false` drops the select-page checkbox from the checkbox column's header and keeps the
    row checkboxes. The header keeps a visually hidden name, a new `selectColumn` message translated
    in all five locales.
  - `selectOnRowClick: true` toggles a row when it is clicked. Clicks on controls in the row and
    clicks that end a text selection are left alone. With `cellNavigation()`, `Space` on a focused
    cell with no control in it toggles its row, which is the keyboard route when the checkboxes are
    off. Rows get `.gw-row--selectable`.

- **`rootAttributes`: an add-on slot for the grid's outermost element** (minor). Attributes an
  add-on contributes land on the root after the shell's own, so a theme's custom properties in
  `style` reach the toolbar, the table and the pager alike. The same allowlist as every attribute
  slot. See [docs/addons.md](docs/addons.md).
- **The core add-ons' decisions, exported** (minor). `ariaSortOf`, `nextSortAction`, `sortTitleOf`,
  `sortPriorityOf`, `sortAnnouncement`, `pageSelectionOf`, `selectionTableAttributes`,
  `selectionRowAttributes`, `selectionKeyDown`, `pageRangeOf`, `pageSizeChoices`,
  `DEFAULT_PAGE_SIZE_OPTIONS` and `pageFocusAfterChange` from `apsw-gridwright/react`: plain
  functions for another view of sorting, selection or pagination, so it says and does what the
  native one does. The native add-ons call them, and render exactly what they rendered before. See
  [docs/api.md](docs/api.md#what-the-core-add-ons-decide).
- **`apsw-gridwright-mui`**, a new package from this repository (`packages/mui`), is built on the
  two entries above. It has its own version and changelog (`packages/mui/CHANGELOG.md`) and needs
  this release. See [Using with MUI](README.md#using-with-mui).

- **A row menu that leaves the click to selection** (minor). `rowActions({ trigger:
  'hover-contextmenu' })`, also taken by `useBubbleMenu` and `<BubbleMenu>`, previews the menu on
  hover and focus and pins it on right-click and the context-menu key, but not on a left click. With
  `selection({ selectOnRowClick: true })` and the default trigger, one click both selected the row
  and pinned the menu over it. `BubbleMenuTrigger` gains the member. See `specs/row-actions-trigger`.

### Fixed

- **Reversing a column in a multi-column sort keeps its place** (patch). `toggleSort(id, { additive:
  true })` on an ascending column moved it to the end of `query.sort` as it turned descending, so
  reversing the primary sort quietly made it the last tie-breaker, and a remote source received the
  columns in the wrong order. It now changes direction where it stands.

- **The row menu stays on its row when the grid changes height** (patch). The `rowActions()` bubble
  kept the offset it had when it opened, measured from an anchor below the table. Expanding a tree
  folder or a detail panel moved that anchor, and the menu slid onto another row, over the toggle
  the reader was reaching for. `BubbleMenuView` now re-measures its row after every render.

- **Pinned cells stay opaque on hovered and selected rows** (patch). The hover and selected rules
  replaced a pinned cell's `--gw-surface` ground with the row's state colour. The default colours
  are opaque, so nothing showed, but a theme with translucent ones — `muiTheme()` maps
  `action.hover`, 4% black — let the columns scrolling underneath show through. The state colour is
  now laid over the ground. A second copy of the `.gw-row:hover .gw-cell` rule was also removed;
  hover still wins over selection, as it did.

## [0.11.0] — 2026-09-24

### Added

- **`cellNavigation()`: one Tab stop, then the arrow keys** (minor). Spreadsheet-style cursor
  movement across cells, the way the WAI-ARIA grid pattern describes it. See
  [docs/accessibility.md](docs/accessibility.md#cell-navigation),
  [docs/api.md](docs/api.md) and `specs/cell-navigation-and-clipboard`.

  ```tsx
  <Gridwright columns={columns} dataSource={source} addons={[cellNavigation()]} />
  ```

  - **Roving `tabIndex`, not `aria-activedescendant`.** Exactly one cell is tabbable and the arrows
    move which one, so the grid is one Tab stop rather than one per interactive element. The cell is
    really focused, so the browser announces its column header, its row position and its text from
    markup that already exists instead of the package reconstructing them.
  - `Home` / `End` jump along the row, `Ctrl`/`Cmd` with them to the first or last cell, and
    `PageUp` / `PageDown` by a page of rows. Left and right follow reading direction, so they are
    mirrored under `dir="rtl"`.
  - **No key fetches a page.** `Ctrl+End` goes to the last *loaded* row: when a paginating source
    sends no total the grid knows only that another page exists, so the last row of the result set
    is a row nobody has seen. Paging until the source ran out would be an unbounded number of
    requests from one keypress.
  - The cursor is keyed by row and column id, so a sort, a filter or a new page keeps it on the same
    cell when that cell is still there and falls back to the first cell when it is not — which is
    what keeps the grid at exactly one Tab stop.
  - **Arrow keys inside a form control are left alone**, so an inline editor keeps its caret. Over a
    `treeData()` grid, right and left expand and collapse a node before moving. Extra columns from
    other add-ons — the `selection()` checkbox, the `rowDetail()` toggle — are reachable with the
    arrows, and `includeExtraColumns: false` confines the cursor to data columns.
  - **A control inside a cell is operated from the cell, not tabbed to.** The selection checkbox,
    the tree and row detail toggles and the inline edit button carry `tabIndex="-1"` while the cursor
    visits their cell, so `Tab` leaves the grid in one press. `Enter`, `Space` or `F2` on the cell
    operates the control. `useCellTabIndex()` gives a cell renderer of your own the same behaviour.
    Only with the add-on listed: without it these controls render as before.
  - Nothing is announced when the cursor moves: the browser already says what the focused cell is,
    and a live region repeating it would speak over that on every arrow key. Its only strings are
    the two copy announcements.
  - **Composes with `virtualRows()`.** Moving past the mounted window scrolls the viewport to the
    row and focuses the cell once it renders. And because a cell that is not rendered cannot carry
    the tab stop, a cursor scrolled out of view falls back to the cursor's column in the first
    rendered row — a windowed grid always has exactly one Tab stop rather than none.
  - **Copy with the platform's own shortcut.** `Ctrl+C`, `Cmd+C` or `Ctrl+Insert` copies the
    selected loaded rows with a header row, or the cell under the cursor, as tab-separated text and
    an HTML table — cell text resolved as an export resolves it, formula-guarded and escaped. It runs
    in the browser's `copy` event rather than `navigator.clipboard`, so it needs no permission, works
    over plain HTTP and inside an iframe, and behaves the same on Windows, macOS, Linux and ChromeOS.
    The key is read from the keyboard layout (Dvorak, AZERTY and Cyrillic layouts all copy) and
    `AltGr+C` is never taken for copy. Announced in all five locales. `copy: false` switches it off.
  - New exports from `apsw-gridwright/react`: `cellNavigation`, `CELL_NAVIGATION_ADDON`,
    `cellNavigationMessages`, `useCellNavigation`, `useOptionalCellNavigation`, `useCellTabIndex`, and the types `ActiveCell`,
    `CellNavigationOptions` and `CellNavigationController`. New stylesheet class
    `.gw-cell--focused`. A grid that does not list the add-on renders identical markup — no cell
    gains a `tabIndex`.

### Fixed

- **Closing an inline editor from the keyboard keeps focus in the grid** (patch). `Enter`, `Escape`,
  choosing an option or toggling a checkbox closed the editor and dropped focus on `<body>`, so a
  keyboard reader who edited one cell had to find their way back into the table. Focus now returns
  to the cell's edit button. Clicking away still leaves focus where the click put it.
- **`markdownToHtml` judges a link's scheme with whitespace and control characters removed**
  (patch, hardening). A browser ignores some of those characters inside a scheme, so the check
  now looks at what the browser would read. No released version was exploitable: escaping already
  strips the other control characters and the link pattern refuses whitespace, so no input to
  0.10.0 renders a link that resolves to `javascript:`, `vbscript:` or `data:`. This keeps the
  check correct on its own if either of those changes. The one visible difference is that a
  target with DEL inside its scheme is now left as text instead of becoming a relative link.
- **The spreadsheet formula guard looks past leading spaces and control characters** (patch,
  hardening). A CSV export and both flavours of a clipboard copy now prefix `   =1+1` or `\n=cmd`
  with an apostrophe, as they already did `=1+1`. Excel reads such a cell as text, but LibreOffice's
  "Trim spaces" import and the Google Sheets importer trim it first and would then run the formula.
  The rule lives in one place now: the clipboard's HTML flavour, which is what a spreadsheet pastes,
  had its own copy and would otherwise have kept the old one. A leading tab or return is still
  prefixed whatever follows it. The visible difference is an apostrophe before a value such as
  ` -5` that starts with a space and then a sign. Thanks to #19 for the report.

## [0.10.0] — 2026-09-21

### Added

- **`columnLayout({ canChange })` now receives what the layout actually is, not only what was saved**
  (minor). A guard's second argument is `ColumnLayoutState`: the reader's overrides, and nothing
  else, because that is what round-trips through storage. A column pinned by its own
  `layout: { pinned: 'left' }` has no entry in it, so the documented "at most three pinned" rule
  counted changes rather than pinned columns and a grid with two declared pins went past its own
  limit — five pinned columns under a limit of three, which is what the playground showed.

  A third argument, `ColumnLayoutResolved`, answers what is painted: `order`, `pinOf`, `isHidden`,
  `widthOf` and `indexOf`. `ColumnLayoutController` extends the same interface, so the guard's
  `pinOf` *is* the controller's and the two cannot drift. It carries no `allows`, because `allows`
  is what calls the guard and a guard able to call it would recurse.

  ```tsx
  canChange: (change, layout, resolved) =>
      change.type !== 'pin' ||
      change.side === null ||
      resolved.order.filter((id) => resolved.pinOf(id) !== null).length < 3,
  ```

  Additive and optional: an existing two-argument guard still compiles and behaves identically.
  `ColumnLayoutResolved` is exported from `apsw-gridwright/react`.

### Fixed

- **"Show all columns" and "Reset layout" now say when `columnLayout({ canChange })` will refuse
  them** (patch). Both were guarded on commit, so a rule that refused them left two menu items that
  looked available and did nothing — the thing the guard's `aria-disabled` states exist to prevent.
  Neither carries a value a gesture decides, so the answer is knowable before the press, and they
  now carry `aria-disabled` exactly as a picker item and a pin toggle do. A refused reset also
  leaves the menu open; closing it was the one visible consequence of a change that did not happen.
  A grid that passes no guard is unaffected, and the guard is still asked only while the menu is
  open.

## [0.9.0] — 2026-09-18

### Added

- **The view in the URL: `urlSync()`** (minor). Search, sort, filters and page go in the address bar,
  so a reload keeps the view, a link shares it, and Back and Forward step through the pages the
  reader visited. See [docs/url-sync.md](docs/url-sync.md) and `specs/view-state-sync`.

  - Compact and readable: `?q=printer&sort=priority:desc&f=status:in:open:pending,score:gt:50&page=3`.
    Only what differs from the grid's own starting view is written.
  - Opening a link fetches once, straight into the linked view: it becomes the grid's initial query
    before the engine is created.
  - Filter values keep their type across the round trip (`score:gt:50` is a number, `code:eq:"50"`
    text), so a server receives what a click would have sent and a `select` filter finds its ticked
    choices again.
  - Every parameter is validated against the columns; anything unusable is dropped and the URL
    rewritten to what applied. `size` is capped by `maxPageSize`, so a link cannot ask for a million
    rows. Nothing is keyed by a parameter's name.
  - A page change adds a history entry, everything else replaces the current one after 300 ms. The
    grid's own correction of a page past the end never adds one, and under `virtualRows()` the page
    is not synced at all.
  - `prefix` for several grids on one page, `facets` to keep parts out, `push` and `debounceMs` for
    history, and an `adapter` for React Router, Next.js or any router. Other parameters and the hash
    are left alone.
  - The codec is exported on its own: `serializeGridQuery`, `parseGridQuery` and
    `formatSearchParams`.

## [0.8.0] — 2026-09-17

> The `0.7.0` tarball on npm was published from this tree rather than from the `v0.7.0` tag, so
> it already carries everything listed below. The registry's `0.7.0` and git's `v0.7.0` are not
> the same code. `0.8.0` is the first version where the number, the tag and the tarball agree.

### Added

- **Column reordering, inside `columnLayout()`** (minor). Drag a header into a new position, or
  press `Ctrl`/`Cmd` with an arrow on a focused one. See
  [docs/column-layout.md](docs/column-layout.md#reordering) and `specs/column-reordering`.

  - The drag is the browser's own — `draggable` and the native drag events — so the drag image, the
    drop cursor, `Escape` to cancel and the edge auto-scroll come from the platform. No
    drag-and-drop library and no runtime dependency. The column id travels on a private transfer
    type, never `text/plain`, so it cannot be dropped into whatever text field is on the page.
  - The keyboard route adds no Tab stop: it rides the header's existing sort button, and composes
    with the sorting add-on rather than replacing it, so the same header still sorts on a click.
  - `layout: { movable: false }` locks a column *and* stops anything being moved across it, so a
    column declared first stays first. `columnLayout({ reorderable: false })` switches the whole
    thing off and restores the previous markup exactly.
  - Dropping a column into a run of pinned columns pins it to that edge; dragging one out unpins it.
    A column painted between two frozen ones would scroll away and leave a hole.
  - The order goes through `configure` into the engine, so `api.getColumns()` reports it and an
    export writes its columns in it.
  - New controller members `order`, `indexOf`, `canMove` and `moveColumn`, and two new pure exports,
    `orderedColumns` and `moveInOrder`.
  - Announced by name and position, translated into `de`, `es`, `fr` and `pl`.

- **`rowDetail()`: expandable rows** (minor). A panel under a row holding whatever that row needs --
  a nested `<Gridwright />`, a form, a chart, the fields that did not earn a column. See
  [docs/row-detail.md](docs/row-detail.md) and `specs/row-detail`.

  ```tsx
  <Gridwright columns={columns} dataSource={source} addons={[rowDetail({ render: ({ data }) => <Lines of={data} /> })]} />
  ```

  - `render` is called only while a panel is open and a collapsed panel is unmounted, so a component
    that fetches its own data is the lazy load. There is no `loadDetail`: nothing but React needs the
    result, and owning the fetch would mean owning its cache, its errors and its abort.
  - **The panel is not a row of the grid.** `aria-rowcount` and every `aria-rowindex` describe the
    whole result set, so counting panels would mean counting ones on pages that were never fetched.
    The `<tr>` and its `<td>` are `role="presentation"` around a `role="region"` named after its row,
    and a test asserts the numbering is identical with a panel open and closed.
  - The toggle is a real `<button>` named for its row, with `aria-expanded`, and `aria-controls` only
    while the panel is in the document. Focus stays on it: a panel is content in a table, not a
    dialog.
  - `single`, `hasDetail`, `rowLabel`, `toggle: 'start' | 'end' | 'none'`, `canToggle`,
    `persistAcrossPages`, and `initialExpanded` with `onExpandedChange` for persisting what a reader
    opened. `useRowDetail()` gives a consumer's own control the same controller the built-in toggle
    uses, and `allows()` so the two cannot disagree.
  - `expandAll()` covers the rows the grid is holding and makes no claim about any other page. There
    is no "everything is expanded" flag, for the same reason there is no invented total.
  - Composes with `treeData()` (two independent expansions, and `render` receives your row rather
    than the node), `selection()`, `columnLayout()` and `rowActions()`. **Throws when listed with
    `virtualRows()`**, naming both: windowing places rows by a fixed height and a panel is as tall as
    its content.
  - Translated into `de`, `es`, `fr` and `pl`.

- **`rowAfter`, an add-on slot for rows after a row** (minor). Expandable rows, detail panels,
  nested tables, forms under a record, subtotals: anything that belongs *under* a row rather than in
  it. See [docs/addons.md](docs/addons.md#the-body) and `specs/row-detail`.

  - `rowAfter: (row, grid) => ReactNode | undefined` on `AddonContribution`. Unlike `renderRow` it
    is not owned — every add-on contributing one is asked, in add-on order, and every non-empty
    result renders — and it is asked for a row another add-on rendered through `renderRow` too.
    Both bodies render it, because both render rows through `GridRowOrCustom`.
  - `columnCountOf(grid)` is now exported: the `colSpan` that covers the table, extra columns
    included, and the same number the status row uses. `GridRowOrCustom` is documented as the part a
    body of your own renders per row.
  - The extra row is not a grid row. `aria-rowcount` and `aria-rowindex` describe the whole result
    set, so a row given `role="row"` would claim a position the grid cannot know for rows it has not
    fetched. The documented pattern is a presentational `<tr>` holding a labelled `role="region"`,
    and a test asserts the numbering is identical with and without contributed rows.
  - Nothing changes for a grid listing no add-on that contributes one: no wrapper element, and no
    array allocated per row.

- **`coreAddons(options)` configures a core add-on without rebuilding the list** (minor).
  `coreAddons({ sorting, selection, pagination })` passes each bag to the add-on of that name, so
  turning the checkbox column off is one prop:

  ```tsx
  <Gridwright selectionMode="multiple" coreAddons={coreAddons({ selection: { checkboxes: false } })} ... />
  ```

  The option itself, `selection({ checkboxes })`, is unchanged and already existed; what was missing
  was a way to reach it that did not mean spreading `coreAddons()`, filtering it by name and
  appending a replacement. Dropping an add-on outright is still a list operation, and
  `coreAddons={false}` still renders none. Documented with the caveat that `checkboxes: false`
  removes the only control that selects a row until `specs/selection-controls` is implemented.

- **`columnLayout()`: column resizing, pinning and visibility** (minor). One add-on, because a
  pinned column's offset is the sum of the widths of the pinned columns before it, so resizing one
  moves the rest and hiding one collapses the gap it left. See
  [docs/column-layout.md](docs/column-layout.md).

  ```tsx
  <Gridwright columns={columns} dataSource={source} addons={[columnLayout()]} />
  ```

  - A resize handle in every header: a focusable `role="separator"` carrying `aria-valuenow`, driven
    by pointer or by arrow keys, `Home` for the minimum and `Enter` or a double-click to fit the
    content. A drag re-renders nothing — widths are CSS custom properties on the `<table>`, so the
    browser repaints one column and the width commits to state on release.
  - Sticky pinning to either edge, at offsets computed from the committed widths, as logical insets
    so "pinned to the start" is correct in a right-to-left page. Another add-on's extra column — the
    `selection()` checkbox — follows the data columns onto the start edge, through
    `extraHeaderAttributes` and `extraCellAttributes`.
  - A column picker in the toolbar: a `role="menu"` of `menuitemcheckbox` items grouped the way the
    table paints the columns, with "Show all columns" and "Reset layout". Hiding writes
    `ColumnDef.hidden` through the add-on's `configure`, so the engine and every export agree with
    what the reader can see.
  - `columnLayout({ initial, onChange })` saves and restores the whole layout as plain JSON.
    `onChange` is not called on mount, so a handler that writes to storage cannot overwrite a saved
    layout on every page load, and `initial` is read field by field so a corrupted entry costs the
    reader their widths rather than their grid.
  - New column option `layout: { resizable, pinned, hideable, maxWidth }`, declared by module
    augmentation of `GridwrightColumn` exactly as `filter` and `edit` are. Optional, so no existing
    column definition stops compiling.
  - **`columnLayout({ canChange })` refuses a layout change your rules do not allow**, without
    replacing the controls that request it. It is asked before every change the add-on commits — a
    width, a pin, a visibility toggle, a move, "show all" and "reset" — and receives a described
    change and the whole `ColumnLayoutState`, so "at most three pinned" is expressible and so is a
    per-column lock for pinning, which no column option has. It **narrows and never widens**: a
    column declared `movable: false` stays locked whatever a guard returns. `useColumnLayout().allows(change)`
    answers the same question without making the change, which is what the picker's items and pin
    toggles disable themselves from, and what a control of your own should ask. No new string: only
    your application can phrase its own policy. A guard that throws allows the change and reports
    it. See [docs/column-layout.md](docs/column-layout.md#refusing-a-change) and
    `specs/column-layout-guards`. *(This shipped in `0.8.0` and was omitted from the list below.)*
  - New exports from `apsw-gridwright/react`: `columnLayout`, `COLUMN_LAYOUT_ADDON`,
    `columnLayoutMessages`, `GridColumnPicker`, `GridResizeHandle`, `useColumnLayout`,
    `useOptionalColumnLayout`, `useColumnLayoutController`, `ColumnLayoutProvider`, and the pure
    helpers `stickyOffsets`, `columnWidthProperty`, `columnWidthVar`, `clampWidth`, `autoFitWidth`
    and `pixelWidth`, with their types — including `ColumnLayoutChange`, the described change a
    guard receives.
  - New stylesheet custom properties `--gw-pinned-shadow-start` and `--gw-pinned-shadow-end`, and
    the per-column `--gw-col-w-<column id>` set on the table.
  - Translations for `de`, `es`, `fr` and `pl`.

  Two things a grid inherits by listing the add-on, neither of which breaks a build: the table gets
  `table-layout: fixed` so a dragged edge stays where it was dropped, and its cells truncate with an
  ellipsis instead of wrapping so a row's height does not change while an edge is dragged. Both
  arrive on the add-on's own class, so a grid that does not list it renders exactly what it did
  before. A column whose `width` is not a pixel count (`'20%'`, `'auto'`) has no number to add into a
  sticky offset and renders at `defaultWidth` until it is resized.

  Global search still reads a hidden column: `hidden` says what is rendered and what an export
  covers, `searchable` says what search reads, and they stay two switches because they are two
  questions.

### Changed

- **`ColumnLayoutState` gained a required `order: readonly string[]`.** For the documented uses —
  receiving the state from `onChange`, handing a `Partial<ColumnLayoutState>` back through `initial`
  — nothing changes, because one is a read and the other is already partial. It breaks exactly one
  thing: code that builds a complete `ColumnLayoutState` object literal by hand now has to add
  `order`. A compile error with an obvious fix, no silent behaviour change, and the only
  version on the registry already carries the required field. `order?:` was rejected because the other three
  fields are required and a layout always has an order.
- **Every movable header is now `draggable`**, which changes what click-and-hold does on it.
  `columnLayout({ reorderable: false })`, or `layout: { movable: false }` per column, restores the
  previous markup.

### Fixed

- **A paginating source's total is no longer thrown away, trapping the reader on page one.** The
  filtering and search stages returned `{ rows, totalRows: rows.length }` even when they had nothing
  to do -- no filters set, no search term. A source that pages for itself and reports a total leaves
  both stages running, because it resolves neither facet, so the declared total was overwritten with
  the length of the page that had arrived. `hasNextPage` was then false, "Next page" was disabled,
  and the grid claimed the result set was one page long.

  This hit `capabilities: { paginate: true, sort: false, filter: false, search: false }` -- the
  common real case, an endpoint that only pages. A stage that does nothing now returns the rows
  unchanged and leaves the total alone; a stage that really narrows the rows still reports the
  narrowed count.

- **The page size control no longer misreports the page size.** `<select value={pageSize}>` was
  rendered with options that need not contain `pageSize`, and a `<select>` whose value is not among
  its options shows the first one instead. A grid with `pageSize={5}` and the default
  `[10, 25, 50, 100]` therefore said "Rows per page: 10" while showing five rows, and once the
  reader changed it there was no way back to five. The grid's own page size is now always one of the
  choices, inserted in order.

- **A `<table>` inside a grid no longer drives the grid's keyboard.** `GridTable` put its
  `onKeyDown` on the table element, so a keydown from any nested table — a grid in a detail row,
  most obviously — bubbled up and every `tableKeyDown` contributor acted on it. The handler now
  ignores an event whose closest `<table>` is not its own. Reachable before this release through a
  cell renderer, and reachable far more easily through `rowAfter`.

- **A sentence said through `instance.announce` was overwritten by the next render.** The live
  region watches the grid's labels for a language change, and the labels were rebuilt on every
  render because they were memoised on the grid instance, which is a new object each time. Any
  render in the same tick as an announcement replaced it with the row range before it could be read.
  Labels are now memoised on what they are built from, the translator and the label overrides.

## [0.7.0] — 2026-09-15

Every feature is an add-on, filtering by column, one report template as a Markdown file and a PDF,
a security gate with no exceptions, and an API reference for every prop and option.

### Breaking: every feature is an add-on

The package is unpublished, so nothing is deprecated first: the prop-based API is gone. See
[docs/addons.md](docs/addons.md) and `specs/addon-architecture`.

- **`<Gridwright />` is a shell, and features are `addons`.** The component renders a table, its
  rows, the status rows and one live region. Sorting, selection, pagination and the stale-rows notice
  are `coreAddons()`, on by default; everything else is listed:

  | Before | After |
  | :--- | :--- |
  | `searchable` | `addons={[search()]}` |
  | `columnFilters` | `columnFilters()` |
  | `export={options}` | `exportMenu(options)` |
  | `rowActions={items}`, `rowActionsTrigger` | `rowActions({ items, trigger, placement })` |
  | `onCellEdit={commit}` | `inlineEditing({ commit })` |
  | `tree={options}`, `<TreeGridwright>`, `useTreeGridwright` | `treeData(options)`; the controller through `controllerRef` |
  | `virtual={options}`, `renderSkeleton` | `virtualRows({ rowHeight, overscan, height, renderSkeleton })` |
  | `hidePagination`, `pageSizeOptions` | `coreAddons` without `pagination()`, or `pagination({ pageSizeOptions })` |
  | `renderEmpty`, `renderLoading`, `renderError` | an add-on contributing `status` |
  | `Gridwright.ExportMenu`, `.FilterProvider`, `.FilterTrigger`, `.FilterClear`, `.RowActions`, `.VirtualBody` | the named exports |

  The remaining props are the data and engine options, the i18n props, `instance`, `className`,
  `classNames`, `toolbar`, `footer`, `caption`, `onRowClick`, `aria-label`, `addons`, `coreAddons`,
  `corePlugins` and `plugins`. A changed list of add-on names remounts the grid.
- **`plugins` adds to the core plugins.** It used to replace them, so passing one plugin silently
  dropped pagination. A plugin named like a core plugin replaces that one; `corePlugins: false`
  installs none. Two plugins with one name throw.
- **Strings belong to their add-on.** `MessageKey`, `MessageCatalog` and `GridwrightLabels` keep only
  the shell's strings (loading, empty, the error row, the row range and total). A feature's strings
  are overridden as `messages={{ 'gridwright:filters.apply': 'Go' }}` or through `translate`, which is
  now called with any `string`. The packs in `apsw-gridwright/locales` translate every built-in add-on
  under a new `addons` section, so `locale={pl}` still translates the whole grid.
- **The parts render contributions.** `GridHeader` and `GridBody` lose `showSelection`, `GridBody`
  loses its render props and `onRowClick` (on `GridwrightProvider` now), `GridToolbar` loses
  `searchable`, `GridTable` loses `scrollRef` and `maxHeight`, and `GridVirtualBody` loses
  `showSelection` and `onRowClick`. A layout composed by hand renders `GridRoot`, which applies the
  add-ons' providers and overlays.
- **The export menu speaks through the grid's live region.** `GridExportController.message` is gone;
  an export announces through `instance.announce`.
- **`treePlugins()` returns only the tree plugin.** It suppresses the core filter, search and sort
  stages instead of replacing the plugin list, so it composes with pagination and with plugins of
  your own.

### Added

- **The add-on contract.** `GridAddon` and `AddonContribution`, with slots for the engine
  (`configure`, `plugins`, `columnSignature`), composition (`provide`, `suppresses`, `navigation`),
  the toolbar and around the table, the table and its wrapper and keyboard, the header, extra columns,
  the body, rows, cells, status rows, announcements and strings. The built-in add-ons use nothing
  else, and a test builds a third-party add-on from the public exports that reaches every slot.
- **Add-on tools.** `useAddonMessages`, `addonMessages`, `useGridContributions`, `useVirtualScroll`,
  `GridRoot`, `GridSlot`, `GridRowView`, `GridRowOrCustom`, `GridStatusBody`, `headerContentOf`,
  `mergeAttributes`, `orderAddons`, `resolveContributions`, `addonNamesOf`, `auditAddonMessages`,
  `instance.announce` and `instance.contributions`.
- **Engine seams.** `PluginContext.suppressStage(stageId)`, reference-counted and released with the
  plugin; `PipelineStage.skip(context)`; `GridApi.removePlugin(name)`; `corePlugins`.
- **Column options of your own**, added to `GridwrightColumn` by module augmentation of
  `'apsw-gridwright/react'`.
- **Filtering by column, as one add-on.** `addons={[columnFilters()]}` puts a filter button in every
  filterable header and a "Clear filters" button in the toolbar while any filter is on. The engine
  has filtered since 0.1; the component had no control that could set a filter, and the README said
  filtering was "already there". A column declares what it holds with `filter: { type }`: `text`
  (the default), `number`, `date` or `select` with `choices`, and the type decides the conditions
  offered; `filter.operators` narrows them. Every condition is an existing `FilterOperator`, and the
  dialog calls `api.setFilter`, so the pipeline applies the filter to an array and a source
  declaring `filter: true` receives it in `query.filters` unchanged. Nothing is applied until
  Apply, so a server is asked once per decision. Off by default, so no existing grid changes.
- **The filter parts are exported.** `ColumnFilterProvider`, `ColumnFilterTrigger`,
  `GridFilterClear` and `COLUMN_FILTER_OPERATORS` from `apsw-gridwright/react`, with the
  types `ColumnFilterType`, `ColumnFilterChoice` and `ColumnFilterOptions`. `GridHeader` draws the
  triggers whenever it is inside a provider. `classNames` gains `filterTrigger` and
  `filterDialog`; a filtered header cell carries `data-filtered="true"`.
- **The filter dialog is operable by keyboard and announced.** The trigger is a button beside the
  sort button with `aria-haspopup="dialog"`, `aria-expanded` and a name that says whether the
  column is filtered. The dialog is `aria-modal`, rendered outside the table so it never joins a
  column header's accessible name, keeps Tab inside it, and returns focus to the trigger on
  Escape, Apply and Clear. The live region says "{column}, filtered" and "{column}, filter
  removed". Thirty message keys in all five locales: `filter.*`, `filter.op.*`,
  `a11y.filterApplied` and `a11y.filterCleared`, behind eleven labels.
- **[docs/filtering.md](docs/filtering.md)**, covering the types and their conditions, where the
  filter runs, the wire format and composing the parts by hand.
- **One report template, as a Markdown file and as a PDF.** `markdownReportFormats(options)` from
  `apsw-gridwright/react` returns export menu entries for one template whose `{columnId}`
  placeholders read the grid's columns: a `.md` download and a print-to-PDF entry, rendered from the
  same rows so the two cannot disagree. Options: `header`, `footer`, `separator`, `title`, `print`,
  `outputs` and `labels`. Types `MarkdownReportOptions` and `MarkdownReportOutput`. Previously every
  project wrote the two serializers around a template by hand.
- **[docs/api.md](docs/api.md)**, every prop, column field and add-on option with its type and
  default. The workflow now requires it to change in the same change as the surface it describes.

### Removed

- **`classNames.footer`.** Nothing rendered it, so setting it did nothing.

### Fixed

- **A tree loads children in development again.** Strict Mode's double effect destroyed the tree
  controller on mount, after which expanding a lazy folder silently never fetched.
- **A remote sort is announced.** The live region compared the settled state with the loading one,
  found the sort unchanged, and said the row range instead of the column that was sorted.
- **A windowed tree carries its hierarchy.** The windowed body rendered rows without `aria-level`,
  `aria-expanded` or the sibling position.
- **A column changed after the first render now reaches the grid.** `<Gridwright />` memoised its
  columns on each column's id, `edit` and `icon`, so hiding a column, renaming its header or
  changing `sortable` in a later render left the engine holding the columns from before. The memo
  now keys on everything the engine reads, and with editing off the columns are not memoised at all.
  Found while building column filters, where hiding a filtered column is an ordinary thing to do.
- **A misspelled capability is reported.** `createLocalDataSource`, `createRemoteDataSource` and
  `createRestDataSource` spread `capabilities` over their defaults, so `{ pagination: false }` from
  JavaScript kept the default for `paginate` without a word, and the grid and the server silently
  disagreed about who pages. An unknown key, or a value that is not a boolean, now logs a
  `console.warn` naming the source and the four valid facets; the default still stands. The
  playground itself shipped with that typo, which is how it was found.
- **The print frame is always removed.** `printHtmlDocument` removed its iframe on `afterprint`
  and promised a fallback timer for browsers that never fire it, but had no timer, so each print in
  such a browser left a copy of the report in the page. It now removes the frame after 60 seconds
  if the event never comes.
- **The playground's paging endpoint receives filters.** The page's fetcher never sent `filters`, so
  the "filter" capability switch changed a badge and nothing else, and the export of every matching
  row ignored them too. The mock server now implements every operator the filter controls send.

### Security

- **Add-ons cannot reach an HTML sink.** Attributes an add-on contributes pass an allowlist at runtime
  (handlers as functions, `aria-*` and `data-*` as scalars, and a short list of inert attributes), so
  no markup, children, URL attribute or string handler can arrive through an extension point.
- **The print document can no longer run scripts.** `printHtmlDocument` built the report in a
  same-origin iframe through `srcdoc` with no `sandbox`, so any `<script>` that reached the document
  through `formatPrintDocument` markup, a template or the `print.styles` option ran with the host
  page's rights. The frame is now sandboxed with `allow-same-origin allow-modals` and no
  `allow-scripts` before it receives content.
- **A blocking security gate.** `scripts/security-audit.mjs` (in the pre-commit hook, `npm run
  verify` and CI) refuses HTML sinks, script sinks, unsandboxed iframe documents, `target="_blank"`
  without `noopener`, `postMessage` to `'*'`, prototype writes, package-only hazards (`window.open`,
  process execution, computed imports, `console.log`), runtime dependencies, install scripts, a
  widened `files` list, weakened `.npmrc` settings, and bundles or source maps that carry sinks or
  absolute paths. ESLint enforces the same list in the editor, and disabling a security lint rule
  inline is itself refused. A new `application_security` skill documents the threat model and the
  safe replacements; `SECURITY.md` describes private reporting.
- **The playground server is local and narrow.** It listened on every interface and served the whole
  repository, `.git` included, and its traversal guard was a `startsWith` check that a sibling
  directory named `apsw-gridwright-…` passed. It now binds to `127.0.0.1` unless `HOST` is set,
  serves only `dist/` and `examples/`, refuses dotfiles and `node_modules`, checks paths with
  `path.relative`, caps request bodies at 1 MB and artificial latency at 5 seconds, validates the
  `filters` parameter field by field, and sends `nosniff`, `DENY` framing and `no-referrer` headers.
- **No known vulnerabilities in the toolchain.** vitest 2 carried two critical advisories (arbitrary
  file read and execution through the UI server, path traversal through mock redirects) and pulled in
  vulnerable vite and esbuild releases. The toolchain is now vitest 5, vite 8 and esbuild 0.28 (by
  override for tsup), `npm audit` reports nothing, and CI blocks on any advisory. `.npmrc` no longer
  disables `npm audit`.

### Changed

- **Node 22.12 or newer.** The patched test toolchain does not run on Node 18 or 20, both past end of
  life, so `engines` and the CI matrix move to Node 22 and 24. The published code has no runtime
  dependencies and targets ES2021; what changes is the range this repository tests and supports.


## [0.6.0] — 2026-09-12

Exporting: comma-separated text, an Excel spreadsheet, Markdown and print-to-PDF from one prop, with
no runtime dependency, Markdown report templates, formats of your own, and the reader choosing which
rows go into the file.

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
- **The reader chooses the rows in the export menu.** Unless `scope` fixes it, a "Rows" group of
  `menuitemradio` items sits above the formats: all matching rows, this page, and the selected
  rows with their count. An item that cannot be exported is `aria-disabled`, stays reachable, and
  "All matching rows" carries the reason, so a paginating source without `fetchAll` offers the page
  and the selection instead of failing on every format. `useGridExport` returns the same choice as
  `scope`, `setScope`, `isScopeAvailable` and `selectedCount`, and `exportAs` takes a scope for one
  call. `GridApi.canFetchAllRows()` answers without fetching. Six message keys in all five locales:
  `export.rows`, `export.scopeAll`, `export.scopePage`, `export.scopeSelected`,
  `export.allUnavailable` and `export.failed`.
- **A failed export says so in the reader's language.** The alert shows a translated sentence
  about the rows, never the thrown message, which named internals such as the source's `kind` and
  stayed English under every locale. The thrown error goes to `onError`, or to `console.error`
  when there is none.
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

[Unreleased]: https://github.com/yaotzin1/apsw-gridwright/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.11.0
[0.10.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.10.0
[0.9.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.9.0
[0.8.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.8.0
[0.7.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.7.0
[0.6.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.6.0
[0.5.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.5.0
[0.4.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.4.0
[0.3.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.3.0
[0.2.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.2.0
[0.1.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/v0.1.0
