# Tasks: MUI integration

Ordered by dependency. Nothing starts until C-1 is decided. The contract seam and the helper
extraction ship in `apsw-gridwright` first, because the MUI package depends on a published version
that has them.

## Core

No engine work. The feature changes no state, query, plugin or data source.

## Adapter — `apsw-gridwright`

- [x] **T-01** `rootAttributes` on `AddonContribution`, merged on the root by `GridRoot`. The
      third-party add-on test reaches it.
- [x] **T-02** Move the sorting, selection and pagination decisions into `sorting-logic.ts`,
      `selection-logic.ts` and `pagination-logic.ts` with the signatures in api-surface.md. The
      native add-ons call them. Unit tests for each helper, with no renderer.
- [x] **T-03** `npm run verify` passes with no change to any existing React test, which proves
      T-02 kept the native output identical.
- [x] **T-04** Export the helpers from `apsw-gridwright/react`. `check:exports` knows the names.

## Repository

- [x] **T-05** npm workspace with `packages/mui`. Dev dependencies: `@mui/material` and
      `@emotion/react`/`@emotion/styled`.
- [x] **T-06** Lint restriction on `@mui/*` outside `packages/mui`. `check-exports.mjs` fails a main
      bundle that references `@mui/`.
- [x] **T-07** R-2 spike: a ref to `TablePaginationActions`' buttons in v7 and v9, or a custom
      `ActionsComponent`.

## Adapter — `apsw-gridwright-mui`

- [x] **T-08** `muiTokens` and `muiTheme()`: both theme modes, with and without `theme.vars`
      (AC-03 to AC-05). Unit tests on `muiTokens` alone.
- [x] **T-09** `muiSorting()` (AC-06).
- [x] **T-10** `muiSelection()` (AC-07).
- [x] **T-11** `muiPagination()` (AC-08 to AC-10), including a source without a total.
- [x] **T-12** `muiAddons()` (AC-01, AC-02), including the duplicate-name error when mixed with
      the native view.

## Tests

- [x] **T-13** Run the accessibility and core-add-on React suites a second time with
      `muiAddons()` (AC-11). A parameterised suite, not a copy.
- [x] **T-14** Smoke test for the MUI package's tarball: ESM and CJS import, types resolve, one
      engine across the packages (AC-13).
- [x] **T-15** CI runs the MUI package against `@mui/material` 7 and 9.

## Release

- [x] **T-16** Release workflow: which tag publishes which package, a second trusted publisher, and
      `release.md` updated. No tag is pushed as part of this work.

## Documentation

- [x] **T-17** `examples/mui-quickstart`: the same grid with `coreAddons()` and with `muiAddons()`,
      plus a light/dark switch. Every toggle clicked in Chrome, then switched back off (AC-15).
- [x] **T-18** README "Using with MUI", including what does not follow the theme's component
      overrides (plan, trade-offs).
- [x] **T-19** `docs/api.md`: `rootAttributes`, the helpers, and the MUI package's exports.
- [x] **T-20** CHANGELOG under Unreleased for both packages, with the semver classification.
- [x] **T-21** `AGENTS.md` repository map, `specs/DEPENDENCY_MAP.md`, `workflow.ai.yml` rule, then
      `node scripts/sync-agent-docs.mjs`.

## Stage 7 — Verification

- [x] `npm run verify` passes end to end for the workspace, with the output recorded in review.md
- [x] C-5 no longer applies: the pager's select is native (`native: true`), not a portalled menu, so it
      stays inside the grid and takes its direction. **Not** checked by hand in an RTL locale; the
      native pager's RTL behaviour is what it inherits.
