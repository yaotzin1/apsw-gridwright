# Tasks: React-only surface, accessible grid state

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

The engine is not modified. These two are the only changes below `src/react`, and neither touches
the pipeline, the query or a data source.

- [x] **T-01** Add the six `a11y.*` keys to `MessageKey` and `englishMessages` in
      `src/i18n/messages.ts`, with `a11y.rowsTotal` as a plural message.
- [x] **T-02** Add the same six keys to `src/locales/de.ts`, `es.ts`, `fr.ts` and `pl.ts`, with
      the plural categories each language actually has.

## Data sources

- [x] **T-03** None. The feature reads published state and declares no capability, so no data
      source changes. Recorded rather than omitted, because "no change" is the claim being made.

## Adapter

- [x] **T-04** `src/react/a11y/rows.ts`: the header-inclusive row numbering, one function used by
      both bodies and by the table.
- [x] **T-05** `src/react/a11y/announcement.ts`: derive the single sentence from
      `AnnouncementInput`, in the priority order fixed by `events.md`.
- [x] **T-06** `src/react/a11y/useAnnouncement.ts`: hold the derived sentence and detect the sort
      change against the previous query. Announces when the sentence changes and not otherwise,
      per the AC-08 correction recorded in `spec.md`.
- [x] **T-07** `src/react/types.ts` and `labels.ts`: the three new label members, wired to the
      catalogue.
- [x] **T-08** `GridTable`: header-inclusive `aria-rowcount`, `aria-multiselectable` for a
      multiple-selection grid, `role="treegrid"` for a tree.
- [x] **T-09** `GridHeader`: `aria-rowindex={1}` on the header row.
- [x] **T-10** `GridBody`: `aria-rowindex` per row, and the four hierarchy attributes when the
      grid is a tree.
- [x] **T-11** `GridVirtualBody`: row index corrected to header-inclusive numbering, skeleton rows
      included.
- [x] **T-12** `GridPagination`: move focus to the sibling control when activation disables the
      one just used.
- [x] **T-13** `TreeCell`: remove `aria-expanded` from the toggle button and correct the comment
      that claimed the row already carried the hierarchy attributes.
- [x] **T-14** `GridRoot`: render the derived announcement instead of the loading label alone.
- [x] **T-14a** `GridStaleNotice`: the banner shown when a refresh failed and rows remain, above
      the table so the rows do not move, with `role="alert"` and a retry button. Added at stage 6
      after the failure was found to be announced but never shown; see the amendment note in
      `api-surface.md`.
- [x] **T-14b** The live region stops announcing errors, since the banner and the body's error state
      both carry `role="alert"`.
- [x] **T-14c** `.gw-stale` styles, every colour a token, plus the `stale` class-name override.

## The React-only surface

- [x] **T-15** Delete `examples/playground/js/vanilla-page.js` and `js/tree-panel.js`, and with
      them `js/shared/html.js`, `icons.js` and `row-menu.js`, which nothing else imported. Found
      during stage 6: they were helpers for the hand-built grid and became dead code with it.
- [x] **T-16** `examples/playground/index.html` becomes the React playground; `react.html` is
      removed and the cross-links on the remaining pages follow.
- [x] **T-17** `js/shared/load-package.js`: the failure copy no longer sends the reader to a page
      that does not exist.
- [x] **T-18** `.github/workflows/ci.yml`: the playground boot check follows the renamed pages.
- [x] **T-18a** Port the capability controls to the React page. Not in the stage 4 list: they lived
      only on the deleted page, and dropping them would have left the repository with no working
      demonstration of the capability seam, which is the design the package exists to show.

## Tests

- [x] **T-19** Unit coverage for the row numbering and the announcement derivation, including both
      sides of the capability seam: an exact total and an inexact one.
- [x] **T-20** Unit coverage that every locale carries every key, extended to the new ones.
- [x] **T-21** React coverage queried by role: row indices on a paginated page, the header row's
      index, `aria-multiselectable`, the sort announcement, the result announcement, the error
      announcement with stale rows on screen, and the focus move on the last page.
- [x] **T-22** React coverage for the tree: `role="treegrid"`, `aria-level`, `aria-posinset`,
      `aria-setsize`, `aria-expanded` on the row and not on the button.
- [x] **T-23** Update the four virtualization assertions that encoded the old off-by-one numbering,
      the tree assertion that read `aria-expanded` off the toggle, and the two empty-state
      assertions that now find the label in the body and in the live region both.
- [x] **T-24** Smoke coverage: the new labels resolve through the built package's export map, and
      the stale banner renders from the built bundle.

## Documentation

- [x] **T-25** README: React-first framing, the core entry described as the engine.
- [x] **T-26** `docs/tree.md` and `docs/virtualization.md`: remove the vanilla instructions.
- [x] **T-27** `package.json` description and keywords.
- [x] **T-28** `AGENTS.md` section 1: the adapter is the supported surface.
- [x] **T-29** CHANGELOG entry under Unreleased, with the rendered-output changes named.
- [x] **T-30** `specs/DEPENDENCY_MAP.md`.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [ ] The playground checked in a real browser, every option switched on and off again.
      **Not done.** The Chrome extension was not connected in this session. The page, its modules
      and the mock API were verified over HTTP instead, which is what CI checks and is weaker.
