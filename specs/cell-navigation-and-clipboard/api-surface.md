# API surface contract: 2D cell navigation and clipboard copy

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor.**

Reasoning: a new optional add-on and the names it publishes. Nothing existing changes signature or
default, no prop is added to `<Gridwright />`, and a grid that does not list `cellNavigation()`
renders identical markup — no cell gains a `tabIndex`, because the attribute is contributed through
`cellAttributes` and only a listed add-on contributes. The add-on is **not** in `coreAddons()`, so
no existing grid acquires it by upgrading.

## Exports added

All from `apsw-gridwright/react`. The core entry is untouched.

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `cellNavigation` | `./react` | `<TRow>(options?: CellNavigationOptions) => GridAddon<TRow>` |
| `CELL_NAVIGATION_ADDON` | `./react` | `'gridwright:cell-navigation'` |
| `useCellNavigation` | `./react` | `() => CellNavigationController` — throws outside the add-on |
| `useOptionalCellNavigation` | `./react` | `() => CellNavigationController \| null` |
| `CellNavigationOptions` | `./react` (type) | below |
| `CellNavigationController` | `./react` (type) | below |
| `ActiveCell` | `./react` (type) | below |

```ts
/**
 * Which cell the grid's single Tab stop is on.
 *
 * Identified by ids rather than indices, so a sort, a filter or a new page keeps the cursor on the
 * same cell when that row and column are still present, and falls back to the first cell when they
 * are not. `columnId` may name an extra column contributed by another add-on.
 */
export interface ActiveCell {
    readonly rowId: RowId;
    readonly columnId: string;
}

export interface CellNavigationOptions {
    /**
     * The cell the cursor starts on. Default: the first cell of the first row, chosen on the first
     * render that has rows.
     */
    readonly initialCell?: ActiveCell;
    /** Called whenever the cursor moves, for a consumer that wants to persist or mirror it. */
    readonly onActiveCellChange?: (cell: ActiveCell | null) => void;
    /**
     * Whether extra columns contributed by other add-ons — the `selection()` checkbox, the
     * `rowDetail()` toggle — are reachable with the arrow keys. Default true (clarification C-1).
     *
     * False leaves their own control in the Tab order and confines the cursor to data columns.
     */
    readonly includeExtraColumns?: boolean;
}

/**
 * The cursor, for a control of your own and for another add-on.
 *
 * `move` is what the key handler itself calls, so a button that moves the cursor and the arrow key
 * that moves it cannot disagree.
 */
export interface CellNavigationController {
    readonly activeCell: ActiveCell | null;
    /** The ids the cursor may visit in this row, in painting order, extra columns included. */
    readonly columnIds: readonly string[];
    isActive(rowId: RowId, columnId: string): boolean;
    /** Moves the cursor there when that cell exists, and focuses it. Returns whether it moved. */
    focusCell(cell: ActiveCell): boolean;
}
```

**`cellNavigationMessages` is not among them, and navigation ships with no strings at all.** The
browser already announces a focused cell -- its column header, its row position and its text -- so a
live region repeating that would speak over it on every arrow key. The add-on's first strings, and
the four locale packs AC-09 asks for, arrive with clipboard copy, which does have something to
report. `CELL_NAVIGATION_ADDON` is exported now, because `suppresses`, `requires`, `after` and
`before` refer to it.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

Nothing. `AddonContribution` already carries every slot this feature uses — `cellAttributes`,
`extraCellAttributes`, `tableKeyDown`, `provide`, `messages` — so the add-on contract is unchanged
and a third-party add-on could have written this feature without any of it being added for it.

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes. A grid that does not list `cellNavigation()` is byte-identical.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `cellNavigation({ includeExtraColumns })` | — | `true` — the checkbox and toggle cells join the roving model (C-1) |
| `cellNavigation({ initialCell })` | — | absent, meaning the first cell of the first row |

## Behaviour this contract fixes

Written here because these are the decisions a consumer inherits, and two of them correct the spec.

1. **`Ctrl+End` never pages.** It moves to the last cell of the last **loaded** row. When
   `state.isTotalExact` is true it first goes to the last page; when it is false there is no last
   page — `engine.ts` derives `hasNextPage` from whether another page came back — so the cursor
   stops at the last row held, and nothing is fetched. This supersedes AC-03's "of the result set".
   Paging forward until a short page arrived would be an unbounded number of requests from one
   keypress, and claiming a last row the grid has not seen is the invented total this package
   refuses.
2. **`PageUp` / `PageDown` do not cross a page boundary.** They move by one page of rows within
   what is loaded and clamp at the ends. `api.nextPage()` is a fetch, so crossing would leave the
   cursor pointing at a row that does not exist yet, and focus would land after an async gap the
   reader did not ask for. `Ctrl+Home` is exempt only when the total is exact and the grid is
   already on a later page: it goes to page one. This supersedes AC-03's `nextPage`/`previousPage`.
3. **`Tab` leaves the grid.** The ARIA grid pattern gives the grid one Tab stop; the roving
   `tabIndex` is what makes it one. A focusable child inside a cell — an inline editor, a detail
   toggle — keeps its own Tab stop while it is mounted, which is the existing behaviour and is not
   changed here.
4. **The cursor is not selection.** Moving it changes no row's selected state and emits no query.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported: `ActiveCell`,
      `CellNavigationOptions`, `CellNavigationController`; `RowId`, `GridAddon` and `AddonMessages`
      already are
- [ ] Both `import` and `require` conditions still resolve types — checked at stage 7
- [ ] `npm run check:exports` passes, with the react entry's expected-name count raised by the five
      runtime exports — checked at stage 7
