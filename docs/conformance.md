# Accessibility conformance report

An Accessibility Conformance Report for `apsw-gridwright`, in the structure of the VPAT 2.5 template, against WCAG 2.2 Level A and
AA. It is written for a developer who has to answer a procurement question about a grid in their product, and it says what was
checked, how, and what was not.

**This report is interim.** Part of the evidence a complete report needs has not been gathered yet (no screen reader has been run,
the keyboard walk is not recorded, Windows High Contrast has not been looked at), and a number of criteria have not been evaluated.
Those rows say **Not yet evaluated**, which is not one of the four VPAT terms and is used here because the honest alternative is to
guess. Nothing in this document, or in the README or the accessibility guide, says the grid conforms to WCAG. Read the rows.

| | |
| :--- | :--- |
| **Product** | `apsw-gridwright`, the React `<Gridwright />` component and its first-party add-ons |
| **Version covered** | 0.15.0, plus the unreleased `wcag()` add-on and picker controls (branch `docs/wcag-2-2-aa-spec`, commit `fba6a45`) |
| **Report date** | 2026-10-10 |
| **Standard** | WCAG 2.2, Level A and AA (55 success criteria; 4.1.1 Parsing was removed in 2.2, see "Other standards") |
| **Evaluated by** | The package's maintainer and an AI coding assistant working in the repository. Not an independent audit |

## What the grid does and does not claim

There are **two configurations** and each row is stated for both:

- **Default grid**: `<Gridwright />` with whatever add-ons you list, and nothing from `wcag()`. This is what 0.15.0 renders and what an
  upgrade renders. Nothing about it changed to produce this report.
- **With `wcag()`**: the same grid with the `wcag()` add-on listed (see [accessibility.md](accessibility.md#wcag-wcag-22-aa-where-the-default-is-not)).
  It sets the grid to WCAG 2.2 AA where the default is not: 24 px checkboxes and toggles, colours that pass, forced-colour rules,
  focus kept clear of the sticky header and pinned columns, and move and width buttons in the column picker. It is opt-in, so the
  default grid keeps the gaps listed below.

A row that says the same for both columns is a row `wcag()` does not touch.

**The grids a consumer builds are not covered by saying this.** The report covers the default grid, each first-party add-on, and
the combinations the README shows. The MUI package's views (`apsw-gridwright-mui`) are covered for structure and keyboard, since they
run the same suites; their colours come from the MUI theme and are the consumer's.

## How it was evaluated

| Method | What it covers | What it cannot say |
| :--- | :--- | :--- |
| **axe-core 4.14.0 in jsdom**, over 24 states (default, sorted, filtered, filter dialog open, selection, cell navigation, grouping, tree, windowed rows, stacked rows, column picker with and without `wcag()`, loading, empty, error, stale, three densities, Polish catalogue, `wcag()` listed), native and MUI views, against the WCAG 2.0, 2.1 and 2.2 A and AA rules. `tests/react/a11y-axe.test.tsx` | structure, names, roles, ARIA validity. **0 violations** | contrast, target size and scrollable-region focus need layout and were switched off in this tool; three rules were undecided in jsdom (`label-content-name-mismatch`, `aria-valid-attr-value`, `form-field-multiple-labels`) |
| **Tests that assert behaviour**, `tests/react/accessible-state.test.tsx` and others | the roles, `aria-sort`, live-region announcements, focus return | what a screen reader says |
| **Contrast computed from the stylesheet tokens**, 13 pairs, light and dark, `tests/unit/contrast-tokens.test.ts` | the colours the grid ships | what renders: a theme, an overlay or an image behind a cell changes the real ratio |
| **Layout-mocked tests**, `tests/react/wcag-focus.test.tsx` | the arithmetic of keeping focus clear of the header and pinned columns, in both text directions | whether a real browser agrees |
| **Measured in Chrome, 2026-10-10**, on the playground and the MUI showcase: pointer-target sizes, focus under a pinned column, the WCAG text-spacing overrides, reflow at 320 and 640 px, true zoom at 200% and 400% | the default grid and the add-ons named in the rows | other browsers, other operating systems, a right-to-left page, a column pinned to the end |
| **Not done** | screen readers (NVDA, Narrator, VoiceOver, JAWS, TalkBack), a recorded keyboard-only walk, Windows High Contrast, a markup validator, mobile browsers | |

## Conformance by criterion

**Basis** says what supports the status: **T** asserted by a test in the repository, **M** measured in a browser or from the tokens,
**R** reasoning from the code and the docs only, so the least certain, **O** open (no evidence yet).

### 1 Perceivable

| SC | Level | Default grid | With `wcag()` | Basis | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1.1 Non-text Content | A | Supports | Supports | R | Sort arrows are `aria-hidden` decoration. Icons in cells are the consumer's and need a text alternative from them. |
| 1.2.1 to 1.2.5 Time-based Media | A, AA | Not Applicable | Not Applicable | | The grid renders no audio or video. |
| 1.3.1 Info and Relationships | A | Supports | Supports | T | A real `<table>` with `<th scope="col">`, `aria-sort`, row and column counts, `treegrid` levels. Axe found none of the structure rules failing in 24 states. The stacked layout sets explicit roles and has not been read by a screen reader. |
| 1.3.2 Meaningful Sequence | A | Supports | Supports | R | DOM order is reading order. In the stacked layout the header cells stay in the document, visually hidden. |
| 1.3.3 Sensory Characteristics | A | Supports | Supports | R | Sort priority is announced, not only drawn as a badge. |
| 1.3.4 Orientation | AA | Supports | Supports | R | Nothing locks orientation. |
| 1.3.5 Identify Input Purpose | AA | Not Applicable | Not Applicable | | The grid's inputs (search, filters) do not collect data about the user. |
| 1.4.1 Use of Color | A | Not yet evaluated | Not yet evaluated | O | Selected row, hover, cursor cell, sort state and the stale and error styling have not been checked for state carried by colour alone. |
| 1.4.2 Audio Control | A | Not Applicable | Not Applicable | | No audio. |
| **1.4.3 Contrast (Minimum)** | AA | **Partially Supports** | Supports | M | Default: `--gw-text-muted` on a hovered row is 4.34:1 and on a selected row 4.37:1 (light) and 4.04:1 (dark), against 4.5:1. Body, danger and button text pass. With `wcag()` every one of the 13 token pairs passes, light and dark. Token arithmetic, not a rendered measurement. A grid themed through `muiTheme()` takes its colours from the theme, which `wcag()` does not change. |
| 1.4.4 Resize Text | AA | Supports | Supports | M | The default grid at real 200% and 400% browser zoom: nothing clipped, nothing outside the grid, the table scrolls inside its own wrapper where it must. Not repeated with `wcag()` listed or in other browsers. |
| 1.4.5 Images of Text | AA | Not Applicable | Not Applicable | | |
| 1.4.10 Reflow | AA | Supports | Supports | M | A data table is the exception WCAG allows to scroll in two dimensions, and the table scrolls inside its own wrapper at 320 px. With `stackBelow` (`responsive()`) rows become cards with no horizontal scroll at all, measured at 480 and 320 px. The stacked layout at true zoom, and with a screen reader, has not been checked. |
| **1.4.11 Non-text Contrast** | AA | **Partially Supports** | Supports | M | Default: the border that identifies the search box and the select is 1.2 to 2.4:1 against the 3:1 asked of a control's boundary. The focus ring passes (5.17:1 light, 7.02:1 dark). With `wcag()` the borders reach 3:1 or more. The resize line, the sort badge and the cursor cell have not been measured individually. |
| 1.4.12 Text Spacing | AA | Supports | Supports | M | With the 1.4.12 overrides applied: nothing clipped in the default grid, the three densities, fixed-width columns, the stacked layout or the windowed grid (`virtualRows()`). Windowed rows grow when their text wraps and never clip; the scrollbar is then approximate. |
| 1.4.13 Content on Hover or Focus | AA | Supports | Supports | R | Tooltips are the browser's `title` (exempt). The filter dialog and row menu open on activation and close on `Esc`. |

### 2 Operable

| SC | Level | Default grid | With `wcag()` | Basis | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1.1 Keyboard | A | Supports | Supports | T | Sort, select, filter, picker, resize and reorder have keyboard routes. Without `cellNavigation()` the grid has many Tab stops: operable, not efficient. A recorded keyboard-only walk of every control in every configuration has not been done. |
| 2.1.2 No Keyboard Trap | A | Supports | Supports | R | The filter dialog and the picker close on `Esc` and return focus. The export and row menus have not been walked. |
| 2.1.4 Character Key Shortcuts | A | Supports | Supports | R | Shortcuts use Ctrl or Cmd; `Space`, `Enter` and `F2` act on a focused cell. No single-letter shortcut. |
| 2.2.1 Timing Adjustable | A | Not Applicable | Not Applicable | | A debounce is not a time limit. |
| 2.2.2 Pause, Stop, Hide | A | Not yet evaluated | Not yet evaluated | O | The loading skeleton animates; `prefers-reduced-motion` rules exist. Whether it can outlast five seconds has not been checked. |
| 2.3.1 Three Flashes | A | Supports | Supports | R | No flashing content. |
| 2.4.1 Bypass Blocks | A | Consumer | Consumer | | Page-level. The grid's part is a single Tab stop, which exists with `cellNavigation()`. |
| 2.4.2 Page Titled | A | Not Applicable | Not Applicable | | The consumer's page. |
| 2.4.3 Focus Order | A | Supports | Supports | T | Focus returns to the trigger after the filter dialog; focus stays in the grid when a page control disables itself. |
| 2.4.4 Link Purpose | A | Not Applicable | Not Applicable | | The grid renders no links of its own. |
| 2.4.5 Multiple Ways | AA | Not Applicable | Not Applicable | | Page-level. |
| 2.4.6 Headings and Labels | AA | Supports | Supports | R | Controls are named. The grid's own name is the consumer's `aria-label`, which the docs ask for and nothing enforces. |
| 2.4.7 Focus Visible | AA | Not yet evaluated | Not yet evaluated | O | `:focus-visible` rules exist for the controls. The cursor cell, the resize handle, the filter trigger, the dialog controls and the row menu have not been checked one by one. |
| **2.4.11 Focus Not Obscured (Minimum)** | AA | **Partially Supports** | Supports | M | Default: a cursor moving toward a pinned column lands under it (164 px of a cell measured in Chrome; [#78](https://github.com/yaotzin1/apsw-gridwright/issues/78)); the vertical case under the sticky header is already corrected for the cursor. With `wcag()` focus is scrolled clear for every way it can arrive, 0 px covered at every step in Chrome. A right-to-left page, a column pinned to the end and the windowed grid with pinned columns are covered by mocked tests only. |
| 2.5.1 Pointer Gestures | A | Supports | Supports | R | No multi-point or path-based gesture. |
| 2.5.2 Pointer Cancellation | A | Not yet evaluated | Not yet evaluated | O | Whether a drag can be abandoned without applying, and whether activation happens on the up event, has not been checked. |
| 2.5.3 Label in Name | A | Supports | Supports | R | Sort button names start with the visible header text. |
| 2.5.4 Motion Actuation | A | Not Applicable | Not Applicable | | |
| **2.5.7 Dragging Movements** | AA | **Does Not Support** | Supports | T, M | Default: moving or resizing a column has a drag or a keyboard route, and no single-pointer one; a keyboard route does not satisfy the criterion. With `wcag()` and `columnLayout()` the column picker has "Move earlier", "Move later", "Make narrower" and "Make wider" for each column, tested and checked in Chrome. Without `columnLayout()` the grid has no drag to replace. |
| **2.5.8 Target Size (Minimum)** | AA | **Partially Supports** | Supports | M | Default: the row checkbox is 13 px, the tree, group and detail toggles 20 px and the column resize handle 9 px wide; every other control measured is 24 px or larger. With `wcag()` the checkbox and toggles are 24 px. The resize handle stays 9 px and is covered by the criterion's *equivalent control* exception, the picker's width buttons, which exist only when `columnLayout()` and `wcag()` are both listed. The MUI views' controls measured 28 px or larger. |

### 3 Understandable

| SC | Level | Default grid | With `wcag()` | Basis | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1.1 Language of Page | A | Consumer | Consumer | | The grid sets `lang` on its root from its locale; the page's language is the consumer's. |
| 3.1.2 Language of Parts | AA | Supports | Supports | R | Root `lang` follows the locale. Mixed-language cell content is the consumer's. |
| 3.2.1 On Focus | A | Supports | Supports | R | Focus never changes context. |
| 3.2.2 On Input | A | Not yet evaluated | Not yet evaluated | O | The page-size select applies on change; whether that is a change of context has not been decided and recorded. |
| 3.2.3 Consistent Navigation | AA | Not Applicable | Not Applicable | | Page-level. |
| 3.2.4 Consistent Identification | AA | Supports | Supports | R | The same control carries the same name across add-ons; five locales share the keys. |
| 3.2.6 Consistent Help | A | Not Applicable | Not Applicable | | The grid offers no help mechanism. |
| 3.3.1 Error Identification | A | Not yet evaluated | Not yet evaluated | O | A failed fetch is a `role="alert"`. The filter dialog's Apply stays off until a condition is complete without saying why; whether that needs text has not been decided. |
| 3.3.2 Labels or Instructions | A | Supports | Supports | R | Dialog fields are labelled. |
| 3.3.3 Error Suggestion | AA | Not yet evaluated | Not yet evaluated | O | The same filter-dialog question as 3.3.1. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Not Applicable | Not Applicable | | The grid submits no such data. Inline editing is the consumer's. |
| 3.3.7 Redundant Entry | A | Not Applicable | Not Applicable | | |
| 3.3.8 Accessible Authentication (Minimum) | AA | Not Applicable | Not Applicable | | No authentication. |

### 4 Robust

| SC | Level | Default grid | With `wcag()` | Basis | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1.2 Name, Role, Value | A | Supports | Supports | T | Names, `aria-sort`, `aria-selected`, `aria-expanded` and levels are asserted by role query, and axe found none of the name or role rules failing in 24 states. The resize handle is a `separator` with a value. |
| 4.1.3 Status Messages | AA | Supports | Supports | T | One `role="status"` region; announcement order, silence when nothing changed and failure handling are asserted. **Heard in a screen reader: no.** |

### Summary

- **Default grid:** five rows fall short. **Does Not Support:** 2.5.7 Dragging Movements. **Partially Supports:** 1.4.3 Contrast, 1.4.11 Non-text
  Contrast, 2.4.11 Focus Not Obscured and 2.5.8 Target Size. Seven rows are **not yet evaluated**: 1.4.1, 2.2.2, 2.4.7, 2.5.2, 3.2.2, 3.3.1 and 3.3.3.
  The rest are Supports, Not Applicable or the consumer's.
- **With `wcag()`:** the five rows that fall short become Supports, on the evidence and the limits stated in each row. The seven not-yet-evaluated
  rows are unchanged, and so is everything the add-on does not touch.
- Rows with basis **R** rest on reading the code and the docs, and should be read as the least certain of the Supports.

## Other standards

- **Revised Section 508** (web content) incorporates WCAG 2.0 A and AA. The rows above that also exist in 2.0 carry over unchanged; the six
  that are new in 2.1 or 2.2 (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) are not part of that column. **4.1.1 Parsing** is named by
  Section 508 and was removed from WCAG 2.2: React emits well-formed markup and axe's duplicate-id checks passed in 24 states, so it is
  **Supports (basis R)**; a markup validator has not been run.
- **EN 301 549** incorporates WCAG 2.1 AA in its published edition as the maintainer understands it. Which edition applies to a product is a
  question for the consumer's counsel.
- **Chapter 5 (software) and Chapter 6 (support documentation)** of Section 508 apply to a product, not to a library, and are not assessed.
- **A library is not certified.** These standards apply to a product or a service. This report is what the library can supply for the
  consumer's own.

## What stays with the consumer

The grid is one part of a page. These are the consumer's, and a grid that supports every row above can sit in a page that fails them:

- the page's title, language, headings, landmarks and skip links (2.4.1, 2.4.2, 3.1.1);
- the grid's accessible name (`aria-label`), and a caption where one helps;
- the colour theme, including a `muiTheme()` palette, which `wcag()` does not override;
- the content of cells: text alternatives for icons and images, link text, mixed-language text;
- anything inside a `rowDetail()` panel, an inline editor or a cell renderer of their own;
- the files the export menu produces (CSV, Excel, Markdown, PDF, print), which are outside this report;
- testing with the assistive technology and browsers their users have.

## What would make this report complete

The remaining work is in `specs/wcag-2-2-aa-conformance/tasks.md` (milestone H) and is the maintainer's, because it needs hands, ears and a
Windows machine: the screen-reader pass (NVDA with Firefox and Chrome, Narrator with Edge; VoiceOver, JAWS and TalkBack stay "not tested"
unless run), a recorded keyboard-only walk, Windows High Contrast, and a Chrome pass with the axe extension for the rules jsdom could not
decide. Until then the not-yet-evaluated rows stay as they are, and this report stays interim.
