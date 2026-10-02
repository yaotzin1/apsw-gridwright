# Tasks: responsive layout

Each task is independently checkable. Tests are written beside the code, documentation last.

## Stage 5: analyze (before any code)

- [ ] Test the three shrink-to-fit parents (inline-block, float, flex item without `min-width`) in a
      real browser with `container-type: inline-size` on `.gw-root`. Record the result in `review.md`;
      if any collapses, move the container to an inner element and amend `api-surface.md` first.
- [ ] Confirm C-6 with the maintainer (touch trigger in `rowActions()` or in the consumer's column).
- [ ] Confirm nothing here puts DOM or React under `src/core`, `src/data` or `src/plugins`.

## Phase 1: chrome, touch, reflow, column priority

- [ ] `styles.css`: container, toolbar and pagination wrapping, overlay clamping (AC-01 to AC-03).
- [ ] `styles.css`: coarse-pointer sizes and `--gw-touch-target`; `--gw-row-height` as a minimum
      (AC-04, AC-05).
- [ ] `responsive()` add-on, `useContainerWidth()`, the observer, `initialWidth` (AC-10, AC-13).
- [ ] `column.responsive.hideBelow`, kept out of the saved layout (AC-07 to AC-09).
- [ ] Pinned-width cap (AC-11).
- [ ] Row-menu trigger on a device without hover (AC-12), if C-6 is confirmed.
- [ ] Unit and React tests: a stubbed `ResizeObserver` and `matchMedia`; hide, restore, export still
      includes a hidden column, `onChange` never fires for a width change, Strict Mode, hydration.
- [ ] Messages in `en`, `de`, `es`, `fr`, `pl`; `useAddonMessages` coverage.
- [ ] Playground and MUI showcase: a resizable container and a `hideBelow` column.
- [ ] `docs/responsive.md`, `docs/api.md`, README, CHANGELOG, DEPENDENCY_MAP, `docs/accessibility.md`.
- [ ] `npm run verify`, `npm run test:smoke`, `npm run check:exports`.
- [ ] Real browser at 320, 375, 768 and 1280 px, every option on and off again, in a **visible**
      window (spec C-9). Dark mode and forced colours.
- [ ] MUI package: views carry the same attributes; peer floor raised.

## Phase 2: stacked rows

- [ ] Stacked CSS with the roles restored explicitly (AC-20, AC-21).
- [ ] Label exposed exactly once (AC-22), chosen by testing with a screen reader.
- [ ] Toolbar sort control over the shared sorting state (AC-23).
- [ ] Selection, detail, tree, grouping and `rowActions()` on a card (AC-24).
- [ ] `cellNavigation()` while stacked (AC-25); `virtualRows()` refusal (AC-26).
- [ ] Tests for each, plus an axe-style check that the grid role and header survive.
- [ ] Messages (AC-27), docs, example, CHANGELOG.
- [ ] Browser pass again at stacked widths, keyboard and a screen reader.
