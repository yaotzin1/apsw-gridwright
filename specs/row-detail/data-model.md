# Data model: expandable rows (row detail panels)

Every type here lives in `src/react/detail/types.ts` except `rowAfter`, which is a field on the
existing `AddonContribution` in `src/react/addons/types.ts`. None of them reaches `src/core`,
`src/data` or `src/plugins`: a ReactNode and an open/closed set are presentation, and the engine has
no opinion about either.

## The contract seam

```ts
// src/react/addons/types.ts, inside AddonContribution, under "--- The body ---"

/**
 * Rows rendered after this row, inside the same `<tbody>`: a detail panel, a per-row note.
 *
 * Returns one or more `<tr>` elements, because that is what a `<tbody>` may contain. Every add-on
 * contributing one is asked, in add-on order, and every non-empty result renders: two add-ons may
 * both add a row after the same row. Asked for a row an add-on rendered through `renderRow` too.
 *
 * The extra row is not a grid row unless you make it one. Giving it `role="row"` changes what
 * `aria-rowcount` and `aria-rowindex` mean for every row of the result set; `rowDetail()` renders
 * it presentational for exactly that reason.
 */
readonly rowAfter?: (row: GridRow<TRow>, grid: GridContext<TRow>) => ReactNode | undefined;
```

## The add-on's types

```ts
/** What `render` is handed for one expanded row. */
export interface RowDetailContext<TRow> {
    readonly row: GridRow<TRow>;
    /**
     * The consumer's own row, unwrapped with `rowDataOf`.
     *
     * `row.data` is a `TreeNode<TRow>` in a grid that also lists `treeData()`. A renderer written
     * against the consumer's type must not have to know that, so the unwrapping happens here, the
     * same way the tree does it for columns and `onSelectionChange`.
     */
    readonly data: TRow;
    readonly grid: GridContext<TRow>;
    /** Collapses this panel: for a "Close" button inside it. */
    readonly close: () => void;
}

export interface RowDetailOptions<TRow> {
    /**
     * The panel's content. Called only for an expanded row, so a component that fetches its own
     * data is the lazy load; there is no `loadDetail` because nothing but React needs the result.
     *
     * Returning `null` or `undefined` renders no panel row at all. Prefer `hasDetail` when the
     * answer is known without rendering: it is asked before the toggle is drawn, so the row does
     * not get a control that opens nothing.
     */
    readonly render: (context: RowDetailContext<TRow>) => ReactNode;
    /** Whether this row can be expanded at all. Default: every row can. */
    readonly hasDetail?: (row: GridRow<TRow>, grid: GridContext<TRow>) => boolean;
    /** Names the row in the toggle's accessible name and the panel's label. Default: the text of the first visible column. */
    readonly rowLabel?: (data: TRow, grid: GridContext<TRow>) => string;
    /** Expanded on the first render. Never passed to `onExpandedChange`. */
    readonly initialExpanded?: readonly RowId[];
    /** Called after an expansion change has been committed and rendered, with every expanded id. */
    readonly onExpandedChange?: (expanded: readonly RowId[]) => void;
    /** At most one panel open at a time. Default false. */
    readonly single?: boolean;
    /** Where the toggle column goes. `'none'` contributes none, for a `<GridDetailToggle />` you place yourself. Default `'start'`. */
    readonly toggle?: 'start' | 'end' | 'none';
    /**
     * Keep the expansion of rows the query moved away from, so paging back reopens them. Default true.
     * False for a source whose row ids are not stable across pages.
     */
    readonly persistAcrossPages?: boolean;
    /** Class on the panel's region, beside `gw-detail-panel`. */
    readonly className?: string;
    /**
     * Called before every expansion change the add-on commits, including one made through the
     * controller. Return false to refuse it. It narrows and never widens.
     */
    readonly canToggle?: (rowId: RowId, expanded: boolean) => boolean;
    /** Receives the controller once it exists, and `null` when the grid unmounts. */
    readonly controllerRef?: (controller: RowDetailController | null) => void;
}

/**
 * Expansion, and everything that changes it.
 *
 * Reach it with `useRowDetail()` from anywhere inside a grid that lists `rowDetail()`: a toolbar
 * button, a keyboard shortcut, a control in the panel itself. The built-in toggle uses exactly this
 * and nothing else.
 */
export interface RowDetailController {
    /** Every expanded id, including ids of rows the current page does not hold. */
    readonly expanded: readonly RowId[];
    isExpanded(rowId: RowId): boolean;
    /** False when `hasDetail` said so, or when `canToggle` refuses the change. */
    allows(rowId: RowId, expanded: boolean): boolean;
    expand(rowId: RowId): void;
    collapse(rowId: RowId): void;
    toggle(rowId: RowId): void;
    /**
     * Expands every row the grid is currently holding that has detail.
     *
     * The rows on other pages are not in the grid, so they are not expanded and are not counted.
     * There is deliberately no "everything is expanded" flag: it would be a claim about rows that
     * have never been fetched.
     */
    expandAll(): void;
    /** Collapses everything, including rows the current page does not hold. */
    collapseAll(): void;
}

export interface GridDetailToggleProps {
    readonly rowId: RowId;
    readonly className?: string;
}

/** The presentational row the add-on renders, exported for a body composed by hand. */
export interface GridRowDetailProps {
    readonly rowId: RowId;
    readonly children: ReactNode;
    readonly className?: string;
}

export interface RowDetailProviderProps {
    readonly controller: RowDetailController;
    readonly children: ReactNode;
}
```

## The state the add-on holds

One `Set<RowId>` in React state inside `setup`, plus the options in a ref, exactly as `treeData()`
holds its controller. Nothing is stored per row and nothing is memoised per row: the set is the
whole model.

| Held | Where | Why not elsewhere |
| :--- | :--- | :--- |
| the expanded ids | `useState<ReadonlySet<RowId>>` in the add-on's `setup` | Not `GridState`: no query facet changes and the engine is framework-agnostic. Not a module-level store: two grids on one page would share it. |
| the options | `useRef` updated on every render | So a `render` or a `canToggle` defined inline in JSX does not rebuild the controller, the same trap `treeData()` documents. |
| the controller | `useMemo` over the set and the stable callbacks | Its identity changes when the set does, which is what re-renders the panels; `controllerRef` fires once because the *ref callback* is guarded, not because the controller is frozen. |

`persistAcrossPages: false` clears the set in an effect keyed on `state.version`, so a query change
drops it. With the default, nothing clears it: an id the current page does not hold is simply not
rendered, and comes back when the row does.

## The DOM the add-on renders

```html
<!-- the data row, unchanged -->
<tr class="gw-row" aria-rowindex="4" data-row-id="7">
  <td class="gw-cell gw-detail-toggle-cell" data-column-id="gw-detail-toggle">
    <button type="button" class="gw-detail-toggle"
            aria-expanded="true" aria-controls="gw-detail-7">…</button>
  </td>
  …
</tr>

<!-- the panel row: presentational, so aria-rowcount and aria-rowindex are untouched -->
<tr class="gw-detail-row" role="presentation" data-detail-for="7">
  <td class="gw-detail-cell" role="presentation" colspan="9">
    <div class="gw-detail-panel" role="region" id="gw-detail-7" aria-label="Details for ACME Ltd">
      <!-- the consumer's node: a nested <Gridwright />, a form, anything -->
    </div>
  </td>
</tr>
```

`colspan` is `columnCountOf(grid)` — the same number the status row uses, which is why it becomes a
public export rather than being recomputed here.

The panel's `id` is built from a per-grid `useId()` prefix and the row id, so two grids on one page
cannot collide and the `aria-controls` reference is unique. The row id is not interpolated into a
selector, a URL or a style anywhere; it appears in an `id` attribute and a `data-` attribute, both
of which take it as a value.

## The stylesheet

Added to `src/styles/styles.css`, structural only, driven by custom properties like everything else:

| Selector / property | Purpose |
| :--- | :--- |
| `.gw-detail-row` | no row height: the panel sets its own |
| `.gw-detail-cell` | `padding: var(--gw-detail-padding, var(--gw-cell-padding))`, a top border continuing the row rule |
| `.gw-detail-panel` | `position: sticky; left: 0;` so the panel's content stays at the reader's left edge while the table scrolls horizontally, without measuring the wrapper |
| `--gw-detail-background` | defaults to the table's row background; a theme distinguishes the panel by overriding one variable |
| `.gw-detail-toggle` | the button; the chevron is a rotation of one glyph, `transform` only, and no transition, so there is nothing for `prefers-reduced-motion` to disable |

No colour is hard-coded and no transition is shipped.
