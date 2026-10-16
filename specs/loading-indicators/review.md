# Review: loading-indicators

## Stage 5 analysis (run before stage 6)

- [x] Does anything break a published signature without the right version? No. `StatusContribution` gains one optional field; nothing else changes. Minor.
- [x] Does anything put the DOM or React under the headless directories? No. Everything is under `src/react/loading/`.
- [x] Does a built-in need something a third-party add-on could not reach? No. It uses `status.loading`, the new `status.loadingRows`, and `aboveTable`, all public.
- [x] Does it add a runtime dependency? No. `dependencies` is still empty (`check:exports` confirms), and a library spinner is the consumer's.
- [x] Does it regress keyboard reachability or an announced state? No. Indicators are `aria-hidden` and focusable nowhere; the live region and `aria-busy` are untouched. A refresh indicator is `aria-hidden` and takes no room.
- [x] Does it add per-row work to the hot path? No. The skeleton draws at most `min(rows, 50, pageSize)` rows and goes through `renderedColumnsOf`; a grid that does not list the add-on does none of it.

Stage 3 corrected the draft contract: the existing `status.loading` slot already replaced the status row, so the planned `statusRow` field was unnecessary, and only `loadingRows` was added. It also found that `.gw-skeleton` already existed for the windowed body's placeholder rows, so the skeleton extends that class instead of redefining it.

## Stages run

1 specify, 2 clarify, 3 plan, 4 tasks, 5 analyze, 6 implement, 7 verify, 8 review and ship. No stage was skipped.

## 1. Boundary and layering

The core, data and plugin directories are untouched. `src/react/loading/` imports the add-on contract, the context and the shell's slot helpers; the shell imports nothing from it. The tree-shaking smoke test shows that importing only the grid bundles no spinner code, and that naming `Spinner` bundles it and no other feature.

## 2. The local/remote seam

Nothing branches on the data source. The indicators read `state.status`, which the engine sets the same way for both. A local source rarely shows `loading`.

## 3. Public surface and semver

Minor. New exports: `loadingIndicator`, `LOADING_INDICATOR_ADDON`, `Spinner`, `RingSpinner`, `DotWalkSpinner`, `DrawGSpinner`, `CellColorsSpinner` and seven types. One additive field on `StatusContribution`. The `.gw-skeleton` rule gains custom properties whose fallbacks are its previous values, so the windowed placeholder rows look as they did. `docs/api.md`, `docs/addons.md`, `CHANGELOG.md` and this directory's `api-surface.md` agree.

## 4. Accessibility and i18n

Indicators are `aria-hidden`; the grid's text "Loading rows" stays in the table and is announced once by the existing live region. `Spinner` requires a `label` unless `decorative`, as a type rule (the test uses `@ts-expect-error`). Under reduced motion everything stands still and the text is shown beside it. axe-core passes over loading with a skeleton and with a drawn-G spinner. The add-on adds no strings, so no locale file changed. **Not measured:** the spinner colours in forced-colors mode, which are set from system colours but were not inspected in Windows High Contrast.

## 5. Supply chain and packaging

No dependency, no install script, no asset. `check:exports` passes and the security audit is clean over source and `dist`. The SVG is built from JSX elements with no HTML sink, `foreignObject`, external reference or script (a test asserts it).

## 6. Honest output

A skeleton shows placeholders and never a number. There is no percentage and no determinate progress bar. The spinner says nothing about how long the load will take.

## 7. Verification

`npm run verify` passed end to end before the documentation was added, and is re-run before the pull request. The playground was operated in Chrome: the four spinners, the page's own injected spinner, the skeleton (eight rows, nine cells each against nine header cells, `aria-busy` set), and the refresh spinner over 25 existing rows during a page change. Every option was switched off again afterwards, and the console showed no messages.

## Left undone

- `apsw-gridwright-mui`'s showcase has no loading switch. It carries no density or `wcag()` switch either, because the MUI package does not re-skin feature add-ons.
- The frame rate of a skeleton over 500 columns was not measured, nor the cost of `draw-g`'s `stroke-dashoffset` animation. Both are named as measurements in `research.md`.
- Forced colours was not inspected in a real High Contrast session.
