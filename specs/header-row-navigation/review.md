# Self-review: the header row in the cell cursor

Reviewed 2026-10-01, against `api-surface.md`. Also covers the fixes made in the same pass: the
column picker's focus after a pin, a clamped row menu under the pointer, and `grouping()` beside the
add-ons that read a row.

## 1. Boundary and layering

Adapter only (`src/react/navigation`, `src/react/core-addons/sorting.tsx`, `src/react/tree/rowData.ts`,
`src/react/grouping`, `src/react/layout`, `src/react/plugins`). Nothing under the core changed. The
header joins the cursor through `headerAttributes` and `extraHeaderAttributes`, slots every add-on
has, so a third-party navigation add-on could do the same. The MUI package reaches it through the
public hook only.

## 2. The local/remote seam

Not touched. A header key calls `toggleSort`, which the pipeline or the source answers, as a click does.

## 3. Public surface and semver

As contracted: minor, opt-in, default `false`. `HEADER_ROW_ID` is a reserved row id; a row of your own
with that id would be indistinguishable from the header to the cursor, which is why it is not a
plausible key. `rowDataOf` accepts one more shape (grouping is unreleased). `apsw-gridwright-mui`
imports `useHeaderCellTabIndex`, so its peer floor must rise with the grid release that ships it:
**owed at release time**.

## 4. Accessibility and i18n

The header cell is the focused element, so the reader hears the header and its `aria-sort`; Enter,
Space and F2 operate the sort button, Shift+Enter adds to the sort. One Tab stop holds with rows,
with none, and while the cursor is on the header. No new strings. A filter button and a resize handle
keep their Tab stops, deliberately: they are separate widgets with their own keys.

## 5. Supply chain and packaging

No dependency, one new export from the React entry. `npm run check:exports` covers the map.

## 6. Honest output

Nothing rendered changes unless the option is on.

## 7. Verification

- `tests/react/cell-navigation-header.test.tsx`, also run against the MUI views by
  `packages/mui/tests/shared-suites.test.tsx`.
- `tests/react/grouping.test.tsx`: row actions, inline edit, row detail, selection ids and the cursor
  beside `grouping()`.
- `tests/react/column-layout.test.tsx` (focus after a pin) and `tests/react/bubble-menu.test.tsx`
  (clamped menu clear of the pointer).
- `npm run verify`: see the run reported with this change.
- Browser: see "Known gaps" for what was and was not seen in a visible tab.

## Found by running it

Three defects the automated suite did not show, each now with a regression test:

- **`grouping()` rendered forever beside `inlineEditing()`.** The effect that re-runs the pipeline was
  keyed on an array that `inlineEditing()` rebuilds every render. The page froze. Keyed on the
  aggregates' ids and names now (`tests/react/grouping.test.tsx`).
- **`cellNavigation()` under `virtualRows()` could leave the grid with no Tab stop** once a scroll
  brought the window to the cursor's row (`tests/react/cell-navigation.test.tsx`).
- A first version of that fix redrew from an effect and did nothing, because a scroll re-renders the
  body alone and the add-on's own hook never runs; the test caught it.

## Known gaps

- **Not seen in a visible tab.** The automation tab reports `visibilityState: "hidden"`, so
  `requestAnimationFrame` never runs and timers clamp to one second. Keys were sent as synthetic
  `keydown` events and the scroll the browser would have fired was dispatched by hand. Seen that way,
  in the built playground and the MUI showcase: the header row in the cursor, Enter sorting, the
  column picker keeping focus after a pin, the row menu clear of the pointer, `columnLayout()` on all
  four showcase tabs, grouping beside actions, edit, detail and selection, and one Tab stop after a
  windowed scroll. Real key presses and a real scroll in a visible window are still owed, and so is
  the sort badge in light, dark and forced colours.
- A filter button and a resize handle keep their own Tab stops with `headerRow: true`.
- `apsw-gridwright-mui` must raise its grid peer floor with the release that ships
  `useHeaderCellTabIndex`.
