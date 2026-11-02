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
export const h: (tag: AllowedTag, attrs?: Attrs, ...children: ViewChild[]) => ViewNode; // authoring helper

// Events and actions (C-3)
export interface ViewEvent { key?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean;
    button?: number; value?: string; checked?: boolean; targetId?: string; preventDefault(): void }
export type ViewAction = { type: 'focus'; target: FocusTarget } | { type: 'none' } /* extended per add-on */;

// Stores (C-5)
export interface Store<T> { get(): T; set(next: T): void; update(fn: (prev: T) => T): void; subscribe(listener: () => void): () => void }
export function createStore<T>(initial: T): Store<T>;

// Add-on contract (C-4): the React contract with TNode, structural types and stores
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
export interface Renderer<TOut> { render(node: ViewNode): TOut; component(id: string, props: unknown): TOut }
export function stringRenderer(): Renderer<string>;     // C-10
```

## 2. New entry `apsw-gridwright/conformance` (minor, C-9 open)

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

- `GridAddon<TRow>` stays; it becomes `ViewAddon<TRow, ReactNode>` (C-4). Same members, same optionality.
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
