# Self-review: MUI integration

See [`.agents/rules/review.md`](../../.agents/rules/review.md). Reviewed 2026-09-25 against the code
on `feat/mui-integration`.

## 1. Boundary and layering

No `@mui/*` or `@emotion/*` import outside `packages/mui`: `eslint.config.js` bans both under `src/`
(the core block repeats the pattern, because it replaces the rule for its files), and a probe import
in `src/react` and in `src/core` both failed lint. `check-exports.mjs` fails a grid bundle that
references `@mui/`. The helpers in `sorting-logic.ts`, `selection-logic.ts` and `pagination-logic.ts`
import React types only (erased); `selection-logic.ts` builds its class string itself rather than
importing `classes` from `context.tsx`, which imports React. The MUI package imports public exports
of `apsw-gridwright/react` only. The engine is untouched.

## 2. The local/remote seam

`muiPagination()` reads `pageRangeOf(state)` and `hasPreviousPage`/`hasNextPage`, never the source.
Tested against a remote source that sends no total: "1-3 of many", Next enabled, no "more than".

## 3. Public surface and semver

As api-surface.md, with two stage-6 amendments recorded there and in the spec: the helpers that
multi-sort and selection controls need (`sortPriorityOf`, `sortTitleOf`, `selectionKeyDown`, the
`selectOnRowClick` option on `selectionRowAttributes`), and the optional peer on `apsw-gridwright`.
The grid: minor (one slot, thirteen exports). The native add-ons' output is unchanged: every
existing React test passed without edits after the extraction (T-03); the only test edit in that
commit adds the `rootAttributes` assertion. `apsw-gridwright-mui`: 0.1.0, peers `^0.12.0` on the
grid, so it cannot be released before the grid's next minor (the release workflow refuses it).

## 4. Accessibility and i18n

AC-11: `packages/mui/tests/shared-suites.test.tsx` imports the grid's `accessible-state`,
`gridwright`, `multi-column-sorting` and `selection-controls` suites and runs them with
`muiAddons()` as the default core set. 72 tests, all passing, none edited or skipped. Two
differences surfaced there and were fixed in the views rather than excepted in the tests:

- MUI's `indeterminate` does not set the checkbox's DOM property (its typings say so), so a screen
  reader would hear "not checked" for a partly selected page. The view sets the property through
  the input slot's `ref`; confirmed `true` in Chrome.
- MUI's rows-per-page `Select` is a button and a portalled listbox. The view uses `native: true`: a
  real `<select>` in MUI's styling, named "Rows per page". This also removes C-5, the portalled
  menu taking MUI's direction instead of the grid's.

No string literal renders from the MUI views; every string is a `gridwright:*` message, so the five
locales apply. The pager's arrows are the same `aria-hidden` glyphs as the native pager's.

## 5. Supply chain and packaging

`apsw-gridwright`'s manifest gains only `workspaces` and scripts; no dependency or peer changes.
The MUI package has no `dependencies`. Its build marks the grid, MUI, emotion and React external;
the audit confirms it imports `apsw-gridwright/react` and contains neither `GridwrightError` nor
`createGridEngine`, and its declarations import the grid's types rather than inlining them. Its
tarball is ten files: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`. New dev
dependencies: `@mui/material` 9, `@emotion/react`, `@emotion/styled`, 59 packages in the lockfile,
none with an install script, `npm audit` clean. The security audit now scans every workspace package's
source, manifest and build.

## 6. Honest output

The range is always the grid's `range` or `rangeUnknown` message; `count` is `-1` exactly when the
total is unknown. Previous and Next come from the engine's flags, not from MUI's page arithmetic.

## 7. Verification

`npm run verify` on 2026-09-25, exit 0:

```
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 15 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)
 Test Files  49 passed (49)
      Tests  914 passed (914)
 Test Files  3 passed (3)          (smoke, against the builds)
      Tests  30 passed (30)
  ok   no grid bundle references @mui/
  ok   both entries share one module instance
  ok   apsw-gridwright-mui imports the grid and carries no copy of it
the published package resolves cleanly.
security audit: no findings (source, manifest, dist)
```

MUI 7: with `@mui/material` 7.3.11 swapped in (`npm install --no-save`), the type-check passed and all
88 MUI-package tests passed. CI repeats this in the verify jobs. `node scripts/check-workflow.mjs
--remote`: branch protection matches `ci.required_checks`; no job was added or renamed.

`examples/mui-quickstart` in Chrome: MUI views on and off (native controls and the OS-driven
colours, then MUI's again); dark mode on and off with `data-gw-theme` and the computed
`--gw-surface` following; select-on-row-click on (10 rows selectable, two selected by click) and off
(a click selects nothing); Shift multi-sort with badges 1 and 2 and "Salary, sort priority 2, sorted
ascending"; the select-all checkbox's `indeterminate` property `true`. A screenshot showed the theme's
accent on the badges, checkboxes and selected rows. The walk-through found one bug, in the example
itself: its dark-mode switch read `mode` and showed off while `system` resolved to dark; fixed.

## Known gaps

- **MUI rows and cells.** The consumer's `components.MuiTableCell` and `MuiTableRow` theme overrides
  do not reach the grid's cells, only the tokens do. Justified when a consumer needs per-cell MUI
  styling that the tokens cannot express: that needs a seam replacing the shell's row and cell
  elements, and it would be its own spec.
- **The other add-ons' controls** stay native, themed by tokens. Each one's MUI view is a later
  minor of the MUI package.
- **Pigment CSS** (R-3) is untested.
- **Not released.** Releasing needs the grid's 0.12.0 first, then a trusted publisher for
  `apsw-gridwright-mui` on npmjs.com, configured by the maintainer (`.agents/workflows/release.md`,
  section 6a).
