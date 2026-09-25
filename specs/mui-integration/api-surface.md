# API surface contract: MUI integration

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.
>
> Written for packaging option B (spec C-1): a separate package `apsw-gridwright-mui`. Under option
> A, the second half moves to `apsw-gridwright/mui` unchanged, and the helpers in the first half
> may stay internal instead of exported.

## Semver classification

**`apsw-gridwright`: minor. `apsw-gridwright-mui`: 0.1.0, first release.**

Reasoning: in the main package, one optional field is added to `AddonContribution` and pure
functions are added to the React entry. No signature, default, markup or emitted payload changes.
The three native core add-ons are restructured to call the new helpers, and their output is held
identical by the existing suites (`tests/react/gridwright.test.tsx`,
`tests/react/accessible-state.test.tsx`), so that part is a refactor with no semver event. Nothing
is added to `dependencies` or `peerDependencies`.

## Exports added — `apsw-gridwright/react`

The helpers exist because the MUI views live in another package and may use public exports only.
That is the rule every third-party add-on lives by, applied to the built-in ones. Each is a plain
function in a `.ts` file with no React import (`.agents/rules/architecture.md` section 8).

| Name | Signature | Used by |
| :--- | :--- | :--- |
| `AddonContribution.rootAttributes` | `(grid: GridContext<TRow>) => ContributedAttributes<HTMLDivElement>` | any add-on; `muiTheme()` |
| `ariaSortOf` | `(direction: SortDirection \| null) => 'ascending' \| 'descending' \| 'none'` | both sorting views, `headerAttributes` |
| `nextSortAction` | `(direction: SortDirection \| null) => 'ascending' \| 'descending' \| 'clear'` | both sorting views: the message key for the control's title |
| `sortAnnouncement` | `<TRow>() => AnnouncementContributor<TRow>` | both sorting views: priority 20, keyed on the sort, the existing sentences (with the priority while more than one column is sorted) |
| `sortPriorityOf` | `(sort: readonly SortSpec[], columnId: string) => number` | both sorting views: the 1-based badge number, `0` when the column is unsorted or it is the only sorted column |
| `sortTitleOf` | `(direction: SortDirection \| null, multiSort: boolean, t: (key: string, values?: TranslateValues) => string) => string` | both sorting views: the control's title, the next action wrapped in `actionWithShift` while `multiSort` is on |
| `pageSelectionOf` | `(state: Pick<GridState<unknown>, 'rows' \| 'selectedIds'>) => { readonly all: boolean; readonly some: boolean }` | both selection views: select-all checked and indeterminate |
| `selectionTableAttributes` | `<TRow>(grid: GridContext<TRow>) => ContributedAttributes<HTMLTableElement>` | both selection views |
| `selectionRowAttributes` | `<TRow>(row: GridRow<TRow>, grid: GridContext<TRow>, options?: { readonly selectOnRowClick?: boolean }) => ContributedAttributes<HTMLTableRowElement>` | both selection views: `aria-selected`, the selected and selectable classes, and the guarded row click |
| `selectionKeyDown` | `<TRow>(event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>) => boolean` | both selection views' `tableKeyDown` with `selectOnRowClick`: `Space` on a focused cell with no control |
| `pageRangeOf` | `(state: GridState<unknown>) => { readonly from: number; readonly to: number; readonly total: number \| null }` | both pagination views. `total` is `null` exactly when `isTotalExact` is false: the helper cannot produce an invented total |
| `pageSizeChoices` | `(options: readonly number[], pageSize: number) => readonly number[]` | both pagination views: the options plus the current size, sorted |
| `DEFAULT_PAGE_SIZE_OPTIONS` | `readonly number[]` (`[10, 25, 50, 100]`) | both pagination views |
| `pageFocusAfterChange` | `(pressed: 'previous' \| 'next' \| null, disabled: { readonly previous: boolean; readonly next: boolean }) => 'previous' \| 'next' \| null` | both pagination views: which button, if any, takes focus after a settle |

Every type in these signatures (`SortDirection`, `SortSpec`, `GridState`, `GridRow`, `GridContext`,
`ContributedAttributes`, `AnnouncementContributor`, `TranslateValues`) is already exported.
`KeyboardEvent` is React's.

## Exports added — `apsw-gridwright-mui`

| Name | Signature |
| :--- | :--- |
| `muiAddons` | `<TRow>(options?: CoreAddonOptions) => GridAddon<TRow>[]` — `[muiTheme(), muiSorting(options.sorting), muiSelection(options.selection), muiPagination(options.pagination), staleNotice()]` |
| `muiTheme` | `<TRow>() => GridAddon<TRow>` — name `gridwright:mui-theme` |
| `muiSorting` | `<TRow>(options?: SortingOptions) => GridAddon<TRow>` — name `gridwright:sorting` |
| `muiSelection` | `<TRow>(options?: SelectionOptions) => GridAddon<TRow>` — name `gridwright:selection` |
| `muiPagination` | `<TRow>(options?: PaginationOptions) => GridAddon<TRow>` — name `gridwright:pagination` |
| `muiTokens` | `(theme: Theme) => GridTokens` — the mapping `muiTheme()` applies, for a consumer who wants the values in their own CSS |
| `GridTokens` | `type GridTokens = Readonly<Partial<Record<\`--gw-${string}\`, string>>>` |
| `MUI_THEME_ADDON` | `'gridwright:mui-theme'` |

`CoreAddonOptions`, `SortingOptions`, `SelectionOptions` and `PaginationOptions` are imported from
`apsw-gridwright/react` and not re-exported, so there is one definition of each. `Theme` is MUI's
own type from `@mui/material/styles`.

No component is exported. The views are internal to their add-ons, just as `SortButton` and
`SelectRow` are internal to the native ones. A consumer who wants a different control writes an
add-on with the same name.

## Exports changed

None.

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `coreAddons` on `<Gridwright />` | `coreAddons()` | unchanged: MUI is opt-in |
| `rootAttributes` | — | absent: the root renders exactly the attributes it renders today |

The MUI add-ons inherit every default of the native ones they replace (`multiSort: true`,
`checkboxes: selectionMode === 'multiple'`, `count: true`, `pageSizeOptions: [10, 25, 50, 100]`).

## Manifest — `apsw-gridwright-mui`

```json
{
  "dependencies": {},
  "peerDependencies": {
    "apsw-gridwright": "^0.12.0",
    "@mui/material": "^7.0.0 || ^9.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "apsw-gridwright": { "optional": true }
  }
}
```

The package does nothing without any of these peers, but `apsw-gridwright` is marked optional, for
the workspace and at no cost to consumers (amended 2026-09-25, stage 6). npm installs a workspace
package's non-optional peers automatically, and the grid is the repository's root project, which npm
does not count as installed: a required peer made `npm install` fail (`ETARGET`) before 0.12.0 was
published, and with an open range it installed the published grid from the registry beside the
source, which is two engines. An optional peer is not auto-installed, and its range is still
enforced whenever the grid is present: a consumer on 0.11 who installs this package gets the
`ERESOLVE` that R-1 measured. A consumer without the grid at all cannot render `<Gridwright />`, so
nothing is lost by not installing it for them. The
`apsw-gridwright` range starts at `0.12.0`, the minor that ships `rootAttributes` (spec C-8). `@mui/material` brings its own styling
engine peers, so `@emotion/*` is not declared here.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions resolve types, in both packages
- [x] `npm run check:exports` passes for `apsw-gridwright`, and its audit confirms no bundle
      references `@mui/*`
- [x] The MUI package's built output imports `apsw-gridwright` and `apsw-gridwright/react` rather
      than inlining them (AC-13)
