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

**Navigation announces nothing.** The browser already announces a focused cell -- its column
header, its row position and its text -- so a live region repeating that would speak over it on
every arrow key. `CELL_NAVIGATION_ADDON` is exported because `suppresses`, `requires`, `after` and
`before` refer to it.

### Added by change 2: clipboard copy (spec C-4)

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `cellNavigationMessages` | `./react` | `AddonMessages` — English; the four packs translate it under `addons['gridwright:cell-navigation']` |
| `CellNavigationOptions.copy` | `./react` (type) | `readonly copy?: boolean` — default `true` |

Message keys: `copiedRows` (plural, `{count}`) and `copiedCell`. Adding a key later is a minor;
renaming one is a major. There is no failure key and no `onError` option: see C-4.

The add-on contract is unchanged by this too: `onCopy` arrives through `tableAttributes`, whose
`on*` handlers the attribute allowlist already permits and `mergeAttributes` already composes.

Behaviour fixed by this change:

5. **The platform's copy shortcut is honoured without detecting the platform.** `Ctrl` or `Cmd` with
   the layout's C, or `Ctrl+Insert`. Never `AltGr` (`Ctrl+Alt`), never with `Shift`.
6. **The reader's own selection wins.** Text selected with the pointer is copied as that text, and a
   copy inside a form control is the control's.
7. **What is copied**: the selected loaded rows with a header row, else the cell under the cursor
   with none. Nothing of the grid's from an extra column or an `exportable: false` column.
8. **Formats**: `text/plain` is tab-separated, LF line ends, no byte order mark, formula-guarded;
   `text/html` is a `<table>` with every cell escaped, formula-guarded, and a UTF-8 declaration.

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
| `cellNavigation({ copy })` | — | `true` — the copy shortcut copies from the grid (change 2). Unreleased, so no consumer inherits a change |

### Added by change 3: controls inside cells (spec C-3, corrected 2026-09-24)

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `useCellTabIndex` | `./react` | `(columnId?: string) => -1 \| undefined` |

`-1` when the grid lists `cellNavigation()` and the cell is one the cursor visits: every data
column, and an extra column when its id is in `columnIds` (so `includeExtraColumns: false` leaves
the checkbox in the Tab order). `undefined` otherwise, which leaves the element's own default. With
no `columnId` the caller is in a data cell: a detail toggle placed in a cell renderer, say. It reads
the same context as `useOptionalCellNavigation()` and lives in its module, so a grid that does not
list the add-on bundles none of it.

Used by every built-in control that renders inside a body cell: the `selection()` row checkbox,
the `treeData()` toggle, the `rowDetail()` toggle and the `inlineEditing()` trigger. A cell renderer
of your own calls it for its link or button in the same way.

Behaviour fixed by this change:

9. **A control inside a navigated cell is not a Tab stop**, so `Tab` from anywhere in the body leaves
   the grid in one press. Header cells are not in the cursor model, so the sort buttons keep their
   Tab stops; bringing the header row into the model is its own change.
10. **`Enter`, `Space` and `F2` on a focused cell operate its control.** A button, a link or a
    checkbox is clicked; a text field or a select is focused. When the cell holds several, the first
    one that is not a disclosure toggle wins, because the tree toggle already answers to the arrow
    keys. The tree and row-detail toggles say what they are with `data-gw-disclosure`, since the
    tree's `aria-expanded` is on the row.
    A key pressed on the control itself is the control's, as it always was.
11. **Closing an editor from the keyboard returns focus to the cell's edit button**, whether it was
    `Enter`, `Escape`, choosing an option or toggling a checkbox. It happens only when the focused
    element was the editor that closed: clicking away keeps focus where the click put it. This is
    `inlineEditing()`'s own behaviour, so it holds without `cellNavigation()` too.

The add-on contract is unchanged.

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
   `tabIndex` is what makes it one. **Corrected by change 3**: the text above also let a control
   inside a cell keep its own Tab stop, and the walk-through showed the two cannot both hold; see
   change 3.
4. **The cursor is not selection.** Moving it changes no row's selected state and emits no query.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported: `ActiveCell`,
      `CellNavigationOptions`, `CellNavigationController`; `RowId`, `GridAddon` and `AddonMessages`
      already are
- [ ] Both `import` and `require` conditions still resolve types — checked at stage 7
- [ ] `npm run check:exports` passes, with the react entry's expected-name count raised by the five
      runtime exports — checked at stage 7
