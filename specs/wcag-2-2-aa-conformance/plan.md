# Plan: WCAG 2.2 AA conformance

> Stage 3. Written against `spec.md` (with §8 answered for C-3, C-7 and C-8) and `api-surface.md`. A module list and an
> order of work, not a design for each fix: the fixes are small and each is specified by an acceptance criterion.

## The shape of the work

Measure first, then fix, then publish what was measured. The first milestone changes no behaviour at all, so it can ship
alone and every later claim has something to stand on. Nothing is claimed until the last one.

| # | Milestone | Changes behaviour? | Delivers |
| :-- | :--- | :--- | :--- |
| A | The measuring harness | No | AC-02 (axe in jsdom), the token-contrast test of AC-05, the states list, the dev dependency |
| B | Stylesheet fixes | Rendering only | AC-04 (target size), AC-07 (forced colours), the CSS half of AC-15 and AC-16 |
| C | The `contrast()` add-on | One root attribute | AC-15 (the add-on half) |
| D | Pointer routes in the column picker | New controls | AC-03, AC-12 |
| E | Focus not obscured | Scroll correction | AC-06 |
| F | Text spacing, zoom and reflow | Decided after measuring | AC-08 |
| G | The report and the wording | Documentation | AC-10, AC-11 |
| H | The manual passes | None | AC-01, AC-09, the browser halves of AC-04 to AC-08 |

A is first and H runs alongside from the moment A exists, because the browser pass is how B, E and F are confirmed rather
than assumed. G is last: a report written before the fixes is a report of the baseline.

## Modules touched

| Path | What | Milestone |
| :--- | :--- | :--- |
| `package.json`, `package-lock.json` | `axe-core` as a devDependency, major pinned. Read the lockfile diff for new transitives and install scripts, per `security_guard` (4.14.0 has none) | A |
| `tests/react/a11y-axe.test.tsx` (new) | renders each state in the list below and runs axe with the WCAG 2.0, 2.1 and 2.2 A and AA tags; fails on any violation, and lists the rules jsdom cannot evaluate | A |
| `tests/unit/contrast-tokens.test.ts` (new) | parses the custom properties out of `src/styles/styles.css` for the default set and the `contrast()` set, computes the ratios from AC-05 with the WCAG formula, and fails under the threshold. A pure test, no browser | A, B |
| `src/styles/styles.css` | `--gw-target-min`; the handle's 24px hit area; `@media (forced-colors: active)`; `[data-gw-contrast='aa']` and `@media (prefers-contrast: more)` overrides | B |
| `src/react/contrast/` (new: `addon.tsx`, `index.ts`) | `contrast()`, `ContrastOptions`, `CONTRAST_ADDON`. One `rootAttributes` contribution, like `density()` | C |
| `src/react/index.ts`, `scripts/check-exports.mjs` expected names | export the three names; the packaging audit's list grows by three | C |
| `src/react/layout/` (the column picker, its messages) and `src/locales/*` | move earlier, move later and a width stepper; messages in five languages | D |
| `src/react/navigation/useCellNavigation.ts`, the table wrapper's scroll handling | keep the focused element clear of the sticky header and a pinned column, vertically and horizontally | E |
| `docs/conformance.md` (new), `docs/accessibility.md`, `README.md`, `docs/api.md`, `docs/addons.md`, `specs/DEPENDENCY_MAP.md` | the report, the section that links it, the one supported sentence, the new surface | G |
| `tests/unit/wording.test.ts` (new) | fails on "WCAG compliant", "508 compliant" and an unqualified "accessible" in the README and docs outside the report | G |
| `examples/playground` | a `contrast` toggle, so the add-on can be operated and seen | C |

## The states the audit covers (C-2)

AC-02 needs a list, not "the grid". The harness renders each, from a local array and, where it differs, from a remote source:

1. the default grid, first page, with `aria-label`;
2. sorted by one column; sorted by two;
3. a column filter dialog open; a filter applied;
4. selection on, one row selected, header partly selected;
5. `cellNavigation()` on, with the cursor in the middle of the grid;
6. `grouping()`: expanded, all collapsed;
7. `treeData()`: a node expanded;
8. `virtualRows()`;
9. `responsive()` with `stackBelow`;
10. `columnLayout()` with the picker open;
11. loading, empty, error, and stale rows with the banner;
12. `density()` at each level;
13. `locale` Polish (a second language and a right-to-left check are separate questions; only Polish is asserted here);
14. `contrast()` listed, for the colour rules.

The MUI package's three views are rendered through its own tests re-running this file, as it already does for the grid's
suites. Its colours come from the MUI theme (C-2).

## Seams and trade-offs

- **`contrast()` cannot recolour a MUI-themed grid.** `muiTheme()` writes colour tokens as inline custom properties on the
  root, and an inline declaration beats a stylesheet rule. The attribute is still set, the overrides lose, and nothing
  changes. This is correct (the colours are the consumer's MUI theme) and has to be stated, in the add-on's doc, in the
  report and in the playground's hint, rather than discovered. A test pins it so nobody "fixes" it by `!important`.
- **A target can be larger without being bigger.** The resize handle sits against the sort button. Widening the element
  would steal clicks from the button, so the hit area is a pseudo-element centred on the edge and the spacing exception is
  checked in a browser. If the pseudo-element overlaps the sort button's own 24px area, the handle gives way to the button on
  the overlap; that is the safer failure.
- **Fixed-height virtual rows cannot grow with text spacing.** `virtualRows()` places rows by arithmetic on a fixed height.
  The honest options are to let a row overflow into its neighbour (ugly), clip (what happens), or report 1.4.12 as Partially
  Supports for `virtualRows()` with the reason. Milestone F measures it first and picks; the likely answer is the third.
  This is the one place the work may end in a documented limitation, not a fix.
- **jsdom cannot run layout rules.** Contrast, target size and reflow are computed (tokens) or measured by hand (browser),
  never "passed by axe in CI". The harness prints which axe rules it skipped, so a green run is not read as more than it is.
- **Order of `contrast()` and `density()`.** Both only set attributes; the stylesheet decides precedence. `contrast()` changes
  colour tokens, `density()` padding tokens, and the sets do not overlap. A test lists both together.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| axe reports false positives in jsdom (it cannot see layout) | the harness restricts to rules that run without layout, names the ones it drops, and records each drop in `research.md` |
| The 24px hit area changes which element a click reaches | a layout-mocked test for the overlap rule, then the browser pass; the visible handle is unchanged |
| A reader on `prefers-contrast: more` sees a changed grid with no warning | the changelog says so in those words; C-13 can be answered "no" |
| The report is read as a blanket claim | AC-11, the wording test, and the document's first paragraph saying what is and is not covered |
| The screen-reader pass finds a defect that needs a markup change | it returns to this plan; the fix is a `fix` track change with its own test, not part of this feature's commit |

## Release shape

One minor release carries the lot: the add-on, the picker controls, the stylesheet and the harness. If milestone A merges
first as a `chore` (a dev dependency and tests, nothing a consumer installs), the feature track begins at B. The conformance
report is dated and names the version it covers, and is regenerated when the audit is rerun, not on every release (C-10).
