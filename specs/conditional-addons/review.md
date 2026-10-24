# Self-review: Conditional add-ons

## 1. Boundary and layering
React adapter only (`src/react/addons`). Nothing under core, data or plugins.

## 2. The local/remote seam
Not involved.

## 3. Public surface and semver
Minor: one exported type, two props widened. `docs/api.md`, `docs/getting-started.md` and the CHANGELOG moved with it.

## 4. Accessibility and i18n
No markup or string.

## 5. Supply chain and packaging
No dependency or manifest change.

## 6. Honest output
Nothing rendered.

## 7. Verification
- `npm run verify`: passed end to end.
- Playground (`index.html`, employees), Chrome: the three examples' `.filter(Boolean)` workarounds removed so they list
  `cond && addon()` directly. Switched on and off again: column filters, density, export, cell navigation, row actions,
  inline edit, column layout, responsive, grouping, pay band. Each left the grid with 25 rows and the toggle off again;
  no console errors. Toggling `responsive` shows "Loading rows" for a moment while the grid remounts, then recovers.

## Known gaps
- The huge and shape demo pages were edited the same way but not opened.
- The remount on a flipped condition is unchanged; only its documentation is clearer.
