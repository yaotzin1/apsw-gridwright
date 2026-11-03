# API surface: framework-neutral adapter architecture

Provisional until approved. Names marked  are open in spec.md section 8.

## 1. New entry `apsw-gridwright/view` (minor)

Headless: no React, DOM or framework. Source `src/view/`.

```ts
// Nodes (C-2)
export type AllowedTag = 'div' | 'span' | 'button' | 'table' | 'thead' | 'tbody' | 'tfoot' | 'tr' | 'th' | 'td'
    | 'caption' | 'colgroup' | 'col' | 'input' | 'label' | 'select' | 'option' | 'ul' | 'li' | 'svg' | 'path' | /* … */;
export type Attrs = Readonly<Record<string, string | number | boolean | undefined>>; // allowlisted by mergeAttributes
export type Handlers = Readonly<Partial<Record<'click' | 'keydown' | 'change' | 'focus' | 'blur' | 'pointerdown', (e: ViewEvent) => ViewAction | void>>>;
export type ViewNode = /* element | text | fragment | slot | component, spec C-2 */;
export function h(tag: AllowedTag, props?: { attrs?: Attrs; on?: Handlers; key?: string }, ...children: ViewChild[]): ViewNode; // authoring helper (built shape, 2026-11-02)

// Events and actions (C-3)
export interface ViewEvent { key?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean;
    button?: number; value?: string; checked?: boolean; targetId?: string; preventDefault(): void }
export type ViewAction = { type: 'focus'; target: FocusTarget } | { type: 'none' } /* extended per add-on */;

// Stores (C-5)
export interface Store<T> { get(): T; set(next: T): void; update(fn: (prev: T) => T): void; subscribe(listener: () => void): () => void }
export function createStore<T>(initial: T): Store<T>;

// Add-on contract (C-4): a separate neutral contract, built shape 2026-11-02. The contribution holds the fields
// the migrated add-ons need (headerLabel, headerAttributes, announce, messages, suppresses, navigation) and grows
// additively. A slot function receives `ViewGrid<TRow>` ({ api, state, messages(addon) }); one that draws receives
// `ViewRenderGrid<TRow>`, which adds `headerContent(column)` and `headerControlTabIndex` (adapter-owned values).
export interface ViewAddon<TRow, TNode = ViewNode> {
    readonly name: string; readonly requires?: readonly string[]; readonly after?: readonly string[]; readonly before?: readonly string[];
    readonly setup: (context: ViewAddonSetupContext<TRow>) => ViewAddonContribution<TRow, TNode> | void; // once per grid
}
export interface ViewAddonContribution<TRow, TNode = ViewNode> { /* every field of AddonContribution, with
    SlotRender -> (grid) => TNode, HTML*Element attribute types -> ContributedAttributes, KeyboardEvent -> ViewEvent */ }
export const VIEW_ADDON: unique symbol;               // brand for C-7
export function defineAddon<TRow>(addon: ViewAddon<TRow>): ViewAddon<TRow>;

// Resolution, moved from src/react/addons/resolve.ts and made generic
export function orderAddons<TRow, TNode>(/* … */): ViewAddon<TRow, TNode>[];
export function resolveContributions<TRow, TNode>(/* … */): ResolvedContributions<TRow, TNode>;
export function mergeAttributes(/* … */): Attrs;       // the existing allowlist, one copy

// Table model (C-6)
export interface TableModel<TRow, TNode = ViewNode> { readonly root: Attrs; readonly table: Attrs; readonly header: HeaderModel[]; /* … */
    readonly rowCount: number; row(index: number): RowModel<TRow, TNode>; readonly status: StatusModel<TNode> | null; readonly live: LiveRegionModel }
export function buildTableModel<TRow, TNode>(grid: ViewGrid<TRow>, contributions: ResolvedContributions<TRow, TNode>): TableModel<TRow, TNode>;

// Behaviour as functions (AC-06), moved and re-exported: ariaSortOf, nextSortAction, sortAnnouncement, sortPriorityOf,
// sortTitleOf, pageSelectionOf, selectionKeyDown (structural event), pageRangeOf, pageFocusAfterChange,
// pageSizeChoices, DEFAULT_PAGE_SIZE_OPTIONS, announcementFor

// Core add-ons written once in neutral terms
export function sorting<TRow>(options?: SortingOptions): ViewAddon<TRow>;
export function selection<TRow>(options?: SelectionOptions): ViewAddon<TRow>;
export function pagination<TRow>(options?: PaginationOptions): ViewAddon<TRow>;

// Renderer authoring (AC-12)
export interface Renderer<TOut> { render(node: ViewNode): TOut; readonly issues: readonly RenderIssue[] } // built shape: components resolve through options, not a method
export function stringRenderer(options?: { slots?; components? }): Renderer<string>;     // C-10
export function sanitizeNode(node: ViewNode): { node: ViewNode | null; issues: RenderIssue[] }; // the one allowlist (US-06); every renderer calls it first
```

Built shapes for the table model (T-14, 2026-11-02): `buildTableModel(input) => TableModel` with `root`, `live`, `table`,
`caption`, `header` and `body` (`rows` with a lazy `row(index)`, or a `status`); `tableNode(model) => ViewNode`;
`createGridHost(options) => { api, getModel(), subscribe(), destroy() }`, which owns the engine, runs the add-ons with their
per-grid state and keeps the live region; `createLiveRegion()`; `rowNumbering`; `bodyStatusOf`; `labelsFrom` /
`mergeLabels`; `styleValueText(property, value)`. The neutral contract does not yet express extra columns, row
attributes, a footer, column windows or key handling; they arrive with the add-ons that need them.

### 1d. T-16 amendment: what neutral `pagination()` needs (2026-11-03, stage 3 of T-16)

All additive to the unpublished `apsw-gridwright/view` entry, so inside the one planned minor; nothing published changes.

```ts
// ViewAddonContribution gains two optional slots:
readonly belowTable?: (grid: ViewRenderGrid<TRow>) => TNode | null;   // same position as React's `belowTable`
readonly settled?: (grid: ViewGrid<TRow>) => ViewFocus | void;
export interface ViewFocus { readonly type: 'focus'; readonly key: string }   // `key` of an element the add-on drew in `belowTable`

// ViewGrid.classNames gains: pagination?: string
// TableModel gains: belowTable: ViewNode | null   (every add-on's belowTable, in add-on order, after the table wrapper)
// GridHost gains: takeFocusRequest(): string | null   (the key `settled` asked for, once; null when none)
```

- **Why `settled` and not a focus action from the click handler.** Focus has to move once the page has *settled*, because the
  button the reader pressed only becomes disabled when the new page has loaded, which for a remote source is after the click
  handler returned. `settled` runs after a commit in which `state.version`, `hasNextPage` or `hasPreviousPage` changed (the
  React component's own effect keys), never on an add-on's own state change, so recording "the reader pressed next" does not
  consume itself. It is tied to the add-on's `belowTable` output in this step: an add-on without one has nothing to focus.
- **Focus targets are node `key`s, not DOM `id`s.** An `id` would add an attribute to the default markup (US-04 forbids it) and
  collide between two grids on one page. A key is not rendered; the adapter resolves it only within the add-on's own output.
- **The page-size `<select>` (research question 1).** The chosen `<option>` carries `selected: true` (already allowlisted). The
  React renderer turns that into the controlled `value` React needs and does not pass `selected` to the option; a string
  renderer prints `selected` as HTML does. The `change` handler receives `ViewEvent.value`, already in the contract.
- **Page state.** The pressed-button memory is `context.state('pressed', null)`, per grid and per add-on, which is what the
  state scope was added for in T-12.
- `pageRangeOf`, `pageSizeChoices`, `pageFocusAfterChange`, `DEFAULT_PAGE_SIZE_OPTIONS` already live in `src/view/behaviour`.
- **Conformance:** `DriverGrid.choose(on, value)` (operate a select), `pagination/*` scenarios; the focus scenario needs the
  Node driver to apply `GridHost.takeFocusRequest()` after each action.
- **React side:** `pagination()` is the neutral add-on adapted. `GridPagination`, `PaginationOptions` and the logic exports keep
  exporting; `GridPagination` remains a standalone component for custom layouts and keeps its own JSX (a duplicated drawing,
  listed in Known gaps; both call the same `pageRangeOf`, `pageSizeChoices` and `pageFocusAfterChange`).
- **Analyze (stage 5):** no new dependency. No new attribute on the allowlist (`selected` is there). Focus requests cannot reach
  outside the add-on's own output, so the add-on gains no reach a consumer's renderer lacks (application_security). A11y: the
  buttons keep `aria-label`, `disabled`, and focus must never fall to `<body>` at the last page (the existing test guards it);
  the range stays out of a live region (the grid's one region already says it). Performance: the pager is one node tree per
  render of the grid, not per row; `settled` runs per commit and does nothing unless a button was pressed.

### 1c. Built in T-15 beyond 1b (2026-11-03)

- `ViewEvent.stopPropagation(): void` (the row checkbox keeps the grid's own `onRowClick` from firing; `viewEvent()` defaults it).
- `ViewGrid.classNames: { rowSelected?: string }` (the consumer's selected-row class, which the add-on applies) and
  `ViewAddonSetupContext.selectionMode` (whether a checkbox column is on by default). Both required: every adapter supplies them.
- `selection(options?: SelectionOptions): ViewAddon<TRow>`, `SelectionOptions` (unchanged fields), `SELECTION_ADDON`,
  `selectionMessages`, and the shared logic `selectionTableAttrs(mode)`, `selectionRowAttrs(selected, options)`, from `apsw-gridwright/view`.
  The React `selection()` is this add-on adapted; `SelectionOptions`, `selectionKeyDown`, `selectionRowAttributes`,
  `selectionTableAttributes`, `SELECTION_ADDON` and `selectionMessages` keep exporting from `apsw-gridwright/react`.
- A renderer sets the node attribute `indeterminate` as a property and prints nothing for it (the text renderer was printing it;
  fixed with a regression test). `checked` is an attribute in a string renderer and a property after mount in React, so a
  DOM-to-text comparison cannot see it; the conformance scenarios ask the element.

### 1b. T-15 amendment: what neutral `selection()` needs (2026-11-03, stage 3 of T-15)

All additive to the unpublished `apsw-gridwright/view` entry, so inside the one planned minor; nothing published changes.
Each slot is added because `selection()` is the first add-on that needs it (T-12 decision), and each mirrors the React slot
of the same name so the adapter maps one to one.

```ts
// Where an event came from, answered by the adapter, so an add-on never holds a DOM node (replaces selectionKeyDown's
// closest/getSelection/cellControlOf reads). Every field is read lazily: a handler that ignores `origin` costs nothing.
export interface ViewEventOrigin {
    /** The body cell of THIS grid's own table the event came from; absent for the header, a nested grid or outside a cell. */
    readonly cell?: { readonly rowId: string; readonly columnId: string; readonly holdsControl: boolean; readonly targetIsCell: boolean };
    /** The event came from a control inside the row (button, link, input, select, textarea, label, an ARIA widget, an editable). */
    readonly fromControl: boolean;
    /** The event came from a row of a grid nested inside this one (a detail row), which selects its own rows. */
    readonly fromNestedGrid: boolean;
    /** A range of text is selected inside the element the handler is on: a click ending a drag is the reader copying, not selecting. */
    readonly textSelected: boolean;
}
// ViewEvent gains: readonly origin?: ViewEventOrigin;   (optional, so every existing ViewEvent stays valid)

// ViewAddonContribution gains six optional slots (TNode = the adapter's node type, as the others):
readonly columns?: readonly ViewColumn<TRow, TNode>[];                   // extra columns; same shape as React's `columns`
readonly tableAttributes?: (grid: ViewGrid<TRow>) => ViewAttributes;
readonly rowAttributes?: (row: GridRow<TRow>, grid: ViewGrid<TRow>) => ViewAttributes;
readonly rowHandlers?: (row: GridRow<TRow>, grid: ViewGrid<TRow>) => Handlers;   // click on a row; attributes cannot hold functions
readonly tableKeyDown?: (event: ViewEvent, grid: ViewGrid<TRow>) => boolean;     // true when handled; cell navigation runs after
readonly toolbarStatus?: (grid: ViewRenderGrid<TRow>) => TNode | null;
export interface ViewColumn<TRow, TNode> { readonly id: string; readonly placement: 'start' | 'end'; readonly className?: string;
    readonly header: (grid: ViewRenderGrid<TRow>) => TNode; readonly cell: (row: GridRow<TRow>, grid: ViewRenderGrid<TRow>) => TNode }

// ViewRenderGrid gains: readonly cellControlTabIndex: (columnId: string) => -1 | undefined;   // body-cell twin of headerControlTabIndex

// TableModel, as built 2026-11-03: header cells carry `id` and a nullable `column` (null for an extra column); rows carry
// `handlers` (every add-on's `rowHandlers` merged: run in order, the first action wins); `table` and row `attrs` have the
// add-ons' attributes merged; `tableHandlers.keydown` runs each `tableKeyDown` in order until one returns true, then
// prevents the default; a status row spans the extra columns too. `toolbar: { content, status } | null` exists only when
// the host is given toolbar content (`GridHostOptions.toolbar`, `TableModelInput.toolbar`), because the React shell shows
// add-on status only inside a bar that is there for something else. Not modelled yet: `extraCellAttributes`,
// `extraHeaderAttributes` (pinning, cell navigation), `aria-colindex` under a column window, a neutral `toolbar` item slot.
// A `tableKeyDown` or `rowHandlers` that throws propagates in the model; the React shell contains it (`callSlot`). Known gap.
```

- **Renderer rule, not a contract change:** a node attribute `indeterminate` is set as a *property* by every renderer
  (React has no prop for it; the text renderer prints nothing, as the DOM has no attribute). Conformance scenario required.
- **Selection state stays in the engine** (`GridRow.selected`, `api.toggleRowSelection`, `api.selectPage`); the neutral
  add-on holds none, so it needs no `context.state` and the open question 2 of the T-12 note resolves to "nothing to decide".
- **Behaviour moves to `src/view/behaviour/selection.ts`** as pure functions of `ViewEvent`: `rowClickSelects(event)`,
  `spaceSelectsRow(event, state)`. The React `selectionKeyDown` and the row click become thin wrappers; same exports.
- **Analyze (stage 5) result:** no new runtime dependency; the origin is booleans and ids, so no DOM node or selector reaches
  an add-on (application_security: no sink an add-on lacked); `rowId` is text from `data-row-id`, never placed into a
  selector. Accessibility: the select-page checkbox must keep `aria-label`, `checked` and a true `indeterminate`; the row
  checkbox must stay out of the Tab order under cell navigation (`headerControlTabIndex` has a body-cell twin to add:
  `cellControlTabIndex`); the live region and `aria-selected` must be unchanged. Performance: `origin` is lazy and built
  per event, never per row; `rowHandlers` is called per rendered row, so it returns a cached object for a row whose
  `selected` did not change (hot-path rule, performance.md section 8).

## 2. New entry `apsw-gridwright/conformance` (minor, C-9 open)

T-15 (e) additions: `DriverElement.checked(): boolean | null` and `.indeterminate(): boolean` (the platform has no attribute
for the mixed state); `DriverMountOptions.selection?: { mode: 'single' | 'multiple'; onRowClick?: boolean }`; `selectionScenarios`
(7 scenarios, ids `selection/*`), part of `allScenarios`.

```ts
export interface ConformanceDriver { mount(options: DriverMountOptions): Promise<DriverGrid>; unmount(): void }
export interface DriverGrid { text(): string; query(role: string, name?: string): DriverElement | null;
    press(key: string, on?: DriverElement): Promise<void>; click(on: DriverElement): Promise<void>;
    focused(): DriverElement | null; liveRegionText(): string }
export function conformanceSuite(driver: ConformanceDriver, options?: { skip?: readonly string[] }): void; // registers tests
```

Scenarios cover the ARIA grid pattern, sort cycle and `aria-sort`, select-all indeterminate state,
pagination range and "of many", focus after a page change, and the live-region sentences.

## 3. `apsw-gridwright/react` (no breaking change)

- `GridAddon<TRow>` stays exactly as it is. It is **not** an alias of `ViewAddon` (C-4, resolved 2026-11-02: an alias
  would have broken add-ons typed against React's events). `AddonEntry<TRow>` widens to `GridAddon | ViewAddon | false |
  null | undefined`, and the grid adapts a `ViewAddon` before ordering, so one list holds both kinds.
- New: `renderNode(node, { slots?, components?, onIssues? })`, `RenderNodeOptions`, `ViewComponents`.
- Every currently exported name still exports, from the same path. The moved helpers are re-exports.
- `Gridwright`, `useGridwright`, the parts and the context keep their signatures. `useGridwright` binds
  stores with `useSyncExternalStore`.
- A neutral add-on is accepted anywhere a `GridAddon` is (C-7).

## 4. Defaults

None change. A React grid with no new option renders identical markup (checked by a snapshot of the
rendered tree before and after, T-12).

## 5. Semver

`apsw-gridwright` minor: two new entries, additive re-exports. No removals, renames or changed defaults.
`apsw-gridwright-mui` is unaffected; its views are React add-ons and keep working through C-7. Its peer
floor bumps to the new grid minor only if it starts using a new export.
