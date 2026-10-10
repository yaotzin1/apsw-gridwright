# Research: WCAG 2.2 AA baseline

> **This is a baseline from reading, not an audit.** Written 2026-10-10 from `docs/accessibility.md`, the names of the
> tests in `tests/react/accessible-state.test.tsx`, `src/styles/styles.css` and a handful of greps. No browser was
> opened, no screen reader was run, no tool measured a ratio. Every status below is a hypothesis for the audit
> (AC-01) to confirm or overturn. Do not quote this file as a conformance claim.

## Vocabulary

| Status | Meaning |
| :--- | :--- |
| **Tested** | A test in the repository asserts the behaviour that satisfies the criterion. Named where known. |
| **Believed met** | The design satisfies it by reading, and no test or measurement shows it. |
| **Probable gap** | Reading the code suggests it fails. Not yet confirmed in a browser. |
| **Not assessed** | Nothing was looked at. The audit must settle it. |
| **N/A** | The criterion does not apply to a component (media, page-level, authentication). The reason is given. |
| **Consumer** | The outcome depends on what the consumer supplies (theme, cell content, page). The report says what is theirs. |

## Baseline matrix: WCAG 2.2, Level A and AA

All 55 success criteria. 4.1.1 Parsing is not listed because WCAG 2.2 removed it; see "Section 508 and EN 301 549" below.

### 1 Perceivable

| SC | Level | Status | Basis and what the audit must check |
| :--- | :--- | :--- | :--- |
| 1.1.1 Non-text Content | A | Believed met | Sort arrows are `aria-hidden` decoration; icons come from consumer cell renderers (**Consumer**). Check the `icon` column field and the three-dot row trigger for names. |
| 1.2.1 to 1.2.5 Time-based Media | A, AA | N/A | The grid renders no audio or video. |
| 1.3.1 Info and Relationships | A | **Tested** | Real `<table>`, `<th scope="col">`, `aria-sort`, `aria-rowindex`/`aria-rowcount`, `treegrid` levels (`accessible-state.test.tsx`). `stackBelow` sets explicit roles because `display: block` drops table semantics; not re-tested here. |
| 1.3.2 Meaningful Sequence | A | Believed met | DOM order is reading order. Check `stackBelow`, where header cells are visually hidden but stay in the document. |
| 1.3.3 Sensory Characteristics | A | Believed met | Sort priority is spoken ("sort priority 2"), not only a badge. Check help text for "the arrow" or colour references. |
| 1.3.4 Orientation | AA | Believed met | Nothing locks orientation. |
| 1.3.5 Identify Input Purpose | AA | N/A | The search and filter inputs collect no personal data from the user's own list. |
| 1.4.1 Use of Color | A | **Not assessed** | Check selected row, hover, cursor cell, sort state and error/stale styling for state carried by colour alone. |
| 1.4.2 Audio Control | A | N/A | No audio. |
| 1.4.3 Contrast (Minimum) | AA | **Probable gap (measured from tokens)** | Body text, danger text and button text pass. `--gw-text-muted` misses 4.5:1 on the hover and selected backgrounds (light 4.34 and 4.37, dark selected 4.04). Token arithmetic, not a rendered measurement; see "Measured contrast" below. AC-05, AC-15. |
| 1.4.4 Resize Text | AA | **Not assessed** | Check units. The stylesheet mixes `px` (the resize handle is `9px`) and relative units. Cells use `overflow: hidden; text-overflow: ellipsis`, which clips at 200%. |
| 1.4.5 Images of Text | AA | N/A | No text is rendered as an image. |
| 1.4.10 Reflow | AA | **Partial by design** | A data table may scroll in two dimensions (WCAG's exception). `stackBelow` gives a reflowing card layout, documented as "not yet verified" with screen readers. Check at 320 CSS px. |
| 1.4.11 Non-text Contrast | AA | **Probable gap (measured from tokens)** | The focus ring colour passes (5.17:1 light, 7.02:1 dark). `--gw-border` and `--gw-border-strong` are 1.2 to 2.4:1 against the 3:1 asked of the boundary of a control, and the search box and the select are identified by that border. Row and cell separators are decoration and exempt. Resize handle, sort badge and cursor cell not yet looked at. AC-05, AC-15. |
| 1.4.12 Text Spacing | AA | **Probable gap** | `virtualRows()` uses fixed row heights (32 and 52 under density) and cells truncate, so increased line height and spacing can clip. AC-08. |
| 1.4.13 Content on Hover or Focus | AA | Believed met | Tooltips are native `title` (user-agent, exempt). The filter dialog and row menu open on activation, not hover. Check that each dismisses on `Esc` without moving focus. |

### 2 Operable

| SC | Level | Status | Basis and what the audit must check |
| :--- | :--- | :--- | :--- |
| 2.1.1 Keyboard | A | **Partly tested** | One Tab stop with arrows (`cell-navigation` tests), sort and select are buttons, resize and reorder have keyboard routes, copy has a shortcut. Without `cellNavigation()` the grid is "a table" with hundreds of Tab stops: operable, not efficient. Check the filter dialog, export menu and column picker end to end. |
| 2.1.2 No Keyboard Trap | A | Believed met | The filter dialog is `aria-modal` and closes on `Esc`. Check the export menu and row menu. |
| 2.1.4 Character Key Shortcuts | A | Believed met | Shortcuts use `Ctrl`/`Cmd`; `Space`, `Enter` and `F2` act only on a focused cell. No single-letter shortcuts. |
| 2.2.1 Timing Adjustable | A | N/A | No time limits (a debounce is not one). |
| 2.2.2 Pause, Stop, Hide | A | **Not assessed** | The loading skeleton animates (`background-position` keyframes). Check whether it can run past five seconds, is essential, and respects `prefers-reduced-motion` (8 rules exist). |
| 2.3.1 Three Flashes | A | Believed met | No flashing content. |
| 2.4.1 Bypass Blocks | A | Consumer | Page-level. The component's contribution is the single Tab stop, which only exists with `cellNavigation()`. |
| 2.4.2 Page Titled | A | N/A | Page-level, the consumer's. |
| 2.4.3 Focus Order | A | **Tested** | Focus returns to the trigger after the filter dialog; focus stays in the grid when a page control disables itself (`accessible-state.test.tsx`). |
| 2.4.4 Link Purpose | A | N/A | The grid renders no links of its own. |
| 2.4.5 Multiple Ways | AA | N/A | Page-level. |
| 2.4.6 Headings and Labels | AA | Believed met | Controls are named. The grid's own name is the consumer's `aria-label`, which the docs ask for and nothing enforces (see "Gaps that are not a single criterion" below). |
| 2.4.7 Focus Visible | AA | **Not assessed** | `:focus-visible` rules exist for the search box, select, buttons, sort button and checkbox. Check the cursor cell, resize handle, filter trigger, dialog controls and row menu. |
| 2.4.11 Focus Not Obscured (Minimum) | AA | **Probable gap, partly fixed** | #63 fixed a cursor cell hidden under the sticky header in a scrolling wrapper (0.15.0). Not checked: pinned columns hiding a focused cell sideways, a focused control under the sticky header in other layouts, and the filter dialog over a focused element. AC-06. |
| 2.5.1 Pointer Gestures | A | Believed met | No multi-point or path-based gesture. The resize handle sets `touch-action: none`, which is a drag, covered under 2.5.7. |
| 2.5.2 Pointer Cancellation | A | **Not assessed** | Check that a drag (resize, reorder) can be abandoned without applying and that activation happens on the up event. |
| 2.5.3 Label in Name | A | Believed met | Sort button names start with the visible header text. Icon-only controls have no visible label to match. |
| 2.5.4 Motion Actuation | A | N/A | No motion input. |
| 2.5.7 Dragging Movements | AA | **Probable gap** | Reorder is a drag or `Ctrl+Arrow`; resize is a drag or arrow keys on the handle. WCAG asks for a **single-pointer** alternative, and a keyboard alternative does not satisfy it. The column picker has show/hide but no move or width control. AC-03. |
| 2.5.8 Target Size (Minimum) | AA | **Probable gap** | The resize handle is `9px` wide beside the sort button. Native checkboxes are small. The `44px` target (`--gw-touch-target`) applies only to touch row actions. Needs measuring against the 24px rule and its spacing exception. AC-04. |

### 3 Understandable

| SC | Level | Status | Basis and what the audit must check |
| :--- | :--- | :--- | :--- |
| 3.1.1 Language of Page | A | Consumer | Page-level. The grid sets `lang` on its root from the translator. |
| 3.1.2 Language of Parts | AA | Believed met | Root `lang` is the grid's locale. Mixed-language cell content is the consumer's. |
| 3.2.1 On Focus | A | Believed met | Focus never changes context. |
| 3.2.2 On Input | A | **Not assessed** | The page-size `<select>` applies on change. That is a content change rather than a change of context, but it should be checked and recorded. |
| 3.2.3 Consistent Navigation | AA | N/A | Page-level. |
| 3.2.4 Consistent Identification | AA | Believed met | The same control carries the same name across add-ons. Check the five locales. |
| 3.2.6 Consistent Help | A | N/A | The component offers no help mechanism. |
| 3.3.1 Error Identification | A | **Not assessed** | Fetch errors are `role="alert"`. In the filter dialog, "Apply" stays off until the condition is complete, with no stated reason. Check whether that is an error that has to be identified in text. |
| 3.3.2 Labels or Instructions | A | Believed met | Dialog fields are labelled. Check the date and number operators. |
| 3.3.3 Error Suggestion | AA | **Not assessed** | Same filter-dialog question as 3.3.1. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | N/A | The grid submits no legal or financial data. Inline editing is the consumer's. |
| 3.3.7 Redundant Entry | A | N/A | No multi-step entry. |
| 3.3.8 Accessible Authentication (Minimum) | AA | N/A | No authentication. |

### 4 Robust

| SC | Level | Status | Basis and what the audit must check |
| :--- | :--- | :--- | :--- |
| 4.1.2 Name, Role, Value | A | **Tested** | Names, `aria-sort`, `aria-selected`, `aria-multiselectable`, `aria-expanded`, `aria-level` asserted by role query. Resize handle is a `separator` with a value. Check the stacked layout's explicit roles in a real screen reader. |
| 4.1.3 Status Messages | AA | **Tested** | One `role="status"` region; announcement order, silence on no change, and failure handling are asserted (`accessible-state.test.tsx`, 23 tests). Heard in a screen reader: **no**. |

## Where the baseline stands

Counting the 55 rows above (a range counts as one row of the table, not as the several criteria it names):

- **Tested:** 1.3.1, 2.4.3, 4.1.2, 4.1.3, and 2.1.1 in part.
- **Probable gap:** 1.4.3 and 1.4.11 (both measured from the tokens), 1.4.12, 2.4.11 (partly fixed), 2.5.7, 2.5.8.
- **Not assessed:** 1.4.1, 1.4.4, 2.2.2, 2.4.7, 2.5.2, 3.2.2, 3.3.1, 3.3.3.
- **N/A for a component:** the five time-based media criteria, 1.3.5, 1.4.2, 1.4.5, 2.2.1, 2.4.2, 2.4.4, 2.4.5, 2.5.4, 3.2.3, 3.2.6, 3.3.4, 3.3.7, 3.3.8.
- **Consumer, or partly:** 2.4.1, 3.1.1, and the theme and content parts of several others.

The count that matters is the second and third lines: **fourteen criteria need a decision** before a report can be written.

## Measured contrast of the default tokens

Computed 2026-10-10 from the hex values in `src/styles/styles.css`, with the WCAG relative-luminance formula (a throwaway
script, not committed; AC-05 turns it into a test). **These are token pair ratios, not what renders:** a consumer's theme,
a translucent overlay or an image behind a cell changes the real number. Text needs 4.5:1; the boundary of a control and a
focus indicator need 3:1.

| Pair | Needs | Light | Dark |
| :--- | ---: | ---: | ---: |
| text on surface | 4.5 | 17.85 | 14.48 |
| text on surface-muted (header, stripe) | 4.5 | 17.06 | 11.87 |
| text on surface-hover | 4.5 | 16.30 | 11.87 |
| text on surface-selected | 4.5 | 16.40 | 8.40 |
| text-muted on surface | 4.5 | 4.76 | 6.96 |
| text-muted on surface-muted | 4.5 | 4.55 | 5.71 |
| **text-muted on surface-hover** | 4.5 | **4.34 fail** | 5.71 |
| **text-muted on surface-selected** | 4.5 | **4.37 fail** | **4.04 fail** |
| danger text on surface | 4.5 | 6.47 | 9.41 |
| accent-contrast on accent (button text) | 4.5 | 5.17 | 7.02 |
| accent on surface (focus ring) | 3 | 5.17 | 7.02 |
| **border on surface (control boundary)** | 3 | **1.23 fail** | **1.72 fail** |
| **border-strong on surface (control boundary)** | 3 | **1.48 fail** | **2.36 fail** |

Reading it: the colours the grid uses for ordinary text, buttons and the focus ring are well clear. The failures are the
muted text on a hover or selected row, which misses by about 0.15 in light and 0.5 in dark, and the control borders, which
miss by a lot. `wcag()` (AC-15) is a small set of token overrides: a darker `--gw-text-muted` for the hover and selected
backgrounds, and a border that reaches 3:1 for controls, in both schemes. Which exact values is stage 6's work, tested by
the same arithmetic.

## Screen-reader protocol (C-8, the maintainer runs this)

The point is a **record**, so write down what you heard, word for word, and what you did to hear it. "Seemed fine" is not a
result. Use the grid in the playground (`examples/playground`) with `cellNavigation()` on, and repeat with it off.

**Set-up.** Windows machine. Install NVDA (free, nvaccess.org). Pairs to run: NVDA + Firefox, NVDA + Chrome, Narrator + Edge
(Windows key + Ctrl + Enter starts it). Turn the screen off or close your eyes for the pass; sighted shortcuts hide defects.
Mark VoiceOver + Safari, JAWS and TalkBack "not tested" unless you can run them.

**For each pair, do these and record what is spoken:**

1. **Arrive.** Tab until you reach the grid. *Record:* what it announces when you land (name, role, "table" or "grid",
   row and column count).
2. **Read a cell.** Press the arrow keys across and down. *Record:* does each cell read with its column header? Is the row
   number the absolute one (page 2 starts at 26, not 1)?
3. **Sort.** Move to a header, press Enter, then again, then Shift+Enter on a second column. *Record:* the sentence after each
   (the doc promises "Name, sorted ascending", and "sort priority 2" for the second).
4. **Page.** Use the next-page button. *Record:* the sentence after the rows change; whether focus stays in the grid at the
   last page.
5. **Filter.** Open a column filter, set a value, apply. *Record:* does the dialog announce its name and trap focus; is
   "filtered" announced; does `Esc` return you to the button?
6. **Select.** Tick a row, then the header checkbox. *Record:* "selected", "partly selected", and the header's state.
7. **Group and tree.** With grouping on, expand and collapse a group; with the tree on, expand a node. *Record:* is the
   level and the expanded state read, and the new range ("1 to 98 of 250")?
8. **Resize and move.** On a resize handle press the arrows; on a header press Ctrl+arrow. *Record:* the width and position
   sentences.
9. **An error.** Use the playground's "fail the next request". *Record:* is the alert spoken once, not twice?
10. **`stackBelow`.** Narrow the window below the breakpoint. *Record:* the card layout, which the docs call unverified. Each
    value should be read once with its column header.

**For every defect:** the pair, the step, what was spoken, what you expected, and whether it is the grid or the pair
(a Narrator bug is not a grid bug). These go in `research.md` under a new heading, with the date and the versions of the
screen reader and browser.

## Gaps that are not a single criterion

- **No test measures anything layout-dependent.** jsdom has no layout, so contrast, target size, reflow, forced colours and
  "obscured" cannot be run there. They need a real browser, recorded by hand until C-3 decides on automation.
- **`aria-label` is advice, not a requirement.** The docs say a grid should be given one, and nothing warns when it is
  missing. A grid without an accessible name is a failure of 2.4.6 and 4.1.2 in the consumer's page. Whether the component
  should warn in development is a question for stage 3.
- **No screen reader has been used.** The docs say so. This is C-8.
- **No conformance document exists** for a developer to attach to a procurement request (US-01).

## Section 508 and EN 301 549

- **Revised Section 508** (2017) incorporates **WCAG 2.0 Level A and AA** by reference for web content, and adds Chapter 3
  functional performance criteria, Chapter 5 for software and Chapter 6 for support documentation. A WCAG 2.2 AA report
  covers the web-content criteria that carried over from 2.0.
- **4.1.1 Parsing** is the one difference that matters: WCAG 2.2 removed it, but the 508 column still names it. React emits
  well-formed markup, so the report can mark it Supports with that remark, to be confirmed with a markup validator pass
  in the audit.
- **EN 301 549** (EU) incorporates **WCAG 2.1 AA** in its current published edition, as I understand it, with its own
  clauses for software and documentation. The European Accessibility Act applies from June 2025 and the Polish accessibility
  law for public bodies refers to WCAG 2.1 AA through the same standard. The consumer's counsel should confirm which edition
  applies to their product; this spec does not decide it.
- **A library is not certified.** The standards apply to a product or service. What the library can supply is the
  conformance report (VPAT 2.5) the consumer builds on, which is what AC-10 delivers.

## Method for the audit (stage 7 of this feature, not done)

1. A written list of states and configurations (AC-02, C-2), so "the grid" means something specific.
2. `axe-core` over each state in jsdom (structure, ARIA, names), then in a real browser for contrast, target size and reflow.
3. A keyboard-only walk of every control, in every configuration, recorded step by step.
4. A forced-colours pass in Windows High Contrast; a 200% zoom, 320px and text-spacing pass.
5. A screen reader pass per C-8, with the sentences heard written down, not paraphrased.
6. A row per criterion in `docs/conformance.md`, with the evidence for it, and the date.

Each of these needs a person for some part of it. The spec marks which.

## Milestone A: the automated harness (2026-10-10)

- `axe-core` 4.14.0 added as a development dependency (`^4.14.0`). The lockfile diff is that one package: no
  transitive dependencies, no install script. Licence MPL-2.0; it never enters the tarball.
- `tests/react/a11y-axe.test.tsx` renders 24 states (the 14 in `plan.md`, with the sub-states listed out) under the
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags. The MUI views run the same file through
  `packages/mui/tests/shared-suites.test.tsx`.
- **Triage (T-03): the first complete run found no violations in any state**, native or MUI. A self-check renders an
  unnamed button and an image without alt text and requires axe to report both, so the empty result is not the harness
  failing to look.
- Rules switched off by name because jsdom has no layout or canvas: `color-contrast`, `color-contrast-enhanced`,
  `target-size`, `scrollable-region-focusable`. These stay with the token test (T-04) and the browser pass (T-27).
- Rules axe returned as undecided (incomplete) in jsdom: `label-content-name-mismatch` (most states),
  `aria-valid-attr-value` (two), `form-field-multiple-labels` (one). Not yet looked at one by one; T-27 re-runs them in
  Chrome, where they can be decided.
- `tests/unit/contrast-tokens.test.ts` (T-04) parses the tokens from `styles.css` and reproduces the table above to two
  decimals, light and dark, so the baseline is now a test. It also asserts the list of failing pairs (four light, three
  dark) and that the two dark palettes in the stylesheet are identical. T-12 adds the `wcag()` set.

## Milestone B: stylesheet rules (2026-10-10; reworked the same day under C-15)

**Everything below applies under `[data-gw-wcag='aa']` only.** The first commit of this milestone changed the defaults (24px
controls, `prefers-contrast`, forced-colours rules for every grid). The maintainer then asked for all of it to be opt-in
(C-15), so those rules were moved under the attribute, `prefers-contrast` was dropped, and the default stylesheet is back to
byte-for-byte additive: nothing that existed was edited. Measured in the playground: with `wcag` off a checkbox is 13px, a
detail toggle 20px and `--gw-text-muted` is the default; with it on, 24px, 24px and the AA value.

Measured in Chrome on the playground (every add-on that draws a control switched on) and on the MUI showcase, with
`getBoundingClientRect` and `elementFromPoint`.

**Pointer targets (T-05, T-06).** Failing before: row checkbox 13x13, tree toggle, group toggle and row-detail toggle 20x20,
column resize handle 9 px wide. Passing: sort button (36 high), filter trigger (28x36), pager buttons (34x34), search,
selects, column picker and export triggers (34 high), row-actions trigger (39x25). In the MUI views: checkbox 38x38, icon
buttons 28-30, sort label 36 high. Fixed, under `wcag()`, with `--gw-target-min: 24px`, which the checkbox and the three toggles then use; the
MUI views get the toggles and the resize handle from the same stylesheet.

**The resize handle stays 9 px, by decision.** A pseudo-element widening it was built and measured. It cannot win the overlap:
every header cell is its own stacking context (`z-index: 1`, or 4 when pinned, inline), so the next cell always paints over an
overhang; the filter button ends 4 px short of the cell edge, so an inward hit area would shrink it below 24 px; only the last
column's handle got the full width. The CSS was removed rather than shipped doing nothing for most columns. The criterion is
met by its *equivalent control* exception instead: resizing is also possible from the keyboard and, with T-13, from a width
control in the column picker, a conforming target. If T-13 is not built, this row becomes Partially Supports in the report.

**Contrast tokens (T-08).** Under `[data-gw-wcag='aa']` (there is no `prefers-contrast` rule any more): light `--gw-text-muted` #475569
(6.9:1 or better on every row ground), `--gw-border` #7c8aa0 (3.5:1 on surface), `--gw-border-strong` #64748b (4.8:1); dark
`--gw-text-muted` #cbd5e1 (7.0:1 or better), `--gw-border` #7c8aa0 (5.1:1), `--gw-border-strong` #94a3b8. All 13 pairs pass in
both schemes (`tests/unit/contrast-tokens.test.ts`). Checked in the browser: all six combinations of OS scheme, theme
attribute and contrast attribute resolve to the right values. A MUI-themed grid is not recoloured (inline tokens win), which is
the C-2 scope. `wcag()` sets the attribute (Milestone C).

**Forced colours (T-07).** Rules added for the focus ring (box-shadow is dropped in this mode), the cursor cell, the selected
row, the sort arrow, the priority badge, the resize line and disabled controls, in system colours only. A stylesheet test
asserts they exist. **Not yet seen in Windows High Contrast**: Chrome cannot be switched to forced colours from here, so this
is the maintainer's manual pass (T-27), and checkboxes and dialogs rely on the browser's own forced-colour handling until then.

## Milestone C: the `wcag()` add-on (2026-10-10)

- `src/react/wcag/`: `wcag()`, `WcagOptions`, `WCAG_ADDON` (`'gridwright:wcag'`). One `rootAttributes` contribution,
  `data-gw-wcag="aa"`; no UI, no messages. Named by the maintainer (C-15) over `contrast()` and `accessibility()`.
- Tests: `tests/react/wcag.test.tsx` (attribute present with it and absent without, composes with `density()`, listed twice is
  refused by name, sets no colour inline); `packages/mui/tests/mui-addons.test.tsx` pins that a `muiTheme()` grid keeps the
  theme's inline tokens and still carries the attribute; `contrast-tokens.test.ts` now asserts the `wcag()` set passes all 13
  pairs; `stylesheet.test.ts` asserts the defaults are untouched and every new rule sits under the attribute; the axe harness
  has a 23rd state with `wcag()` listed; the tree-shaking smoke test proves an app that does not import it does not carry it.
- Playground: a `wcag` toggle with a hint. Not added to the MUI showcase.

## Milestone D: pointer routes in the column picker (2026-10-10)

- Under `wcag()` each picker row gets four buttons, `PointerRoutes.tsx`: move earlier, move later, narrower, wider (16 px,
  clamped to the bounds). They sit in the menu as `menuitem`s with names that include the column, are `aria-disabled` before they
  are pressed when the change is a no-op or the consumer's `canChange` refuses it, and a column that cannot move or resize gets
  none. Without `wcag()` the picker renders nothing new (asserted).
- The picker reads `useWcagEnabled()`, a small context the add-on provides. The hook is exported, because a built-in may not have
  access a third-party add-on lacks.
- A swap of two neighbours is ambiguous from the order alone, so the add-on now hands every consumer of the layout controller a
  `moveColumn` that records its mover. That also fixes the announcement for a control of your own (a `fix` noted in the CHANGELOG);
  the two new swap tests fail without it, checked by removing it.
- Messages in all five locales (`auditAddonMessages` passes). The axe harness has a 24th state: the picker open with `wcag()`.
- Checked in Chrome: with `wcag` off the picker has no step buttons; on, 30 of them at 24x24, the first column's "earlier"
  disabled; "Move City later" reorders the header and says "City moved to position 3 of 8"; "Make City wider" goes 180 to 196 px and
  says "City width: 196 pixels"; focus stays on the pressed control. All toggles switched off again afterwards.
- The resize handle's WCAG 2.5.8 row is therefore covered by the equivalent-control exception, with `wcag()` listed.

## Milestone E: focus not obscured (2026-10-10)

**Cases and findings** (T-17, layout-mocked in `tests/react/wcag-focus.test.tsx`, then confirmed in Chrome):

- *A cell behind a pinned column when scrolled sideways*: **a real defect**, filed as [#78](https://github.com/yaotzin1/apsw-gridwright/issues/78). Reproduced in the playground with `cellNavigation()`
  and `columnLayout()` (Name pinned to the start), cursor walked left with real ArrowLeft presses from the far-right column: with
  `wcag` off the Email cell stopped **164 px under** the pinned Name column and the wrapper did not move (`scrollLeft` stayed
  570). The browser scrolls a focused element to the edge of the scroll area and does not know a pinned column is stuck there.
- *A focused control behind the sticky header outside the cursor path* (Tab, a click): same cause as the vertical case #63 fixed
  inside `cellNavigation()`, so it still applied to everything else. Covered by the same handler.
- *The filter dialog over its own trigger*: **not a defect.** The dialog is placed at the trigger's bottom edge plus 4 px
  (`ColumnFilterProvider.tsx`), so it never overlaps the trigger; a test asserts it. Recorded so it is not looked for again.

**The fix** (T-18): `keepFocusClear(target)` in `src/react/wcag/focus.ts`, called from an `onFocus` handler `wcag()` contributes to the
root. A focus event bubbles from every element, so a cursor move, Tab, a click and a dialog all pass through it. It measures the
bottom of the header cells and the inner edge of the `data-pinned` cells on each side, and scrolls the wrapper by the overlap; it
skips a header cell and a pinned cell (they are the cover), handles right-to-left (the pinned values are logical), and moves
nothing when the element is clear, which is why a windowed grid is unaffected. Behind `wcag()` only (C-15): the default grid's
scrolling is unchanged, including `cellNavigation()`'s own vertical correction.

**Browser pass** (T-19, Chrome, playground, Name pinned, cell navigation on): with `wcag` on, the same walk left from the far-right
column kept the cursor cell **0 px covered at every step** (Email, City, Job title), and the first step moved the wrapper from
570 to 406. Real key presses were needed: a synthetic `KeyboardEvent` does not move the cursor. Toggles off again afterwards.
Not covered: a right-to-left page and a pinned-to-end column in a browser (both are in the mocked tests only), the windowed grid
with pinned columns in a browser, and a screen reader. Those stay on the maintainer's pass (T-27, T-28).

## Milestone F: text spacing, zoom and reflow (2026-10-10)

**Second pass, once the window was in front.** The first pass could not observe frames or a `ResizeObserver` (the window was occluded). A second
pass did, and the two open rows are now measured: the stacked layout and scrolling the windowed grid. The table below is updated; the paragraph
that follows describes the first pass.

**What was run, and what was not.** In Chrome on the playground, with the WCAG 1.4.12 overrides injected as one stylesheet (line height 1.5,
letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em, all `!important`). "Clipped" means an element with `overflow: hidden`
whose content is larger than its box, counted before and after the overrides. Reflow was measured by constraining the grid's container to
**320 px** and **640 px** (the width at 400% and 200% zoom of a 1280 px window), which is an approximation of browser zoom, not browser zoom:
the tool cannot press the zoom shortcut. **The Chrome window was occluded behind other windows for this pass (`document.hidden` was true), so
nothing driven by animation frames or a `ResizeObserver` could be observed**: the stacked layout (`stackBelow`, which `responsive()` switches
with a `ResizeObserver`) and scrolling the windowed grid. Those are open, see below.

| Configuration | Text spacing | 320 px and 640 px | Result |
| :--- | :--- | :--- | :--- |
| Default grid | nothing clipped; rows regroup; the table gains 89 px of horizontal scroll (1084 to 1173) | toolbar and pagination stay inside the grid (0 elements outside it); only the table scrolls, inside its own wrapper; page overflow 0 | no loss |
| `density()` compact and spacious | rows grow by 1 px (50 to 51, 70 to 71); nothing clipped | not measured separately | no loss |
| `columnLayout()` with fixed widths | 0 of 225 cells truncated, before or after | not measured separately | no loss |
| `virtualRows()`, initial layout | nothing clipped; rows grow (58 to 80 px where text wraps) | table scrolls inside its wrapper | no loss, see the decision |
| `responsive()` with `stackBelow` (560 px) | nothing clipped; the card grows 242 to 247 px | at 480 px and 320 px: rows are cards (`display: grid`, explicit `row` and `gridcell` roles), **no horizontal scroll at all**, nothing outside the grid, page overflow 0 | no loss; this is the reflow mode |
| `virtualRows()` while scrolling | 17 to 23 rows rendered; at scroll positions 0, 3 000, 60 000, 150 000 and 190 000 px the first rendered row is about 200 px above the viewport and the last 280 to 900 px below it, with and without the overrides, so the window always covers the viewport; the sticky header stays put | | no gap, no loss |

**1.4.10 Reflow.** At 320 px nothing outside the table spills past the grid and the page does not scroll sideways; the table scrolls horizontally
inside its own wrapper, and with `stackBelow` it does not scroll horizontally at all. Data tables are exempt from 1.4.10's two-dimensional scrolling, and `stackBelow` is the reflow mode the grid offers, which
the report states as the claim made, not "no horizontal scroll".

**Decision for `virtualRows()` (T-21): grows, does not clip.** The windowed body gives each row `style={{ height: rowHeight }}`, and a table row treats
that as a minimum, so a row whose text wraps is taller than the others and nothing is cut off (measured: 58 px rows with 78 and 80 px rows among
them, with and without the overrides). What the arithmetic loses is accuracy, not content: the spacer rows above and below are
`start * rowHeight` and `(rows - end) * rowHeight`, so with taller rows the scroll thumb is approximate. This is documented behaviour already
(`rowHeight` "must match `--gw-row-height`, or the rows drift away from the scrollbar"). So `virtualRows()` is **Supports** for 1.4.12 with that remark,
**the provisional caveat is lifted**: the second pass scrolled the windowed grid with the overrides applied and the window kept up at every position, so
`virtualRows()` is **Supports** for 1.4.12, with the scrollbar-accuracy remark. (A first attempt measured the `thead` element, which scrolls, instead of
its sticky cells, and reported a header that had "disappeared"; a screenshot showed it pinned, which is what the numbers for the cells said.) No stylesheet
change was needed anywhere, so T-21 changes no code.

**Still open (T-27, the maintainer's pass):** real browser zoom to 200% and 400%, which the tool cannot press; container width was used as a
stand-in. The result should match, because the grid's layout reads container width and not the zoom level, but that is a claim to confirm and not a
measurement. Also not repeated with `wcag()` listed: the 24 px controls and the picker buttons were not part of this pass.
