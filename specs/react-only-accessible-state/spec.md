# Specification: React-only surface, accessible grid state

> **Status**: Accepted
> **Stage entry**: 1
> **Semver impact**: minor (confirmed in api-surface.md)

---

## 1. The consumer problem

Two problems, one branch, because the second is only worth solving properly once the first has
narrowed where "properly" has to hold.

**The package advertises a surface nobody is supported on.** The README opens with "a headless,
component-oriented data grid for TypeScript, with a React table component", and the playground's
landing page is a framework-free build of the grid assembled by hand from the engine. That page is
a second implementation of everything the React adapter does: its own header markup, its own status
rows, its own row menu, its own tree panel. It has no tests, it is not in the smoke suite, and
every accessibility decision made in `src/react` has to be made a second time there or silently
not made at all. It also sets an expectation the project does not intend to meet, which is that a
Vue or Svelte consumer is a supported consumer.

**The grid's state is not fully reachable by assistive technology.** The parts carry a reasonable
amount of ARIA, and the pieces that exist are right, but the state a reader needs in order to know
where they are is either wrong or absent:

- The table declares `aria-rowcount` as the total across every page, and the rows on a paginated
  page carry no `aria-rowindex` at all. On page two of eight, a screen reader announces "row 1 of
  200" while the reader is on row 26.
- Where `aria-rowindex` is set, in the virtualized body, it is off by one against its own
  `aria-rowcount`: the first data row claims index 1, which is the index the header row occupies.
- Sorting a column changes `aria-sort` on a header cell the reader has already left. Nothing is
  announced, so a keyboard user activates the sort control and hears silence.
- Paging, searching and filtering replace the rows with no announcement of the result. The live
  region carries the word "Loading" and then goes empty.
- A grid that allows multiple selection never says so. There is no `aria-multiselectable`.
- Activating "next page" on the second-to-last page disables the button under the reader's focus,
  which drops focus to `<body>` and loses their place in the grid.
- A refresh that fails while rows are still on screen is reported by nothing at all. The
  `role="alert"` error only renders when there are no rows, so the grid goes on presenting stale
  rows as current, in silence, to sighted and screen reader users alike.
- A tree renders as `role="grid"` with no hierarchy at all. `TreeCell`'s own comment states that
  "`aria-level`, `aria-expanded` and `aria-setsize` on the row are what actually convey the shape",
  and no row renderer sets any of the three. The indentation is decoration, and decoration is all
  a reader gets.

## 2. User stories

- **US-01.** As a developer choosing a grid, I want the README and the playground to tell me
  truthfully which surface is supported, so I do not build on the engine directly and then find
  that the accessibility, the labels and the smoke tests all live in the adapter I skipped.
- **US-02.** As a screen reader user on page three of a grid, I want to be told which rows I am on
  out of how many, so that paging is navigation rather than replacement.
- **US-03.** As a keyboard user, I want activating a sort control to tell me what the sort now is,
  because the attribute that records it is on an element I am no longer on.
- **US-04.** As a keyboard user paging to the last page, I want to keep my place, rather than being
  returned to the top of the document because the control I activated disabled itself.
- **US-05.** As a screen reader user on a tree grid, I want the depth, the expanded state and the
  size of each level, because indentation conveys none of it.
- **US-06.** As anyone reading a grid, I want a failed refresh reported even when the previous rows
  are still on screen, so I do not read stale data believing it is current.

## 3. Acceptance criteria

- [x] **AC-01** Every rendered data row carries `aria-rowindex` reflecting its position in the whole
      result set, in the paginated body and in the virtualized body alike.
- [x] **AC-02** The header row carries `aria-rowindex="1"`, data rows begin at 2, and
      `aria-rowcount` counts the header row, so index and count agree.
- [x] **AC-03** `aria-rowcount` is `-1` when the total is not exact, and no row index implies a
      total the source never sent.
- [x] **AC-04** A table whose selection mode is `multiple` carries `aria-multiselectable="true"`;
      one whose mode is `single` or `none` carries no such attribute.
- [x] **AC-05** Activating a sort control announces the column and its new direction through the
      live region, including when the sort is cleared.
- [x] **AC-06** A settled change of the result set announces the row range and total, or that there
      are no rows, through the live region. The announcement respects `isTotalExact` and never
      states a total the source did not send.
- [x] **AC-07** A failed refresh is both shown and announced whether or not rows are on screen:
      the full error state when none survive, a banner above the table when some do. Exactly one of
      them announces, and the live region stays silent for errors.
- [x] **AC-08** The live region carries one sentence at a time, and a state change that leaves that
      sentence identical makes no announcement at all.
- [x] **AC-09** Activating a page control that becomes disabled moves focus to the sibling page
      control rather than losing it to the document.
- [x] **AC-10** A tree grid renders `role="treegrid"`, and each row carries `aria-level`,
      `aria-posinset` and `aria-setsize`, plus `aria-expanded` when and only when it has children.
- [x] **AC-11** A flat grid continues to render `role="grid"` and carries none of the hierarchy
      attributes.
- [x] **AC-12** Every string added is in the message catalogue, present in all five shipped
      locales, and reachable through `labels`.
- [x] **AC-13** The playground's landing page is the React grid. No page in the repository builds a
      grid out of the engine by hand.
- [x] **AC-14** The README, the package description and the docs describe React as the supported
      surface and the core entry as the internal engine it is.

## 4. Non-goals

- **Removing or deprecating the core entry point.** `apsw-gridwright` stays exported, stays
  headless and stays tested. It is the engine the adapter is built on and the seam the plugin and
  data-source contracts live at. It stops being advertised as a way to build a grid; it does not
  stop working. Deleting it would be a major version that buys nothing.
- **Making React a required peer dependency.** It stays optional, because the core entry stays
  usable and a required peer would print an install warning for anyone importing only the engine.
- **A second framework adapter.** Ruled out in writing. The point of this change is that there is
  one supported adapter.
- **Roving tabindex or arrow-key cell navigation.** The full ARIA grid interaction pattern is a
  separate feature with its own focus-management design. This change fixes the state a reader is
  told about; it does not change how they move.
- **Announcing every keystroke of the search box.** The announcement fires on the settled result,
  not on the query. A live region read on every character is worse than silence.
- **Column-level ARIA positions.** `aria-colcount` and `aria-colindex` exist for tables whose
  columns are windowed. This grid renders every visible column, so the DOM order is already the
  truth and the attributes would add nothing but drift.

## 5. Behaviour across the capability seam

The announcement and the row indices are derived from `GridState`, which is what the pipeline
publishes regardless of who resolved the query. Nothing here branches on the data source.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | The pipeline paginates, so `totalRows` is exact. `aria-rowcount` is `totalRows + 1`, row indices are absolute across pages, and the announcement states the range and the total. |
| everything (server) | Identical, provided the source sent a total. The state fields are the same fields; the adapter cannot tell the difference and does not try. |
| pagination only | When the source paginates without sending a count, `isTotalExact` is false. `aria-rowcount` is `-1`, and the announcement uses the "of many" wording. No row index is emitted that implies a total, because an index is a position, not a count. |

## 6. Accessibility and interface copy

No new controls. The change is entirely in what existing controls report.

**Announcements.** One visually hidden `role="status"` region in `GridRoot`, as today, with a
message derived from the settled state rather than from the loading flag alone. It carries one
thing at a time, in priority order: loading, then error, then the sort that just changed, then the
result summary. The priority matters because the region is read on every change and a sentence
that concatenates all four is a sentence nobody listens to twice.

**Focus.** Page controls move focus to their sibling when activation disables them. This is the
only focus change in the feature.

**Copy.** Six message keys are added under an `a11y.` prefix, in all five shipped locales, with
three matching entries on `GridwrightLabels`. Nothing is rendered from a literal.

## 7. Clarifications

- **Does "React only" remove the core export?** No. Resolved with the requester: the core stays
  headless and intact, and React becomes the only documented and supported way to build a grid.
  The alternative, collapsing the engine into the adapter, would have contradicted the headless
  boundary that `workflow.ai.yml` declares supreme, and would have required amending that file.
- **Does "accessible state" mean a state API or assistive technology?** Assistive technology.
  Resolved with the requester. Exposing state as controlled props is a separate feature and is not
  started here.
- **Should the header row count toward `aria-rowcount`?** Yes. WAI-ARIA counts every row of the
  table, and the APG grid examples give the header row `aria-rowindex="1"`. The current code does
  neither consistently, which is the defect. This changes two existing test expectations, and both
  were encoding the bug.
- **What is announced when the total is unknown?** The range and the word "many", never a computed
  number. This is the existing `pagination.rangeUnknown` rule applied to the live region.
- **Should the stale-data banner be dismissable?** No. Added during stage 6, after the first
  implementation was found to announce the failure to screen readers and show sighted users
  nothing. Dismissing a stale-data warning leaves stale data on screen with nothing marking it,
  which is the state the banner exists to make impossible. It clears when a fetch succeeds.
- **Does the tree keep `aria-expanded` on the toggle button?** No. In a `treegrid` the expanded
  state belongs on the row. Leaving it on both announces it twice.
- **Should an identical announcement be forced to repeat?** No, and AC-08 was corrected during
  stage 6 to say so. Clearing the region to re-announce the same words means every state publish
  announces, including selecting a row, which changes `GridState` without changing anything the
  sentence describes. A region that repeats itself on every click is a region people switch off.
  Announcing on a changed sentence gives one announcement per thing worth saying.
