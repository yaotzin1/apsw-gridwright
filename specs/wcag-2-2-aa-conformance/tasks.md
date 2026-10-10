# Tasks: WCAG 2.2 AA conformance

> Stage 4. Ordered by dependency: the measuring harness first, then the fixes it motivates, then the documents that claim
> only what was measured. Tests sit beside each task. Each task is independently checkable. "Manual" marks a pass a person
> has to run; an agent cannot mark it done.

## Milestone A: the measuring harness (changes no behaviour)

- [x] **T-01** Add `axe-core` to `devDependencies`, major pinned. Read the lockfile diff: no new install script, no new
      transitive without a reason. Record the version in `research.md`. (AC-13, C-3)
- [x] **T-02** `tests/react/a11y-axe.test.tsx`: render the fourteen states in `plan.md`, run axe with the `wcag2a`, `wcag2aa`,
      `wcag21a`, `wcag21aa` and `wcag22aa` tags, and fail on any violation. Print the rules axe could not evaluate without
      layout. (AC-02)
- [ ] **T-03** Triage the first run: every violation is either fixed (a `fix` change of its own), or recorded in `research.md`
      with the criterion it maps to. No violation is silenced. (AC-01, AC-02)
- [x] **T-04** `tests/unit/contrast-tokens.test.ts`: parse the default tokens from `styles.css`, compute the ratios in
      `research.md`, and assert them. It is expected to **fail** for the known pairs, so it first asserts the measured
      numbers (a snapshot of the baseline), and T-12 turns it into the threshold test. (AC-05)

## Milestone B: stylesheet rules, all under `wcag()`'s attribute (C-15)

- [x] **T-05** *(changed, see research.md: the handle stays 9 px and is covered by the equivalent-control exception via T-13)* `--gw-target-min: 24px`; give the resize handle a 24px hit area through a pseudo-element centred on the edge,
      leaving its visible width. A layout-mocked test for the overlap rule against the sort button. (AC-04)
- [x] **T-06** Audit every other pointer target (checkbox, sort button, filter trigger, pager buttons, row menu, picker
      controls) against 24px or the spacing exception, and fix or record each. Manual in a browser. (AC-04)
- [ ] **T-07** *(rules and test done, under `wcag()`; the Windows High Contrast pass is the maintainer's, T-27)* `@media (forced-colors: active)`: focus ring, cursor cell, selected row, sort state and priority badge, resize
      handle, checkboxes, dialogs and disabled state, in system colours (C-6). A stylesheet test that the rules exist.
      Manual in Windows High Contrast. (AC-07)
- [x] **T-08** Under `[data-gw-wcag='aa']` only (no `prefers-contrast`, C-13 superseded), reassign the failing tokens, light and
      dark: a darker `--gw-text-muted` on the hover and selected backgrounds, and a control border that reaches 3:1. Default
      tokens untouched. (AC-15)

## Milestone C: the `wcag()` add-on

- [x] **T-09** `src/react/wcag/`: `wcag()`, `WcagOptions`, `WCAG_ADDON`. One `rootAttributes` contribution,
      `data-gw-wcag="aa"`. Export from `src/react/index.ts`; add the three names to the packaging audit's expected list.
      (AC-15)
- [x] **T-10** Tests: the attribute is on the root with the add-on and absent without; it composes with `density()`; with
      `muiTheme()` the inline tokens win and the attribute is still set (pins the scope in `plan.md`). (AC-15)
- [x] **T-11** A `wcag` toggle in the playground, with a hint that a MUI-themed grid takes its colours from the theme.
- [x] **T-12** Turn `contrast-tokens.test.ts` into the threshold test for both sets: the default set's known failures are
      listed as expected failures with the criterion, and the `wcag()` set must pass every pair. (AC-05, AC-15)

## Milestone D: pointer routes in the column picker

- [x] **T-13** In `columnLayout()`'s picker, "Move {column} earlier", "Move {column} later" and a width stepper for each
      movable or resizable column, **rendered only when `wcag()` is listed**. Each result goes through the existing live-region
      contributor. No new engine API. (AC-03, AC-15)
- [x] **T-14** Messages for the new controls in `gridwright:column-layout`, in all five locales; `auditAddonMessages` passes.
      (AC-12)
- [x] **T-15** Tests: each control moves or resizes the column; is reachable by keyboard; has a name that includes the column;
      is hidden for a locked column; the announcement is the existing sentence; and none of it renders without `wcag()`. (AC-03, AC-12, AC-15)
- [x] **T-16** Playground: the `wcag` toggle's hint now names the picker buttons. Manual (done in Chrome, 2026-10-10): move and resize a column by clicks alone.

## Milestone E: focus not obscured

- [x] **T-17** Reproduce the remaining cases first, as failing layout-mocked tests: a focused cell behind a pinned column when
      scrolled sideways; a focused control behind the sticky header outside the cursor path; the filter dialog over its own
      trigger. (AC-06)
- [x] **T-18** *(one handler in `wcag()`, `src/react/wcag/focus.ts`, rather than three fixes: every focus path passes through a focus event on the root)* Fix each, extending the vertical correction from #63 to the horizontal case and to the cases found; the windowed
      grid stays unaffected. (AC-06)
- [x] **T-19** Manual: scroll a wide, pinned, virtualised grid with the keyboard in a browser and confirm the cursor is never
      fully covered. (AC-06)

## Milestone F: text spacing, zoom and reflow

- [x] **T-20** *(done 2026-10-10 except a true browser zoom, which the tool cannot press and which moves to T-27; see `research.md` milestone F)* Manual first: apply the WCAG text-spacing overrides, 200% zoom and a 320px viewport to the default grid, to
      `virtualRows()`, to `stackBelow` and to the density levels. Record what clips or scrolls. (AC-08)
- [x] **T-21** *(nothing needed fixing; `virtualRows()` decided: it grows, it does not clip)* Fix what can be fixed in the stylesheet. For `virtualRows()`, decide between overflow, clipping and a documented
      Partially Supports, and write the decision into `research.md` with the evidence. (AC-08)

## Milestone G: the report and the wording

- [x] **T-22** *(interim: criteria not yet evaluated say so, and the screen-reader and keyboard-walk evidence is open)* `docs/conformance.md`: the VPAT 2.5 structure, a row per criterion with Supports, Partially Supports, Does Not
      Support or Not Applicable and remarks, the scope from C-2, the grid version, the method and the date. Each colour
      criterion twice, default and with `wcag()` (C-14). Include the responsibilities that stay with the consumer. (AC-10)
- [x] **T-23** `docs/accessibility.md` gains a "Conformance" section linking the report. `README.md` gets one sentence, in the
      words the report supports. (AC-11)
- [x] **T-24** `tests/unit/wording.test.ts`: fails on "WCAG compliant", "508 compliant" and an unqualified "accessible" in the
      README and docs outside `docs/conformance.md`. (AC-11)
- [x] **T-25** *(`docs/addons.md` has no add-on table, so the add-on is documented in `docs/api.md` and `docs/accessibility.md`)* `docs/api.md` and `docs/addons.md` for `wcag()`, the picker message keys and `--gw-target-min`.
      `specs/DEPENDENCY_MAP.md` for the spec's relation to `column-layout`, `density` and `cell-navigation-and-clipboard`.
- [x] **T-26** CHANGELOG: one minor entry per consumer-visible change, including the `prefers-contrast` sentence in plain words
      (C-13) and the opt-in add-on.

## Milestone H: the manual passes (the maintainer, with the agent recording)

- [ ] **T-27** Browser pass with the axe extension in Chrome over the state list: contrast, target size and reflow, which jsdom
      cannot run. Record in `research.md` with the date and the browser version. (AC-01, AC-04, AC-05, AC-08)
- [ ] **T-28** Keyboard-only walk of every control in every configuration, recorded step by step. (AC-01)
- [ ] **T-29** Screen reader pass per the protocol in `research.md`: NVDA with Firefox and Chrome, Narrator with Edge;
      VoiceOver, JAWS and TalkBack listed as not tested unless run. Defects recorded word for word. (AC-09, C-8)
- [ ] **T-30** Close the matrix: no "Not assessed" row remains in `research.md`, each with its evidence and date. (AC-01)

## Stage 7

- [ ] **T-31** `npm run verify` green end to end, output recorded in `review.md`.
- [ ] **T-32** The seven review answers in `review.md`, written against what shipped, with the audit as evidence and the
      conformance wording checked against AC-11.
