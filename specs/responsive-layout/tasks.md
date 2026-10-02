# Tasks: responsive layout

Each task is independently checkable. Tests are written beside the code, documentation last.

## Stage 5: analyze (before any code)

- [x] Test the three shrink-to-fit parents in a real browser: all collapse to 0 px; an inner container
      does not help; `contain-intrinsic-inline-size` does. Contract amended (C-1). Result in `review.md`.
- [x] Confirm C-6 with the maintainer: confirmed 2026-10-02, a three-dot trigger in `rowActions()`.
- [ ] Confirm nothing here puts DOM or React under `src/core`, `src/data` or `src/plugins`.

## Phase 1: chrome, touch, reflow, column priority

- [x] `styles.css`: opt-in container (`[data-gw-responsive]`), toolbar and pagination wrapping, overlay clamping (AC-01 to AC-03).
- [x] `styles.css`: coarse-pointer sizes and `--gw-touch-target`; `--gw-row-height` as a minimum
      (AC-04, AC-05).
- [x] `responsive()` add-on, `useContainerWidth()`, the observer, `initialWidth` (AC-10, AC-13).
- [x] `column.responsive.hideBelow`, kept out of the saved layout (AC-07 to AC-09).
- [x] Pinned-width cap (AC-11).
- [x] Row-menu trigger on a device without hover (AC-12), a three-dot button (C-6, confirmed).
- [x] `AddonContribution.whenNarrow` (C-10): type, merge, tests, `docs/addons.md` section. Built-in toolbar add-ons audited: they wrap and need no narrow variant (recorded in review.md).
- [x] Unit and React tests: a stubbed `ResizeObserver` and `matchMedia`; hide, restore, export still
      includes a hidden column, `onChange` never fires for a width change, Strict Mode, hydration.
- [x] Messages in `en`, `de`, `es`, `fr`, `pl`; `useAddonMessages` coverage.
- [x] Playground and MUI showcase (done): a resizable container and a `hideBelow` column.
- [x] `docs/responsive.md`, `docs/api.md`, README, CHANGELOG, DEPENDENCY_MAP, `docs/accessibility.md`.
- [x] `npm run verify` (includes smoke and check:exports): green on 2026-10-02.
- [ ] Real browser at 320, 375, 768 and 1280 px, every option on and off again, in a **visible**
      window (spec C-9). Dark mode and forced colours.
- [x] MUI package: shared suites re-run the responsive tests against the views, plus one MUI test. Peer floor needs no raise: the MUI package imports nothing new from the grid.

## Phase 2: stacked rows

- [ ] Stacked CSS with the roles restored explicitly (AC-20, AC-21).
- [ ] Label exposed exactly once (AC-22), chosen by testing with a screen reader.
- [ ] Toolbar sort control over the shared sorting state (AC-23).
- [ ] Selection, detail, tree, grouping and `rowActions()` on a card (AC-24).
- [ ] `cellNavigation()` while stacked (AC-25); `virtualRows()` refusal (AC-26).
- [ ] Tests for each, plus an axe-style check that the grid role and header survive.
- [ ] Messages (AC-27), docs, example, CHANGELOG.
- [ ] Browser pass again at stacked widths, keyboard and a screen reader.
