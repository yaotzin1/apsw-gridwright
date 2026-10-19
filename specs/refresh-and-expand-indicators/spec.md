# Specification: Refresh and expand indicators

> **Status**: Draft
> **Stage entry**: 1
> **Semver impact**: minor (provisional; confirmed in api-surface.md)

---

## 1. The consumer problem

`loadingIndicator()` draws something for the first load only. When a page change, a sort or a filter replaces
the rows, the grid keeps the old ones, dimmed, and the one thing a developer can add is a small corner spinner
(`indicateRefresh`). A developer who wants the same treatment as the first load, a spinner or a skeleton, has
none. The same gap is under a lazy tree: expanding a node whose children load shows only a pulsing toggle.

`specs/loading-indicators` made the refresh indicator opt-in and said the grid "never replaces the rows" on a
refresh. That stays the default. This feature adds an explicit, separate choice for a developer who wants it.

## 2. User stories

- **US-01.** As a developer, I choose a centred spinner over the rows while a page change loads.
- **US-02.** As a developer, I choose placeholder rows in place of the rows on screen while a page change loads.
- **US-03.** As a developer with a lazy tree, I choose a spinner row or placeholder rows under a node while its children load.
- **US-04.** As a developer who sets none of this, nothing changes.

## 3. Acceptance criteria

- [ ] AC-01 `refreshVariant` is `'dim'` (default), `'spinner'` or `'skeleton'`. `'dim'` renders exactly what the grid rendered before.
- [ ] AC-02 `'spinner'` draws one spinner, centred over the table and out of the layout, and keeps the old rows.
- [ ] AC-03 `'skeleton'` replaces each row on screen with a placeholder row, so the count and the table's height are unchanged, and restores the rows when the refresh ends.
- [ ] AC-04 Neither shows before `delay` milliseconds; a refresh that settles first leaves the old rows untouched.
- [ ] AC-05 With `refreshVariant` `'spinner'` or `'skeleton'`, the `indicateRefresh` corner spinner is not drawn as well.
- [ ] AC-06 `expandVariant` is `'none'` (default), `'spinner'` or `'skeleton'`. It draws under a node whose `loadState` is `loading`, after `delay`, and removes it when the load settles or fails.
- [ ] AC-07 `expandRows` (default 3) is kept between 1 and 10.
- [ ] AC-08 `expandVariant` does nothing in a grid without `treeData()`, and nothing for a node that is not loading.
- [ ] AC-09 The placeholders use the table's own columns through `renderedColumnsOf`, hidden from assistive technology. The grid's `aria-busy` and live region are unchanged.
- [ ] AC-10 Reduced motion and forced colours behave as for the first-load skeleton and spinner.

## 4. Non-goals

- Replacing the rows of a windowed body (`virtualRows()`), which draws its own placeholders.
- A blocking overlay or scrim. The spinner has `pointer-events` of the spinner alone and the grid stays operable.
- Changing the default for anyone, including `indicateRefresh`.
- Announcing a node's expansion to assistive technology. The pulsing toggle did not either.

## 5. Behaviour across the capability seam

Presentation only. It reads the engine's `status` and the tree controller's node state, whichever source supplied the rows.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | the refresh is instant, so `delay` hides it; a lazy tree still shows `expandVariant` |
| everything (server) | as specified |
| pagination only | as specified: a page change is the case it was written for |

## 6. Accessibility and interface copy

No new string. The placeholders and spinners are `aria-hidden`; the grid's own "Loading" sentence in the live region and the `aria-busy` on the body are unchanged. A spinner row under a node carries the grid's "Loading" text, visually hidden.

## 7. Delivery as a plugin

React add-on only, with no change to the shell: `refreshVariant` uses `aboveTable` and `renderRow`, `expandVariant` uses `rowAfter`. All three are public slots, so a third-party add-on could do the same.

## 8. Clarifications

- `refreshVariant: 'skeleton'` uses `renderRow`, whose first contributor wins. It answers only while the refresh is slow and otherwise returns `undefined`, so another add-on's custom rows (grouping) apply as before.
- The refresh placeholders are the number of rows on screen, not `rows`, so the table does not change height.

## Artifacts not written

- `plan.md`: three slot contributions in one file; there is no design beyond the spec.
- `tasks.md`: one step per option, and the tests list them.
- `data-model.md`: no state shape beyond one boolean in the add-on's setup.
- `research.md`: the alternative, a new `refreshingRows` slot in the shell, was rejected because the existing slots do the job.
- `events.md`: no event and no pipeline stage.
