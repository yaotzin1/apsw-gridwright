# Tasks: density

Ordered by dependency. Core first (there is none: this is adapter-only), adapter second, documentation last.

## Core

None. Nothing under `src/core`, `src/data` or `src/plugins` changes.

## Adapter

- [x] **T-01** `src/react/density/types.ts` and `state.ts`: the pure resolution (levels, initial, height).
- [x] **T-02** `AddonContribution.rowHeight`, `AddonSetupContext.rowHeight` (`src/react/addons/types.ts`) and the
      loop in `useGridwright.ts` that passes the first published height to later add-ons.
- [x] **T-03** `virtualRows()` reads `context.rowHeight ?? options.rowHeight ?? 40`.
- [x] **T-04** `context.tsx`, `DensityControl.tsx`, `messages.ts`, `addon.tsx`, `index.ts`; export from `src/react/index.ts`.
- [x] **T-05** `styles.css`: four tokens and two attribute rules.
- [x] **T-06** `gridwright:density` in `de`, `es`, `fr`, `pl`.

## Tests

- [x] **T-07** `tests/unit/density-state.test.ts`: AC-03, AC-10 (ignored invalid heights), initial fallback.
- [x] **T-08** `tests/react/density.test.tsx`: AC-01, 02, 04 to 08, 12 to 16, through the real select, plus a
      stylesheet test for the coarse-pointer rule and the tokens (AC-09, AC-11).
- [x] **T-09** Smoke: `density` is exported from `dist/`, and naming it bundles it while the shell does not (AC-18).
- [x] **T-10** The shared suites of `apsw-gridwright-mui` still pass with `density()` unlisted (no change expected).

## Documentation and examples

- [x] **T-11** `docs/density.md`; `docs/api.md` add-on section and option tables; `docs/addons.md`; `docs/virtualization.md`
      (row height now comes from the add-on when listed); `docs/i18n.md` if it lists add-on namespaces; README.
- [x] **T-12** CHANGELOG under Unreleased: Added.
- [x] **T-13** `specs/DEPENDENCY_MAP.md` row for `react/density/*`.
- [x] **T-14** Examples: a density switch in the playground, operated in the browser with every level, with and
      without `virtual`; the remote example gets `density()` in its list.

## Stage 7 and 8

- [x] `npm run verify`, `npm run test:smoke`, `npm run check:exports`, output in review.md
- [x] `review.md` answered against `.agents/rules/review.md`
