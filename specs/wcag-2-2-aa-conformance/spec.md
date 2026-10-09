# Specification: WCAG 2.2 AA conformance

> **Status**: Draft. Stages 1 and 2 are done: C-3, C-7 and C-8 were answered by the maintainer on 2026-10-10 (§8).
> `plan.md` and `tasks.md` follow. Nothing is implemented, and nothing here is a claim that the grid conforms today.
> **Stage entry**: 1
> **Semver impact**: minor (provisional; confirmed in api-surface.md). No default colour changes: under the answer to
> C-7, AA-passing colours ship in a new opt-in add-on, so the `api_surface` table's "changed default is a major" is not
> triggered.

---

## 1. The consumer problem

A developer who puts this grid into a public-sector, education, banking or enterprise product is asked one question
before anyone signs: *does the component meet WCAG 2.2 AA, and where is the report?* In the United States the same
question arrives as Section 508, which for web content points at WCAG 2.0 Level A and AA. In the European Union and
Poland it arrives as EN 301 549 and the accessibility law that implements the European Accessibility Act, which today
point at WCAG 2.1 AA. WCAG 2.2 AA is a superset of both for the criteria that carry over, so one target answers all
three.

Today the package cannot answer. It is built to the WAI-ARIA grid pattern, keeps its keyboard and announcement rules in
`docs/accessibility.md`, and tests the ARIA state it publishes. But it has never been measured against the standard:

- the words WCAG, 508 and VPAT appear nowhere in the repository, and there is no conformance report;
- nothing automated (axe or similar) runs in CI, and nothing measures colour contrast, target size or reflow;
- the documentation says so itself: every behaviour is asserted against the accessibility tree "as the DOM exposes it",
  which "is not the same as having heard NVDA or VoiceOver read the grid";
- reading the code against the three criteria WCAG 2.2 added (2.4.11, 2.5.7, 2.5.8) shows probable gaps, listed in
  `research.md`.

A developer who cannot show a report has to audit the grid themselves, or not use it. A package that wrote
"WCAG compliant" on its README without the audit would be worse: the sentence is a legal statement in some of the
places this grid is used.

This spec makes the claim earnable, and says exactly how it is earned: an audit of every Level A and AA success
criterion, fixes for the criteria the grid fails, tests that keep the fixes fixed, and a published conformance report
that says "supports", "partially supports" or "does not support" per criterion, never more.

## 2. User stories

- **US-01.** As a developer, I want a conformance report for the grid, in the format procurement asks for (the VPAT 2.5
  structure: WCAG, Section 508 and EN 301 549), so I can attach it to my product's own report instead of auditing a
  dependency.
- **US-02.** As a developer, I want to know which add-on combinations and configurations the report covers, and which
  parts of conformance are mine (colour theme, cell content, page title), so I do not claim what the grid cannot give me.
- **US-03.** As a keyboard user, I want every way of reordering or resizing a column to work without a mouse, and every
  control I focus to stay visible, not hidden under a sticky header or a pinned column.
- **US-04.** As a user who cannot drag (a tremor, a switch device, a head pointer), I want to move and resize a column
  with single clicks, not by dragging.
- **US-05.** As a user on a touch screen or with a pointing device I steer imprecisely, I want controls large enough
  to hit, or spaced far enough apart.
- **US-06.** As a low-vision user, I want the grid to follow my forced-colours scheme, to keep its contrast, and to keep
  its content when I zoom or change text spacing.
- **US-07.** As a screen reader user, I want the behaviour the documentation promises to have been heard in a real
  screen reader, not only asserted against the DOM.
- **US-08.** As a maintainer, I want a regression to be caught by CI, not by a complaint.

## 3. Acceptance criteria

Each becomes at least one test or a recorded manual pass. "Level A/AA criterion" means a success criterion of WCAG 2.2
at Level A or AA that applies to a component (the table is in `research.md`).

- [ ] **AC-01** An audit exists: `research.md` carries one row for every Level A and AA success criterion of WCAG 2.2
      with a status, evidence and a date, and no row is "Not assessed". A criterion that cannot apply to a component
      says why.
- [ ] **AC-02** An automated pass runs in CI over a defined set of grid states (default grid, sorted, filtered with a
      dialog open, selection, grouping, tree, virtualised, `stackBelow`, loading, empty, error, stale rows, density
      levels, a locale) with zero violations of the axe rule sets for WCAG 2.0, 2.1 and 2.2 at A and AA. Rules that need
      layout (contrast, target size) are covered by AC-05 and AC-06 instead, and the spec states which rules jsdom cannot run.
- [ ] **AC-03** *2.5.7 Dragging Movements.* Moving a column and resizing a column each have a single-pointer route that
      needs no dragging (for example buttons in the column picker), beside the existing drag and keyboard routes.
- [ ] **AC-04** *2.5.8 Target Size (Minimum).* Every pointer target the grid renders is at least 24 by 24 CSS pixels, or
      meets the spacing exception, or has a documented exception. The resize handle's hit area is widened without
      changing how it looks.
- [ ] **AC-05** *1.4.3 and 1.4.11 Contrast.* The default colour tokens are measured and every result is published in the
      report, light and dark, failures included. A test computes the ratios from the stylesheet's tokens, for the default
      set and for the `contrast()` set (AC-15), so a token change that breaks either fails CI. The baseline measurement
      is in `research.md`: the default set has failing pairs, and AC-15 is how they are fixed without changing a default.
- [ ] **AC-06** *2.4.11 Focus Not Obscured (Minimum).* A focused element is never entirely hidden by the sticky header or
      a pinned column, in a scrolling wrapper, in a virtualised grid, and when the grid is scrolled sideways. Covered by
      a layout-mocked test per case and a recorded browser pass.
- [ ] **AC-07** *Forced colours.* Under `forced-colors: active` the focus ring, cursor cell, selected row, sort state,
      resize handle, checkboxes and dialogs stay visible and distinguishable, using system colours. Recorded browser pass
      in Windows High Contrast, and a stylesheet test that the rules exist.
- [ ] **AC-08** *1.4.4, 1.4.10, 1.4.12 Resize, Reflow, Text Spacing.* At 200% zoom, at a 320 CSS pixel viewport and with
      the WCAG text-spacing overrides applied, no content or function is lost. Cells that truncate or have fixed heights
      (virtualised rows) are checked specifically. Data tables are exempt from two-dimensional scrolling in 1.4.10, and
      the report says that is the claim made; `stackBelow` is the reflow mode.
- [ ] **AC-09** *Screen readers.* The behaviours in `docs/accessibility.md` are heard, not only asserted, in at least NVDA
      with Firefox or Chrome on Windows and VoiceOver with Safari on macOS, with the sentences heard and the defects found
      recorded in `research.md`. The unverified `stackBelow` layout is included.
- [ ] **AC-10** A conformance report is published as `docs/conformance.md` in the VPAT 2.5 structure, with a row per
      criterion that says Supports, Partially Supports, Does Not Support or Not Applicable, with remarks. It states the
      scope (§4, C-2), the version it covers, the test method and the date.
- [ ] **AC-11** The README and `docs/accessibility.md` describe conformance only in the words the report supports. No
      document says "WCAG compliant", "accessible" without qualification, or "508 compliant". A test fails on those phrases
      outside the report.
- [ ] **AC-12** Every string a new control adds is in the add-on's messages in all five locales (`auditAddonMessages`
      passes), and every new control is reachable by keyboard and has an accessible name.
- [ ] **AC-13** Zero runtime dependencies. A development-only dependency for AC-02 is allowed only through the
      decision recorded under C-3.
- [ ] **AC-14** The existing accessibility tests, the smoke suite and `npm run verify` still pass; the public API of
      every shipped add-on is unchanged except as api-surface.md lists.
- [ ] **AC-15** *The `contrast()` add-on (C-7, C-12).* Listing `contrast()` puts `data-gw-contrast="aa"` on the root, and
      the stylesheet reassigns the failing tokens under it, in light and dark, so every pair in the measured table in
      `research.md` passes. Without the add-on nothing changes: no default token, and no rendered pixel, differs from
      0.15.0. The report states each colour criterion twice, once for the default grid and once with the add-on.
- [ ] **AC-16** *`prefers-contrast: more` (C-13).* The same overrides apply with no add-on and no option when the reader's
      system asks for more contrast, so the people who need it get it without the developer having opted in. It changes
      nothing for anyone else.

## 4. Non-goals

- **Certifying the consumer's application.** The report covers the grid and its first-party add-ons. The page title,
  language of the page, headings, skip links, the consumer's colour theme, their cell content and their own
  add-ons are theirs, and the report says so in a "responsibilities" section rather than leaving it implied.
- **WCAG AAA.** No Level AAA criterion is targeted. Where one is cheap (for example 2.5.5), it is noted, not promised.
- **Legal advice.** This spec and the report are engineering documents. Whether they satisfy a statute or a contract
  is for the consumer's counsel.
- **The accessibility of exported files.** The export menu is a control and is in scope. The CSV, Excel, Markdown, PDF
  and print files it produces are not; tagging a PDF is a separate piece of work.
- **An accessibility mode for behaviour.** Structure, keyboard, announcements, focus and target size are fixed in place
  for everyone, not behind a flag a consumer has to know to switch on: a grid that is only accessible when configured is
  not. **Colour is the one exception**, by the maintainer's decision (C-7): colour is the consumer's theme, and changing
  a default is a major, so AA-passing colours are an opt-in add-on plus the reader's own `prefers-contrast` setting. The
  cost is stated in C-14.
- **Claiming conformance in the package metadata** (npm keywords, a badge) before AC-10 exists.

## 5. Behaviour across the capability seam

Conformance does not depend on where the rows come from, and the audit must show that rather than assume it.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Every state in AC-02 passes. The synchronous source publishes no loading state, so the loading row is exercised from a remote source in the test set. |
| everything (server) | Loading, refreshing, stale-rows and error states pass AC-02, are announced exactly once, and keep focus (the existing contract in `docs/accessibility.md`). |
| pagination only | `aria-rowcount` is `-1` while the total is unknown (an existing behaviour, kept), and the range and pager are named and operable. |

## 6. Accessibility and interface copy

This feature is accessibility, so the interface rules are the acceptance criteria. New copy:

- The single-pointer routes (AC-03) are buttons in the column picker. They need messages for moving a column earlier
  and later and for changing its width, in the `gridwright:column-layout` add-on's messages, in five locales. Their
  names must say which column they act on ("Move Salary earlier"), and the result is announced through the existing
  live-region contributor, which already says "{column} moved to position {n} of {total}".
- The enlarged resize handle changes no copy.
- No new announcement is added for forced colours or contrast; they are visual.

## 7. Delivery as a plugin

No engine plugin. The work is in five places:

- **The stylesheet** (`src/styles/styles.css`): `forced-colors` rules, the resize handle's hit area, a token for the
  minimum target size, and the AA token overrides under `[data-gw-contrast='aa']` and `@media (prefers-contrast: more)`.
  The defaults are not touched.
- **A new `contrast()` add-on** (`src/react/contrast/`), shaped like `density()`: it contributes `data-gw-contrast="aa"` to
  the root through `rootAttributes` and nothing else. It has no UI, so no messages and no locale keys. A built-in uses the
  same slot a third-party theme add-on does.
- **The `columnLayout()` add-on**: move and width controls in the picker (AC-03). It already owns reordering, resizing,
  the picker and the announcements, so nothing moves between add-ons.
- **`cellNavigation()` and the shell's scroll handling**: keeping a focused element clear of a sticky header and pinned
  columns (AC-06). #63 fixed the header case for a scrolling wrapper; this extends it to the cases listed in AC-06.
- **Tests and the audit**: an axe pass, a contrast calculation from tokens, layout-mocked tests for AC-06, and the
  `research.md` matrix and `docs/conformance.md` report.

Nothing here needs a seam a third-party add-on lacks. The picker controls go through the same slots every add-on uses.

## 8. Clarifications

Stage 2. These are open. Each needs the maintainer's answer before stage 3 freezes the API surface, and the default
proposed is inherited by every consumer if it is not changed.

| # | Question | Proposed default | Why it matters |
| :--- | :--- | :--- | :--- |
| C-1 | What is claimed: "conforms", or a per-criterion report? | A per-criterion Accessibility Conformance Report in the VPAT 2.5 structure. No blanket "WCAG 2.2 AA compliant" sentence anywhere. | A blanket sentence is a legal statement. A report with "Partially Supports" rows is true and is what procurement reads. |
| C-2 | What does the report cover? | The default grid, each first-party add-on alone, and the combinations in the README's examples. The MUI package's three views are covered for structure and keyboard, but their colours come from the MUI theme and are the consumer's. | "The grid" is not one configuration. Claiming every combination is unprovable; claiming only the default hides the add-ons people use. |
| C-3 | How is the automated pass run, and may it add a development dependency? | **Resolved (maintainer, 2026-10-10): yes.** `axe-core` as a **development** dependency, run in jsdom for structure and ARIA rules; a real-browser pass (Chrome with the axe extension, recorded by hand) for contrast, target size and reflow. Checked against `security_guard`: `axe-core` 4.14.0 declares no dependencies and no install scripts; its licence is MPL-2.0, which is acceptable for a tool that never enters the tarball. Pin the major, and read the lockfile diff when it is added. | jsdom has no layout, so it cannot run contrast or target-size rules. A dev dependency leaves the zero-runtime-dependency rule intact. A browser-automation dependency (Playwright) is a heavier second choice, left for later if the manual browser pass proves too costly. |
| C-4 | Which single-pointer route for reorder and resize? | Buttons in the column picker: "Move {column} earlier", "Move {column} later", and a width stepper per column. | A picker already exists and already lists every column, so no new surface appears on the header, where space is tight and the sort button lives. |
| C-5 | How is the resize handle made large enough? | A 24px hit area centred on the column edge through a pseudo-element, with the visible line unchanged. | The handle sits against the sort button. A wider target must not steal clicks from it, so the spacing exception and the overlap are checked in a real browser. |
| C-6 | Forced colours: which system colours? | `Canvas`, `CanvasText`, `Highlight`, `HighlightText`, `ButtonText` and `GrayText` for borders, focus, selection and disabled state, with `forced-color-adjust: auto` left alone elsewhere. | The browser overrides author colours, so a state expressed only as a background disappears. Each state needs a border or outline that survives. |
| C-7 | May default colour tokens change to meet contrast? | **Resolved (maintainer, 2026-10-10): yes in principle, but prefer an opt-in.** So the defaults do **not** change. AA-passing colours ship as a `contrast()` add-on (C-12), and also apply automatically for a reader whose system asks for more contrast (C-13). | A changed default is a **major** in the `api_surface` table. An opt-in add-on is a new export, a minor, and no consumer's grid changes on upgrade. The price is C-14: the default grid keeps its failing colour pairs, and the report says so. |
| C-8 | Which screen-reader pairs, and who runs them? | **Resolved (maintainer, 2026-10-10): the maintainer will try.** The development machine is Windows, so the minimum is **NVDA** (free) with Firefox and with Chrome, and **Narrator** with Edge, which Windows ships. VoiceOver with Safari needs a Mac and is "not tested" unless the maintainer has access to one; JAWS and TalkBack likewise. The protocol is in `research.md`: it says what to press and what to write down, so the result is a record, not an impression. | An agent cannot hear a screen reader. This criterion cannot be marked done by code. A pair that was not run is listed as not tested, not omitted. |
| C-9 | Is Section 508 mapped separately from WCAG? | One report, with the three columns the VPAT 2.5 template provides (WCAG, Revised Section 508, EN 301 549). Section 508's Chapter 5 (software) and Chapter 6 (documentation) rows are marked Not Applicable or addressed by `docs/accessibility.md`. | Revised 508 references WCAG 2.0 A/AA, which still lists 4.1.1 Parsing; WCAG 2.2 dropped it. The report states how 4.1.1 is handled for the 508 and EN columns. |
| C-10 | Where is the report kept and how is it versioned? | `docs/conformance.md`, linked from the README, dated, and tied to a grid version. It is refreshed when the audit is rerun, not on every release. | A report for 0.15.0 that nobody updates will be quoted against 0.20. It states the version it covers. |
| C-11 | What counts as a pass for a criterion that depends on the consumer (cell content, theme)? | Supports, with a remark naming the consumer's part. | Marking it Not Applicable would hide a failure the consumer can cause with a one-line theme. |
| C-12 | What is the opt-in called, and what does it take? | `contrast()`, no options, AA only. `density()` and `responsive()` are the naming precedent. A `level` option is deliberately not added: AAA is a non-goal, and an option can be added later without breaking anyone. | The name is public and cannot be changed without a major. "High contrast" was avoided: that term already means the operating system's forced-colours mode (AC-07), a different thing. |
| C-13 | Does the stylesheet also honour the reader's `prefers-contrast: more`, with no add-on? | Yes, with the same overrides as `contrast()`. It changes nothing for anyone who has not asked their system for more contrast. | It is the people who need it who get it, without the developer knowing to ask. It also means the add-on is not the only route, so the "only accessible when configured" objection in §4 applies to colour only for those who have not asked. |
| C-14 | May the report call the default grid "Partially Supports" on 1.4.3 and 1.4.11, and "Supports" with `contrast()` listed? | Yes. Both rows are published, with the failing pairs named. | This is the price of C-7: a developer who wants an unqualified AA statement for the default grid has to list the add-on, and a developer who does not will inherit failing pairs. It is honest, and the maintainer should confirm it is acceptable before the report is written. |

## Artifacts not written

- `data-model.md`: no state or type shape changes. The add-on is one attribute and the picker controls use existing state.
- `events.md`: no event is emitted and no pipeline stage is added.
