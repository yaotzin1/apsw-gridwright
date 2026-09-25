# API reference

Every prop, option and column field, with its type, its default and what it does. The feature pages
explain *why*; this page is for looking something up.

It is kept in step with the types: a change to a prop, an option or a column field updates this page
in the same change. The types themselves are the final word: `GridwrightProps` and
`UseGridwrightOptions` in `src/react/types.ts`, `ColumnDef` in `src/core/types.ts`, and each add-on's
options type beside its factory.

- [`<Gridwright />` and `useGridwright`](#gridwright-and-usegridwright)
- [Columns](#columns)
- [Core add-ons](#core-add-ons): `sorting`, `selection`, `pagination`, `staleNotice`
- [Add-ons](#add-ons): `search`, `columnFilters`, `exportMenu`, `rowActions`, `inlineEditing`,
  `treeData`, `rowDetail`, `virtualRows`, `urlSync`
- [Parts](#parts), for a layout composed by hand
- [Class names](#class-names)

`TRow` is your row type throughout.

## `<Gridwright />` and `useGridwright`

`<Gridwright />` takes everything in the three tables below. `useGridwright(options)` takes the
**Data and engine** and **Features** tables and returns the instance you pass to `<Gridwright
instance>` or `<GridwrightProvider instance>`.

### Data and engine

| Prop | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `columns` | `GridwrightColumn<TRow>[]` | required | The columns. See [Columns](#columns). May be written inline: the engine only re-resolves them when something it reads changes. |
| `data` | `readonly TRow[]` | — | An in-memory array. Replacing the array updates the grid. Use this or `dataSource`, not both. |
| `dataSource` | `DataSource<TRow>` | — | Anything else: `createRemoteDataSource`, `createRestDataSource`, `createWindowedDataSource`, or your own. A new source object refetches. |
| `getRowId` | `(row, index) => RowId` | the row's `id` property, else its index | A row's stable identity. Selection, row menus and edits are keyed on it. |
| `initialQuery` | `Partial<GridQuery>` | no sort, no filters, empty search, page 0 | The query the grid starts with: `sort`, `filters`, `search`, `pagination`. |
| `pageSize` | `number` | `25` | Rows per page. Under `virtualRows()`, the size of each fetched window. Changing it on a live grid applies it. |
| `selectionMode` | `'none' \| 'single' \| 'multiple'` | `'none'` | Whether rows can be selected, and how many. `multiple` also draws the checkbox column, which `coreAddons({ selection: { checkboxes: false } })` removes without turning selection off. |
| `keepPreviousData` | `boolean` | `true` | Keep the current rows on screen while the next ones load, instead of an empty table. |
| `queryDebounceMs` | `number` | `0` | Waits this long after the last query change before fetching. Useful for a remote search box. |
| `plugins` | `GridPlugin<TRow>[]` | `[]` | Engine plugins added to the core set. One named like a core plugin (`gridwright:sorting`) replaces it. Reconciled by name on a live grid. See [plugins](plugins.md). |
| `corePlugins` | `boolean` | `true` | `false` installs none of the core pipeline stages: filtering, search, sorting and pagination are then yours. |
| `onQueryChange` | `(query: GridQuery) => void` | — | After the sort, filters, search or page change. |
| `onSelectionChange` | `(ids: RowId[], rows: TRow[]) => void` | — | After the selection changes. Under `treeData()`, `rows` are your rows, not tree nodes. |
| `onError` | `(error: GridError) => void` | — | After a fetch fails. The grid shows the failure either way. |

### Features

| Prop | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `addons` | `GridAddon<TRow>[]` | `[]` | Features, after the core add-ons: `[search(), columnFilters(), exportMenu()]`. A changed list of names remounts the grid. See [add-ons](addons.md). |
| `coreAddons` | `GridAddon<TRow>[] \| false` | `coreAddons()` | The add-ons every grid starts with: sorting, selection, pagination, the stale-rows notice. `coreAddons(options)` configures one (`{ selection: { checkboxes: false } }`); any list replaces them; `false` renders none. |

### Presentation and translation (`<Gridwright />` only)

| Prop | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `instance` | `GridwrightInstance<TRow>` | — | Render an instance from `useGridwright` instead of building one. Its own add-ons apply; `addons` and `coreAddons` here are ignored. |
| `aria-label` | `string` | — | The table's accessible name. Give every grid one, or a `caption`. |
| `caption` | `ReactNode` | — | A visible `<caption>` for the table. |
| `className` | `string` | — | Added to the root element. |
| `classNames` | `Partial<GridwrightClassNames>` | — | A class for each part. See [Class names](#class-names). |
| `toolbar` | `ReactNode` | — | Your own toolbar content, after every add-on's. Its presence makes the toolbar render. |
| `footer` | `ReactNode` | — | Rendered after the table and after every add-on's below-table content. |
| `onRowClick` | `(row: GridRow<TRow>) => void` | — | A click on a row. Clicks on a checkbox or on an editable cell do not reach it. |
| `locale` | `string \| LocaleCatalog` | `'en'` | A pack from `apsw-gridwright/locales` (`pl`, `de`, `es`, `fr`) translates everything. A bare tag (`'en-GB'`) changes number formatting, plural rules and direction only. |
| `messages` | `MessageOverrides` | — | Override single strings: the shell's (`'status.empty'`) or an add-on's under its name (`'gridwright:filters.apply'`). |
| `translate` | `(key, values) => string` | — | Hand every string to an i18n library (`translate={t}`). Returning the key itself falls back to the catalog. See [translation](i18n.md). |
| `labels` | `Partial<GridwrightLabels>` | — | The shell's own strings, applied last: `loading`, `empty`, `errorTitle`, `retry`, `rowsShown(from, to, total, exact)`, `rowsTotal(count)`. |

### What `useGridwright` returns

| Field | Type | What it is |
| :--- | :--- | :--- |
| `api` | `GridApi<TRow>` | The engine: `setSort`, `setFilter`, `setSearch`, `setPage`, `toggleRowSelection`, `refresh`, `use`, `removePlugin` and the rest (README, "Engine"). |
| `state` | `GridState<TRow>` | `status`, `query`, `rows`, `totalRows`, `isTotalExact`, `selectedIds`, `error`, `version`, `meta`. |
| `columns` | `ResolvedColumn<TRow>[]` | The columns with their defaults applied. |
| `definitions` | `Map<string, GridwrightColumn<TRow>>` | Your column objects by id, as configured by the add-ons. |
| `contributions` | `ResolvedContributions<TRow>` | Every add-on's contribution, resolved. |
| `announce` | `(sentence: string) => void` | Say a sentence through the grid's live region. |

## Columns

A column is a plain object. Only `id` is required.

### What the engine reads

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `id` | `string` | required | Unique. Also the property read when there is no `accessor`, and the `{placeholder}` name in report templates. |
| `header` | `string` | the `id` | The header text, and the column's name in announcements and filter labels. |
| `accessor` | `keyof TRow \| (row) => value` | the property named by `id` | How the value is read from a row. |
| `sortable` | `boolean` | `true` | `false`: no sort button, and `toggleSort` and the in-memory sort ignore the column. |
| `filterable` | `boolean` | `true` | `false`: no filter button under `columnFilters()`, and the in-memory filter ignores a filter on it. A source that filters for itself still receives whatever was set through `api.setFilter`. |
| `searchable` | `boolean` | `true` | `false`: global search skips this column. |
| `hidden` | `boolean` | `false` | Not rendered. It still sorts, filters and searches. |
| `width` | `number \| string` | automatic | The column's width: pixels, or any CSS length. |
| `minWidth` | `number` | — | The narrowest it may get, in pixels. |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` | Text alignment of the header and the cells. `end` for numbers. |
| `comparator` | `(a, b, rowA, rowB) => number` | type-aware: numbers numerically, text by locale, empty values together at one end | How two values sort. |
| `filterFn` | `(value, filter, row) => boolean` | the operator's standard test | How a filter matches a value, when the pipeline filters in memory. |
| `formatValue` | `(value, row) => string` | the value as text; empty for null, ISO for a date, joined for an array | The text a cell shows by default, that search matches, and that exports write. |
| `exportValue` | `(value, row) => string` | `formatValue` | The text exports write, when it should differ from the screen: `120000` rather than `$120,000`. |
| `exportable` | `boolean` | `true` | `false` leaves the column out of every export. For a column of buttons. |
| `meta` | `Record<string, unknown>` | — | Anything of yours. The engine never reads it; a plugin or renderer can. |

### What React renders

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `cell` | `(context) => ReactNode` | the column's text | The cell's content. `context`: `value`, `row`, `rowId`, `rowIndex`, `column`, `api`. |
| `headerCell` | `(context) => ReactNode` | `header` | The header's content, inside the sort button. `context`: `column`, `api`, `sortDirection`. |
| `icon` | `(context) => ReactNode` | — | A glyph before the cell's content, per row, hidden from screen readers. |

### Read by add-ons

| Field | Read by | Type | What it does |
| :--- | :--- | :--- | :--- |
| `filter` | `columnFilters()` | `ColumnFilterOptions` | What the column holds, and so which conditions and input its filter offers. |
| `edit` | `inlineEditing()` | `ColumnEditOptions<TRow>` | Makes the column editable in place. |
| `layout` | `columnLayout()` | `ColumnLayoutColumnOptions` | Whether the column resizes, which edge it pins to, and whether it may be hidden. |

**`filter`**

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `type` | `'text' \| 'number' \| 'date' \| 'select'` | `'text'` | Decides the conditions: text contains, starts with…; number greater than, between…; date on, after, before…; select is any of. |
| `choices` | `{ value, label }[]` | — | For `select`: the values offered. `value` is compared and sent; `label` is shown, already translated. |
| `operators` | `FilterOperator[]` | every operator of the type | Narrows or reorders the conditions. The first is where a new filter starts. |

**`edit`**

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `editable` | `boolean \| (row) => boolean` | `true` | Whether this row's cell can be edited. |
| `inputType` | `'text' \| 'number' \| 'date' \| 'checkbox' \| 'select'` | `'text'` | The built-in editor's input. |
| `choices` | `{ value: string, label: string }[]` | — | For `select`: the options. |
| `parse` | `(input: string) => value` | numbers for `number`, booleans for `checkbox`, else the text | Turns what was typed into the value committed. |
| `editor` | `(context) => ReactNode` | — | Replaces the built-in editor. `context`: `value`, `row`, `rowId`, `column`, `commit(next)`, `cancel()`. |

**`layout`**

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `resizable` | `boolean` | `true` | `false` removes the resize handle from this header. |
| `pinned` | `'left' \| 'right'` | unpinned | Which edge the column starts frozen against. Applied as a logical offset, so `left` is the start of the row. |
| `hideable` | `boolean` | `true` | `false` shows the column in the picker checked and refusing to be unchecked. |
| `movable` | `boolean` | `true` | `false` keeps the column where it is, and stops anything being moved across it. |
| `maxWidth` | `number` | none | The widest the column may be dragged. |

The column's own `width` and `minWidth` are the starting width and the floor; see
[column layout](column-layout.md).

An add-on of yours adds its own column field by module augmentation; see
[column options of your own](addons.md#column-options-of-your-own).

## Core add-ons

On by default through `coreAddons()`. Configure one without rebuilding the list by passing
`coreAddons(options)` back to the prop of the same name:

```tsx
// Multi-row selection, no checkbox column.
<Gridwright selectionMode="multiple" coreAddons={coreAddons({ selection: { checkboxes: false } })} ... />
```

| Option | Type | Passed to |
| :--- | :--- | :--- |
| `sorting` | `SortingOptions` | `sorting()` |
| `selection` | `SelectionOptions` | `selection()` |
| `pagination` | `PaginationOptions` | `pagination()` |

Dropping one entirely is still a list operation:
`coreAddons().filter((a) => a.name !== 'gridwright:pagination')`. `coreAddons={false}` drops all four.

### `sorting(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `multiSort` | `boolean` | `true` | Shift-activating a header adds its column to the sort instead of replacing it. With it on, a Shift-activated sorted column reverses in place and then leaves the sort, and the button's `title` says what Shift does. |

While more than one column is sorted, each sorted header's button holds
`<span class="gw-sort-priority" aria-hidden="true">{n}</span>`, its 1-based place in `query.sort`.

| Message (`gridwright:sorting.*`) | English |
| :--- | :--- |
| `ascending`, `descending`, `clear` | "Sort ascending", "Sort descending", "Clear sort": the button's `title`, naming the next action |
| `actionWithShift` | "{action} (Shift: keep other columns sorted)": the `title` while `multiSort` is on |
| `sortedAscending`, `sortedDescending`, `sortCleared` | "{column}, sorted ascending", "{column}, sorted descending", "{column}, not sorted" |
| `sortedAscendingPriority`, `sortedDescendingPriority` | "{column}, sort priority {priority}, sorted ascending" (or descending), while more than one column is sorted |

### `selection(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `checkboxes` | `boolean` | on when `selectionMode` is `multiple` | The checkbox column, with a select-page checkbox in its header. |
| `count` | `boolean` | `true` | The "3 selected" count in the toolbar, shown only while a toolbar is shown for something else. |
| `selectAll` | `boolean` | `true` | The select-page checkbox in the checkbox column's header. Off, the header holds the column's name (`selectColumn`, "Selection") for screen readers only, and the row checkboxes stay. |
| `selectOnRowClick` | `boolean` | `false` | Clicking a row toggles its selection. A click on a button, link, input, label or menu item inside the row goes to that control instead, and a click that ends a text selection selects nothing. With `cellNavigation()`, `Space` on a focused cell that holds no control toggles its row. Rows get `.gw-row--selectable` (`cursor: pointer`). |

The selection itself is the engine's: `selectionMode`, `onSelectionChange`, `api.toggleRowSelection`.

```tsx
// A list you select from by clicking rows, operable by keyboard through cellNavigation().
<Gridwright
    selectionMode="multiple"
    coreAddons={coreAddons({ selection: { checkboxes: false, selectOnRowClick: true } })}
    addons={[cellNavigation()]}
    ...
/>
```

**`checkboxes: false` needs a replacement control.** The selection state, `aria-selected` on rows
and `aria-multiselectable` on the table keep working, but without checkboxes the only built-in way to
toggle a row is `selectOnRowClick`, and its keyboard route is `Space` on a focused cell, which exists
only with `cellNavigation()`. `checkboxes: false` with neither is a grid nobody can select from by
keyboard; drive it yourself through `api.toggleRowSelection`.

A row click also runs the grid's own `onRowClick`, first, so it sees the selection as it was before
the click. With `rowActions()` at its default trigger, or `'click'`, the same click also pins the row
menu. Pass `rowActions({ items, trigger: 'hover-contextmenu' })` to leave the click to selection: the
menu still previews on hover and focus, and pins on right-click and the context-menu key.

### `pagination(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | The choices in the rows-per-page menu. |

### `staleNotice()`

No options. The banner above the table when a refresh failed and the previous rows are still shown.

### What the core add-ons decide

Exported from `apsw-gridwright/react` as plain functions, for another view of sorting, selection or
pagination: an add-on of your own with the same name, or the MUI package, which is built on these and
nothing private. A view that calls them says and does what the native one does.

| Function | Returns |
| :--- | :--- |
| `ariaSortOf(direction)` | `'ascending' \| 'descending' \| 'none'`, for the header cell |
| `nextSortAction(direction)` | the message key for the next action: `'ascending' \| 'descending' \| 'clear'` |
| `sortTitleOf(direction, multiSort, t)` | the sort control's title, with the Shift hint while `multiSort` is on |
| `sortPriorityOf(sort, columnId)` | the column's 1-based place in the sort, or `0` when it is unsorted or the only sorted column |
| `sortAnnouncement()` | the sorting add-on's `announce` contributor (priority 20) |
| `pageSelectionOf(state)` | `{ all, some }`: the select-page checkbox's checked and indeterminate state |
| `selectionTableAttributes(grid)` | `aria-multiselectable` for the table |
| `selectionRowAttributes(row, grid, { selectOnRowClick })` | `aria-selected`, the selected and selectable classes, and the guarded row click |
| `selectionKeyDown(event, grid)` | `Space` on a focused cell with no control; `true` when handled |
| `pageRangeOf(state)` | `{ from, to, total }`, with `total` null when the source sent no count |
| `pageSizeChoices(options, pageSize)` | the page sizes to offer, including the grid's own |
| `DEFAULT_PAGE_SIZE_OPTIONS` | `[10, 25, 50, 100]` |
| `pageFocusAfterChange(pressed, disabled)` | which page button takes focus after a page change, or `null` |

## MUI: `apsw-gridwright-mui`

A second package, for applications built on MUI (`@mui/material` 7 or 9). Pass `muiAddons()` where
`coreAddons()` would go. Its README covers installation and what does and does not follow the theme.

| Export | Signature | What it does |
| :--- | :--- | :--- |
| `muiAddons` | `(options?: CoreAddonOptions) => GridAddon[]` | `[muiTheme(), muiSorting(options.sorting), muiSelection(options.selection), muiPagination(options.pagination), staleNotice()]` |
| `muiTheme` | `() => GridAddon` | The grid's `--gw-*` tokens, font and `data-gw-theme` from the MUI theme in context, on the root. `var(--mui-…)` references for a `cssVariables` theme. Name `gridwright:mui-theme`. |
| `muiSorting` | `(options?: SortingOptions) => GridAddon` | `TableSortLabel` as a real button. Name `gridwright:sorting`. |
| `muiSelection` | `(options?: SelectionOptions) => GridAddon` | MUI `Checkbox`es, every `selection()` option. Name `gridwright:selection`. |
| `muiPagination` | `(options?: PaginationOptions) => GridAddon` | `TablePagination` with a native select, the grid's range text, and Previous and Next from `hasPreviousPage` and `hasNextPage`. Name `gridwright:pagination`. |
| `muiTokens` | `(theme: Theme) => GridTokens` | The values `muiTheme()` applies. |
| `MUI_THEME_ADDON` | `'gridwright:mui-theme'` | |

The views take the options, defaults and names of the add-ons they replace, so a grid cannot list
both views of one feature, and locale packs and message overrides apply to both.

## Add-ons

### `search()`

No options. The search box, first in the toolbar. What it matches is set per column with
`searchable` and `formatValue`; how fast it asks a server, with `queryDebounceMs`.

### `columnFilters()`

No options. Per column: `filterable` and `filter` (see [Columns](#columns)). See [filtering](filtering.md).

### `exportMenu(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `formats` | `('csv' \| 'excel' \| 'markdown' \| 'print' \| CustomExportFormat)[]` | `['csv', 'markdown', 'print']` | The menu's entries, in order. A custom format is `{ id, label, serialize, name? }`; `markdownReportFormats(...)` makes two. |
| `filename` | `string \| () => string` | `export-YYYY-MM-DD` | The saved file's name, without the extension. |
| `scope` | `'all' \| 'page' \| 'selected'` | chosen by the reader, starting from `all` | Fixes which rows every export covers and hides the choice. |
| `csv` | `CsvOptions` | — | `delimiter` (`,`), `newline` (`\r\n`), `bom` (`true`), `header` (`true`), `escapeFormulas` (`true`). |
| `excel` | `ExcelOptions` | — | `sheetName` (`Sheet1`). |
| `print` | `PrintOptions` | — | `title`, `styles` (replaces the print stylesheet), `lang`, `direction`. |
| `serializers` | `Record<string, ExportSerializer>` | — | Replaces a format's writer, by id. |
| `onError` | `(error: unknown) => void` | logs to the console | A failed export. The reader sees a translated sentence either way. |

**`markdownReportFormats(options)`** returns two formats for `formats`: a `.md` file and a PDF through
the print dialog.

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `id` | `string` | required | Namespaced, `acme:roster`. The entries are `<id>:markdown` and `<id>:pdf`. |
| `label` | `string` | required | The report's name, translated. The menu shows "Roster (Markdown)" and "Roster (PDF)". |
| `template` | `string \| (row, index) => string` | required | One block per row. `{columnId}` writes that column's export text. |
| `header`, `footer` | `string \| (rows) => string` | — | Above and below the rows. |
| `separator` | `string` | a blank line | Between row blocks. |
| `title` | `string \| (rows) => string` | the label | The printed document's title, which browsers offer as the PDF's name. |
| `print` | `PrintOptions` without `title` | — | `styles`, `lang`, `direction`. |
| `outputs` | `('markdown' \| 'pdf')[]` | both | Which entries to offer. |
| `labels` | `{ markdown?, pdf? }` | — | Replaces an entry's whole label. |

See [exporting](export.md).

### `rowActions(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `items` | `BubbleMenuItem<TRow>[]` | required | The actions. |
| `trigger` | `'hover' \| 'click' \| 'contextmenu' \| 'hover-contextmenu' \| 'both'` | `'both'` | What opens the menu. `both`: hover and focus preview it, a click or the context-menu key pins it. `hover-contextmenu`: the same without the left click, for a grid with `selectOnRowClick`. |
| `placement` | `'top' \| 'bottom'` | `'top'` | Over the row, or hanging under it. |
| `className` | `string` | — | Added to the menu. |

**An item**

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `id` | `string` | required | Unique within the menu. |
| `label` | `ReactNode` | required | What the item shows. |
| `onSelect` | `(row: GridRow<TRow>) => void` | required | Runs the action. Under `treeData()` the row holds a node; `rowDataOf(row)` gives your row. |
| `disabled` | `boolean \| (row) => boolean` | `false` | Shown, but cannot be chosen. |
| `hidden` | `(row) => boolean` | — | Not shown for this row. |
| `separatorBefore` | `boolean` | `false` | A separator above the item. |
| `destructive` | `boolean` | `false` | Styled as destructive. |

### `inlineEditing(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `commit` | `(rowId, columnId, value) => void \| Promise<void>` | required | Stores an edit. A rejected promise shows the error on the cell. Under `treeData()`, `controller.updateRow` applies it optimistically and reverts on failure. |

Which columns are editable is the column's `edit` (see [Columns](#columns)).

**Starting and finishing an edit.** An editable cell renders its value inside a button.

| To | Do |
| :--- | :--- |
| start editing | click the cell, or `Tab` to it and press `Enter` or `Space`; under `cellNavigation()`, arrow to it and press `Enter` or `F2` |
| save a text, number or date edit | `Enter`, or click or `Tab` away |
| discard it | `Escape` |
| save a `select` | choose an option; `Escape` or leaving it discards |
| save a `checkbox` | toggle it |

A click on an editable cell opens the editor and does not reach `onRowClick`. When `commit`
rejects, the cell shows the error and a screen reader hears it.

When the editor closes from the keyboard (`Enter`, `Escape`, choosing an option, toggling a
checkbox), focus returns to the cell's button, so a keyboard reader stays in the grid. Clicking
away leaves focus where the click put it.

### `treeData(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `getRowId` | `(row) => RowId` | required | The row's identity. Every placement of one row shares it. |
| `getChildren` | `(row) => TRow[] \| undefined` | — | Children carried on the row. Use this or `getParentIds`. |
| `getParentIds` | `(row) => RowId \| RowId[] \| null` | — | Parents named by the row. The only shape where a row sits under several parents. |
| `hasChildren` | `(row) => boolean` | `false` | A row has children not loaded yet, so it gets a toggle before they arrive. |
| `loadChildren` | `({ row, rowId, node, signal }) => Promise<TRow[]>` | — | Fetches children on first expand, once per row wherever it appears. |
| `defaultExpandedDepth` | `number` | `0` | Expand down to this depth on first render. `0` shows the roots only. |
| `maxDepth` | `number` | `64` | Rows deeper than this are not placed. A cycle is detected and marked separately. |
| `treeColumnId` | `string` | the first visible column | The column that carries the indentation and the toggle. |
| `keepAncestorsOfMatches` | `boolean` | `true` | While filtering or searching, keep the rows above a match. |
| `onCommit` | `(change) => void \| Promise<void>` | — | Stores an insert, move, edit or removal after the tree applied it. Throwing reverts it. |
| `onExpandedChange` | `(nodeIds: string[]) => void` | — | After a node opens or closes. |
| `controllerRef` | `(controller \| null) => void` | — | Receives the controller (`insertRow`, `moveNode`, `removeNode`, `updateRow`, `toggle`…) and `null` on unmount. |

See [tree data](tree.md).

### `columnLayout(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `initial` | `Partial<ColumnLayoutState>` | — | A layout to start from: widths, pinning and visibility, as `onChange` last reported them. |
| `onChange` | `(layout: ColumnLayoutState) => void` | — | Called after a change is committed and rendered. Never during a drag, and never on mount. |
| `picker` | `boolean` | `true` | `false` leaves the toolbar alone, for a `<GridColumnPicker />` you place yourself. |
| `resizable` | `boolean` | `true` | `false` removes every resize handle. |
| `reorderable` | `boolean` | `true` | `false` makes no header a drag source and removes the `Ctrl`+arrow shortcut. |
| `canChange` | `(change: ColumnLayoutChange, layout: ColumnLayoutState, resolved: ColumnLayoutResolved) => boolean` | — | Called before every committed change. `false` refuses it. Narrows the add-on's own rules and never widens them. `layout` is the reader's overrides only; `resolved` answers what is actually pinned, hidden, ordered and how wide. |
| `defaultWidth` | `number` | `150` | The width of a column that declares no pixel `width` of its own. |
| `minWidth` | `number` | `50` | The floor under every column, beneath the column's own `minWidth`. |
| `extraColumnWidth` | `number` | `48` | The width used for another add-on's column, such as the selection checkbox. |

Resize handles in every header, draggable headers, a column picker in the toolbar, and sticky pinned
columns. The table gets `table-layout: fixed` while this add-on is listed, and its cells truncate
instead of wrapping. Reordering is by drag or by `Ctrl`/`Cmd` + arrow on a focused header, and the
order reaches the engine, so an export follows it. Inside the grid, `useColumnLayout()` gives the
controller the picker, the handles and the drag all use; see [column layout](column-layout.md).

### `rowDetail(options)`

An expandable panel under a row. See [expandable rows](row-detail.md).

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `render` | `({ row, data, grid, close }) => ReactNode` | required | The panel's content. Called only while it is open; `null` renders no panel row. `data` is your row, unwrapped under `treeData()`. |
| `hasDetail` | `(row, grid) => boolean` | every row | `false` draws no toggle for that row. |
| `rowLabel` | `(data, grid) => string` | the first visible column's text | Names the row in the toggle and the panel. |
| `initialExpanded` | `readonly RowId[]` | `[]` | Open on the first render, and never reported to `onExpandedChange`. |
| `onExpandedChange` | `(expanded: RowId[]) => void` | — | After a change is committed and rendered. |
| `single` | `boolean` | `false` | Opening one panel closes the other. |
| `toggle` | `'start' \| 'end' \| 'none'` | `'start'` | Which side the toggle column goes, or none at all. |
| `persistAcrossPages` | `boolean` | `true` | Keep an expansion when the query moves the row away. |
| `canToggle` | `(rowId, expanded) => boolean` | — | Called before every committed change. `false` refuses it. Narrows and never widens. |
| `className` | `string` | — | Added to the panel's region. |
| `controllerRef` | `(controller \| null) => void` | — | Receives `RowDetailController` once, and `null` on unmount. |

`useRowDetail()` returns the controller from anywhere inside the grid: `expanded`, `isExpanded`,
`allows`, `expand`, `collapse`, `toggle`, `expandAll`, `collapseAll`. `expandAll()` covers the rows
the grid is currently holding and makes no claim about pages it has not fetched.

Throws when listed with `virtualRows()`: windowing places rows by a fixed height and a panel is as
tall as its content.

### `cellNavigation(options)`

Spreadsheet-style cursor movement: one Tab stop into the grid, then the arrow keys. See
[accessibility](accessibility.md#cell-navigation).

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `initialCell` | `ActiveCell` | the first cell of the first row | Where the cursor starts. |
| `onActiveCellChange` | `(cell: ActiveCell \| null) => void` | — | Called after the cursor moves and the cell has rendered. Never on mount. |
| `includeExtraColumns` | `boolean` | `true` | Whether another add-on's columns — the `selection()` checkbox, the `rowDetail()` toggle — are reachable with the arrows. |
| `copy` | `boolean` | `true` | Whether the platform's copy shortcut copies from the grid. `false` leaves copying to the browser. |

| Key | Moves to |
| :--- | :--- |
| `ArrowUp` / `ArrowDown` | the same column in the previous / next loaded row |
| `ArrowLeft` / `ArrowRight` | the previous / next column, in reading direction — reversed under `dir="rtl"` |
| `Home` / `End` | the first / last column of the row |
| `PageUp` / `PageDown` | one page of rows, clamped to what is loaded |
| `Ctrl`/`Cmd` + `Home` | the first cell; also returns to page one when the total is exact |
| `Ctrl`/`Cmd` + `End` | the last cell of the last **loaded** row |
| `ArrowRight` / `ArrowLeft` on a tree node | expands / collapses it before moving |

**No key fetches a page.** A paginating source that sends no total leaves `isTotalExact` false, and
the grid then knows only that another page exists — so there is no last row to jump to. `Ctrl+End`
stops at the last row held rather than inventing one or paging until the source runs out.

**Arrow keys inside a form control are left alone**, so an inline editor, a `<select>` in a cell
renderer or anything `contenteditable` keeps them.

**Controls inside cells are operated from the cell.** A button, link or checkbox inside a body cell
is taken out of the Tab order, so `Tab` leaves the grid in one press rather than visiting every row's
checkbox. `Enter`, `Space` or `F2` on the focused cell operates it instead: a button, link or
checkbox is clicked, and a text field or select is focused. When a cell holds several controls, the
first that is not a disclosure toggle wins, so `Enter` on a tree cell with an editable value edits
it while the arrows expand and collapse. A key pressed on the control itself stays the control's.

The built-in controls do this themselves. A control in a cell renderer of your own does it with
`useCellTabIndex()`, which returns `-1` while the cursor visits that cell and `undefined` otherwise:

```tsx
function ProfileLink({ person }: { person: Person }) {
    return <a href={person.url} tabIndex={useCellTabIndex()}>{person.name}</a>;
}

// A component, so the hook runs inside it rather than inside the grid's render.
const columns = [{ id: 'name', header: 'Name', cell: ({ row }) => <ProfileLink person={row} /> }];
```

Pass the column id from an extra column of your own. With `includeExtraColumns: false` the cursor
does not visit extra columns, so their controls, the selection checkbox among them, keep their Tab
stops. The header's sort buttons keep theirs too, because the header row is not part of the cursor.

**Copying.** The platform's copy shortcut — `Ctrl+C`, `Cmd+C` or `Ctrl+Insert`, whichever the
reader's system uses — copies the selected rows that are loaded, with a header row, or, with nothing
selected, the cell under the cursor. The clipboard gets tab-separated text and an HTML table, so a
spreadsheet pastes cells and a text editor pastes lines. Cell text is resolved exactly as an export
resolves it (`exportValue`, then the column's text), with the same formula guard, and every cell is
escaped in the HTML. Text the reader selected with the pointer is copied as that text; a copy inside
a form control is the control's; the selection checkbox cell and a column with `exportable: false`
copy nothing of the grid's. Announced through the live region, under `gridwright:cell-navigation`
as `copiedRows` (plural) and `copiedCell`.

It runs in the browser's own `copy` event rather than through `navigator.clipboard`, so it needs no
permission, works on a plain-HTTP page and inside an iframe with no `allow="clipboard-write"`, and
behaves the same on Windows, macOS, Linux and ChromeOS. What a copy guards against, and what it
leaves to you, is under [Security](../README.md#copying-to-the-clipboard).

`useCellNavigation()` gives a control of your own the same cursor — `activeCell`, `columnIds`,
`isActive(rowId, columnId)` and `focusCell(cell)` — and `useOptionalCellNavigation()` returns `null`
where the add-on is genuinely optional.

### `virtualRows(options)`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `rowHeight` | `number` | `40` | Every row's height in pixels. Must match `--gw-row-height`. |
| `height` | `number \| string` | `420` | The scrolling area's height. |
| `overscan` | `number` | `6` | Extra rows rendered above and below the viewport. |
| `renderSkeleton` | `(absoluteIndex: number) => ReactNode` | a grey bar | Shown for a row on screen whose data has not arrived. |

Replaces the page controls with the scrollbar. Inside the grid, `useVirtualScroll()` gives
`scrollToIndex(index)`. See [virtualization](virtualization.md).

### `urlSync(options)`

Keeps search, sort, filters and page in the URL. See [the view in the URL](url-sync.md).

#### `UrlSyncOptions`

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `adapter` | `UrlSyncAdapter` | the browser's `location`, `history` and `popstate` | Where the parameters are read and written. Pass one to go through a router. |
| `prefix` | `string` | `''` | Put before every parameter name, for several grids on one page. |
| `facets` | `readonly ('search' \| 'sort' \| 'filters' \| 'page' \| 'size')[]` | all five | Which parts of the query go in the URL. |
| `push` | the same | `['page']` | Changes that add a history entry. Every other change replaces the current one. |
| `debounceMs` | `number` | `300` | Quiet before a replace is written. A push is written at once. |
| `maxPageSize` | `number` | the larger of `100` and the grid's own page size | The largest `size` a URL may ask for. |

`UrlSyncAdapter` is `{ getParams(): URLSearchParams; setParams(params, mode: 'push' | 'replace'): void;
subscribe?(onChange): Unsubscribe }`. `getParams` is read on every render; `setParams` receives every
parameter, the grid's own and the rest.

The parameters are `q`, `sort`, `f`, `page` (from 1) and `size`, each written only when it differs
from the grid's starting query. The linked query is applied as `initialQuery`, and as `pageSize` when
the URL names a size, so it wins over the `pageSize` prop at mount. Under `virtualRows()` the page is
not synced.

The codec is exported on its own:

| Function | Signature | What it does |
| :--- | :--- | :--- |
| `serializeGridQuery` | `(query, { prefix?, facets?, baseline? }) => URLSearchParams` | The query as parameters, holding only what differs from `baseline` (default `createQuery()`). |
| `parseGridQuery` | `(params, columns, { prefix?, facets?, baseline?, maxPageSize? }) => Partial<GridQuery>` | The parts of the query the parameters name validly. Never throws. |
| `formatSearchParams` | `(params) => string` | A query string without the `?`, with `:` and `,` left readable. |

## Parts

For a layout composed by hand under `<GridwrightProvider instance={useGridwright(...)}>`.

| Part | Props | Default | What it renders |
| :--- | :--- | :--- | :--- |
| `GridwrightProvider` | `instance` (required), `classNames`, `onRowClick`, `locale`, `messages`, `translate`, `labels`, `children` | — | Publishes the grid to the parts below it. Same meanings as on `<Gridwright />`. |
| `GridRoot` | `className`, `children` | — | The root element, the live region, the add-ons' providers and overlays. Include it. |
| `GridToolbar` | `children` | — | Every add-on's toolbar items, then yours. Renders nothing when empty. |
| `GridSlot` | `name`: `'aboveTable' \| 'belowTable' \| 'overlay' \| 'tableFooter'` | required | One slot's add-on content, wherever you place it. |
| `GridTable` | `caption`, `aria-label`, `children` | — | The table and its scrolling wrapper. |
| `GridHeader` | none | — | The header row. |
| `GridBody` | none | — | The rows, or the body an add-on owns. |
| `GridPagination` | `pageSizeOptions` | `[10, 25, 50, 100]` | Page controls, anywhere. |
| `GridStaleNotice` | none | — | The failed-refresh banner. |
| `GridSearch` | `className` | — | The search box. |
| `GridExportMenu` | every `exportMenu` option, `className` | — | The export menu. `useGridExport(options)` is the same without the menu. |
| `ColumnFilterTrigger` | `columnId` (required), `className` | — | One column's filter button. Needs `columnFilters()` listed. |
| `GridFilterClear` | `className` | — | "Clear filters", while any filter is on. |
| `BubbleMenu` | `items` (required), `trigger`, `placement`, `className`, `aria-label` | `both`, `top` | A row menu over rows it did not render. |
| `GridColumnPicker` | `className` | — | The column picker menu: visibility and pinning per column. Needs `columnLayout()` listed. |
| `GridResizeHandle` | `columnId` (required), `className` | — | One column's resize handle. Needs `columnLayout()` listed. |
| `GridVirtualBody` | `containerRef` (required), `rowHeight`, `overscan`, `renderSkeleton` | `40`, `6` | A windowed body. `virtualRows()` renders it for you. |
| `GridRowView` | `row`, `position` (required), `style` | — | One row with every add-on's attributes and extra columns, for a body of your own. |
| `GridDetailToggle` | `rowId` (required), `className` | — | One row's detail toggle. Needs `rowDetail()` listed. |
| `GridRowDetail` | `rowId` (required), `children`, `className` | — | The presentational panel row, for a body composed by hand. |
| `GridRowOrCustom` | `row`, `position` (required), `style` | — | The same, plus any row an add-on renders instead of it and any rows contributed after it. What a body of your own should render per row. |
| `columnCountOf` | `grid` | — | Not a part but a function: how many cells a row spans, extra columns included. The `colSpan` for a row that covers the table. |

## Class names

`classNames` on `<Gridwright />` or `<GridwrightProvider>` adds your class beside the built-in `gw-`
class of each part. The stylesheet's CSS custom properties are the other way to theme; see
[theming](../README.md#theming).

| Key | Element | Built-in class |
| :--- | :--- | :--- |
| `root` | the grid's outer element | `gw-root` |
| `toolbar` | the toolbar | `gw-toolbar` |
| `search` | the search box | `gw-search` |
| `tableWrapper` | the table's scrolling wrapper | `gw-table-wrapper` |
| `table` | `<table>` | `gw-table` |
| `thead` | `<thead>` | `gw-thead` |
| `headerRow` | the header `<tr>` | `gw-header-row` |
| `headerCell` | each `<th>` | `gw-header-cell` |
| `tbody` | `<tbody>` | `gw-tbody` |
| `row` | each body `<tr>` | `gw-row` |
| `rowSelected` | a selected row, as well as `row` | `gw-row--selected` |
| `cell` | each body `<td>` | `gw-cell` |
| `status` | the loading, empty or error cell | `gw-status` |
| `pagination` | the page controls | `gw-pagination` |
| `stale` | the failed-refresh banner | `gw-stale` |
| `filterTrigger` | a header's filter button | `gw-filter-trigger` |
| `filterDialog` | the filter dialog | `gw-filter-dialog` |
