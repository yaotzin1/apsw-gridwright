# Plan: MUI integration

Written for packaging option B (spec C-1). Where option A would differ, it says so.

## Modules touched

### `apsw-gridwright`

| File | Change |
| :--- | :--- |
| `src/react/addons/types.ts` | `rootAttributes` on `AddonContribution` |
| `src/react/parts/slots.tsx` | `'rootAttributes'` added to the slots `attributesOf` accepts |
| `src/react/parts/GridRoot.tsx` | merges `rootAttributes` contributions with `mergeAttributes`, shell attributes first |
| `src/react/core-addons/sorting-logic.ts` (new) | `ariaSortOf`, `nextSortAction`, `sortAnnouncement`, with `sortSignature` and `describeSort` moved out of `sorting.tsx` |
| `src/react/core-addons/selection-logic.ts` (new) | `pageSelectionOf`, `selectionTableAttributes`, `selectionRowAttributes` |
| `src/react/core-addons/pagination-logic.ts` (new) | `pageRangeOf`, `pageSizeChoices`, `DEFAULT_PAGE_SIZE_OPTIONS`, `pageFocusAfterChange` |
| `src/react/core-addons/sorting.tsx`, `selection.tsx`, `parts/GridPagination.tsx` | call the helpers; rendered output unchanged |
| `src/react/index.ts` | exports the helpers |
| `tests/react/third-party-addon.test.tsx` | the public-exports add-on reaches `rootAttributes` |
| `tests/unit/core-addon-logic.test.ts` (new) | the helpers, with no renderer |

### `apsw-gridwright-mui` (new, `packages/mui/`)

| File | Change |
| :--- | :--- |
| `src/tokens.ts` | `muiTokens(theme)`: the mapping below, plain `.ts` |
| `src/theme.tsx` | `muiTheme()`: `useTheme()` in `setup`, memoised `muiTokens`, `rootAttributes` |
| `src/sorting.tsx`, `src/selection.tsx`, `src/pagination.tsx` | the three views, each calling the helpers above |
| `src/index.ts` | `muiAddons()` and the exports in api-surface.md |
| `package.json`, `tsup.config.ts`, `tsconfig.json` | the package; `apsw-gridwright`, `@mui/material` and React external |
| `tests/` | the views' own tests, plus the shared suites re-run against `muiAddons()` (AC-11) |

### Repository

| File | Change |
| :--- | :--- |
| root `package.json` | `"workspaces": ["packages/*"]`, MUI and emotion as dev dependencies |
| `.github/workflows/ci.yml` | the MUI package's typecheck, tests and smoke run against both MUI lines (C-3) |
| `.github/workflows/release.yml`, `.agents/workflows/release.md` | which tag publishes which package (`v*` the grid, `mui-v*` the MUI package), and the second trusted publisher on npmjs.com |
| `workflow.ai.yml` | the repository map and a rule that `@mui/*` is imported only under `packages/mui` |
| `eslint.config.js` | `no-restricted-imports` for `@mui/*` outside `packages/mui` |
| `scripts/check-exports.mjs` | fails if any `apsw-gridwright` bundle references `@mui/` |
| `examples/mui-showcase/` | the AC-15 example |
| `AGENTS.md`, `README.md`, `docs/api.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md` | stage 8 |

Under option A, `packages/mui/src` becomes `src/mui/`, there is a fourth tsup entry instead of a
package, the helpers need not be exported, and the release changes collapse into the manifest
change R-1 warns about.

## Where the behaviour lives

- **Pipeline stage, GridQuery, GridState:** none. The feature changes no data.
- **Adapter:** everything. `muiTheme()` is a pure view of the MUI theme onto CSS custom properties.
  The three MUI views render the same state through different components.
- **The contract:** one seam, `rootAttributes`, added for everyone.

## Theme mapping (`muiTokens`)

Written as `var(--mui-…)` references when `theme.vars` exists (AC-04), and as resolved values
otherwise.

| Token | From the MUI theme |
| :--- | :--- |
| `--gw-surface` | `palette.background.paper` |
| `--gw-surface-muted` | `palette.background.default` |
| `--gw-surface-hover` | `palette.action.hover` |
| `--gw-surface-selected` | `palette.primary.main` at `palette.action.selectedOpacity` (`alpha()`, or `rgba(var(--mui-palette-primary-mainChannel) / …)` with vars) |
| `--gw-text` | `palette.text.primary` |
| `--gw-text-muted` | `palette.text.secondary` |
| `--gw-border` | `palette.divider` |
| `--gw-border-strong` | `palette.text.disabled` |
| `--gw-accent` | `palette.primary.main` |
| `--gw-accent-contrast` | `palette.primary.contrastText` |
| `--gw-danger` | `palette.error.main` |
| `--gw-font-size` | `typography.body2.fontSize` |
| `--gw-line-height` | `typography.body2.lineHeight` |
| `--gw-radius` | `shape.borderRadius`, in px when numeric |
| `--gw-gap` | `spacing(1)` |
| `--gw-cell-padding-x` | `spacing(2)` |
| `--gw-cell-padding-y` | `spacing(1)` |
| `--gw-focus-ring` | built from `--gw-surface` and `--gw-accent`, as in `styles.css` |

Also on the root: `fontFamily` from `typography.fontFamily` (not a token, because `styles.css`
deliberately sets no font), and `data-gw-theme` from `palette.mode`.

`--gw-row-height` and the pinned-column shadows keep their stylesheet defaults (C-4).

## Trade-offs taken

- **Same add-on names (C-2).** Cost: the native and MUI views of one feature cannot share a grid.
  Accepted, because nobody wants that, and every name-keyed mechanism keeps working.
- **Exported helpers.** Cost: ten more public names in the main package that must stay stable.
  Accepted, because a separate package can only use public exports, and third-party add-ons get the
  same building blocks. They are small, pure and already exercised by the native views.
- **Native table markup.** Cost: MUI `components.MuiTableCell` overrides in the consumer's theme do
  not reach the grid's cells; only the tokens do. Accepted for this change (non-goal), and stated
  in the README section so nobody expects it.
- **A second package (recommended).** Cost: a workspace, a second release path, a second trusted
  publisher. Accepted, because the alternative costs consumers a failed install (R-1).

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A consumer's MUI theme overrides `MuiButtonBase` to render something other than a `<button>` for `TableSortLabel` | `component="button"` is passed explicitly; AC-06 is asserted by role and tag name |
| MUI's "more than N" range leaks when a translation is missing | `labelDisplayedRows` is always supplied; a test with `count={-1}` asserts "of many" and asserts that "more than" is absent |
| MUI's Next button stays enabled on the last page when the total is unknown | disabled from `hasNextPage`, asserted with a source that sends no total |
| The MUI package inlines a copy of the engine | built as external to `apsw-gridwright`; packaging audit (AC-13) |
| MUI code leaks into the main package | lint restriction plus `check-exports.mjs` (AC-12) |
| v7 and v9 differ in a slot the views use | CI runs the MUI package's suites against both (C-3); R-2 spike first |
| The helpers' extraction changes native output | the existing React suites pass unchanged before any MUI code is written (tasks T-03) |

## Stage 5 — Analyze

- **Breaking change without a major?** No. The main package adds one optional field and pure
  functions. R-1 is why option A would have been one; option B avoids it.
- **DOM or React in the core?** No. Nothing under `src/core`, `src/data` or `src/plugins` changes.
  The helpers live under `src/react` and import no React.
- **Built-in needs what a third party cannot reach?** No. That is why the helpers are exported and
  why the root seam is a contract slot. The MUI package is itself a third party.
- **New runtime dependency?** None in either package. `@mui/material` is a peer of the new package
  only.
- **Exploit-prone design?** `rootAttributes` goes through `mergeAttributes`' allowlist, like every
  attribute slot. Token values reach the DOM only as a React `style` object of custom properties,
  never as a CSS string. They come from the developer's theme, not from row data.
- **Accessibility regression?** Guarded by AC-06 to AC-11: the existing accessibility suites run
  against the MUI set. The one accepted difference is C-5 (the portalled menu's direction).
- **Per-row work in the hot path?** `selectionRowAttributes` is the same per-row work
  `selection()` does today. `muiTokens` runs per theme change, not per row or per render.

Result: passes, conditional on C-1 being decided.

## Out of scope for this change

MUI views for filters, export, column picker, inline editing, row detail and tree toggles; MUI rows
and cells; a `dense` option; Joy UI and Base UI. See spec section 4.
