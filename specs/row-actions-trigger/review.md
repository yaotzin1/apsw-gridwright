# Self-review: a row menu that leaves the click to selection

Reviewed 2026-09-25, against `api-surface.md`.

## 1. Boundary and layering

Adapter only: `src/react/plugins/BubbleMenu.tsx`. Nothing under the core changed. `rowActions()`
and `BubbleMenu` pass their trigger straight to `useBubbleMenu`, so the add-on, the standalone part
and a third-party menu built on the hook all get the value from one place.

## 2. The local/remote seam

Not touched. The trigger is about pointer events on rendered rows, whatever produced them.

## 3. Public surface and semver

As contracted: one member added to `BubbleMenuTrigger`, an input-only union. Minor. The default
stays `'both'`, so no grid changes unless it asks. Recorded in CHANGELOG under Added and in
`docs/api.md`, beside the option and beside `selectOnRowClick`, where the conflict is met.

## 4. Accessibility and i18n

The keyboard route is kept on purpose: focus previews the menu, and the context-menu key pins it and
focuses the first item. Only the left click changes owner. No new strings.

## 5. Supply chain and packaging

No dependency, no new export, no change to the export map.

## 6. Honest output

Nothing rendered changes.

## 7. Verification

- `tests/react/bubble-menu.test.tsx`: "leaves the left click to row selection under
  hover-contextmenu" failed before the change (the click pinned the menu) and passes after it. It
  covers AC-01 and AC-02 through `rowActions()`. AC-03 holds by construction: `BubbleMenu` uses the
  same `rowHandlers`.
- In the MUI showcase and the playground, with "select on row click" on: a click selects, and a
  right-click opens the menu.
- `npm run verify`: see the pull request.

## Known gaps

- None for this change. Shift-click range selection is still open in `specs/selection-controls`.
