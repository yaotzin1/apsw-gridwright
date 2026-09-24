# Self-review: 2D cell navigation and clipboard copy

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

> **Scope of this review: navigation only.** Clipboard copy (AC-06, AC-07, AC-09) is a second change
> on top of this one, for the reason in `tasks.md`: copying needs a cursor to copy from, so the
> dependency runs one way and each half is reviewable on its own.

## 1. Boundary and layering

Nothing under `src/core`, `src/data`, `src/plugins`, `src/tree`, `src/i18n` or `src/locales`
changed. The feature is four new files under `src/react/navigation/`, one CSS rule, one line in
`src/react/index.ts` and four names in the packaging audit's expected list.

The engine is untouched, deliberately: the cursor is view state. Putting it on `GridState` would
publish a cursor move to every subscriber and make it something the pipeline and every plugin sees.
`data-model.md` records that as a decision rather than leaving it implicit.

The split that matters is between the pure functions -- `visitableColumns`, `resolveCursor`,
`nextCell` -- and the hook. The pure ones take rows and columns as arguments, which is what let the
add-on work at all: `setup` runs inside `useGridwright`, **before** the context provider exists, so
it cannot call `useGridwrightContext()`. The grid arrives with each slot call instead, the way
`rowDetail()` already does through a `gridRef`.

One trap avoided by reading `CLAUDE.md` rather than by testing: the add-on does **not** take the
table wrapper's ref. `GridTable` merges every `tableWrapper` contribution but keeps only the last
`ref` it is handed, silently, and `virtualRows()` takes one -- so this add-on taking it would break
windowing or itself depending on the listed order, with nothing failing. It reaches the table with
`closest('table')` from the cell that fired an event, which is what `columnLayout()` does and for
the same reason.

## 2. The local/remote seam

Nothing here reads or writes `GridQuery`, makes a request, or asks where a row came from. The cursor
moves over `state.rows`, which is whatever the pipeline produced, and no key branches on the source.

The seam shows up as the one behaviour the spec got wrong; see §6.

## 3. Public surface and semver

**Minor.** Four runtime exports (`cellNavigation`, `CELL_NAVIGATION_ADDON`, `useCellNavigation`,
`useOptionalCellNavigation`) and three types (`ActiveCell`, `CellNavigationOptions`,
`CellNavigationController`). Nothing existing changes signature or default; the add-on is not in
`coreAddons()`, so no grid acquires it by upgrading; and a grid that does not list it renders
identical markup, asserted by a test rather than assumed -- no cell gains a `tabIndex`, because the
attribute is contributed through `cellAttributes` and only a listed add-on contributes.

**No change to the add-on contract.** Every slot this uses -- `cellAttributes`,
`extraCellAttributes`, `tableKeyDown`, `provide`, `overlay` -- already existed, so a third-party
add-on could have written this feature with nothing added for it. That is the evidence
`specs/addon-architecture` asks each feature to produce.

**Two returns to stage 3**, both recorded in `api-surface.md` and `spec.md` §8 rather than quietly
diverged from:

- **C-2**, found at stage 5: AC-03 asked `Ctrl+End` for "the last row of the result set" and
  `PageDown` to cross a page edge. Neither is answerable for a paginating source that sends no
  total. See §6.
- **C-1**, left open by the spec: extra columns join the roving model, through
  `extraCellAttributes`, with `includeExtraColumns: false` for a grid that wants them left in the
  Tab order.

`cellNavigationMessages` is deliberately **not** exported yet: navigation has no strings, and the
three clipboard ones arrive with the code that renders them.

## 4. Accessibility and i18n

This dimension is the feature.

- **One Tab stop.** Exactly one cell carries `tabIndex="0"`; a test asserts the count is one and
  that every other cell is `-1`.
- **Roving `tabindex`, not `aria-activedescendant`.** The focused cell is really focused, so its
  header association, row position and text are announced by the browser from markup that already
  exists. The alternative means reconstructing all three by hand, generating an `id` per cell, and
  depending on support that is uneven across screen reader and browser pairs. Recorded in
  `research.md` as the option rejected and why.
- **Nothing is announced on a move**, and that is the accessible choice rather than a gap: the
  browser already says what the focused cell is, and a live region repeating it would speak over it
  on every arrow key.
- **Arrow keys inside a form control stay there**, so an inline editor keeps its caret and the
  cursor does not move out from under someone typing.
- **Left and right follow reading direction**, mirrored under `dir="rtl"`.
- **No new string in any language.** AC-09 lands with the clipboard.
- The focus ring is an inset `box-shadow` rather than an `outline`: a `<td>` under
  `table-layout: fixed` clips an outline at its edges, and the shadow also survives a sticky pinned
  column painting over its neighbour. Nothing about the box changes, so moving the cursor never
  shifts a row.

## 5. Supply chain and packaging

No new dependency, no new entry point, no change to `files` or the export map. Four new source files
inside a tree `dist` already covers.

The security questions from `application_security/SKILL.md`:

1. **Which untrusted inputs does this change touch, and which sink does each reach?** Row ids and
   column ids, reaching one sink: a CSS attribute selector used to find the cell to focus.
2. **Does any new code create a string that becomes markup, a URL, a selector or a script?** A
   selector, built with `CSS.escape()` on the composed key. A row id is consumer data -- `getRowId`
   can return anything -- so an id carrying a quote or a bracket would otherwise break the selector
   or reach past the cell it names. Nothing becomes markup: the add-on contributes attributes and
   renders no HTML.
3. **Does any new extension point let third-party code reach something a consumer's renderer could
   not?** `useCellNavigation()` publishes a cursor whose only power is to move itself, over cells the
   caller can already see. No new slot, no new contract.
4. **Did the security audit pass, and did it scan `dist/`?** Yes, both -- see §7.

## 6. Honest output

The place this feature could have lied is `Ctrl+End`, and the spec asked it to.

AC-03 wanted the last cell of the last row **of the result set**. When a paginating source sends no
total, `state.isTotalExact` is false and `engine.ts` derives `hasNextPage` from whether another page
came back: the grid knows another page exists and nothing else. Honouring the criterion would have
meant either picking a row nobody has seen -- the invented total this package refuses everywhere
else -- or paging forward until a short page arrived, which is an unbounded number of requests from
one keypress and a download nobody asked for.

So `Ctrl+End` goes to the last **loaded** row, and `PageUp`/`PageDown` stay inside what is loaded.
`Ctrl+Home` returns to page one only when the total is exact, where the destination is known. This
is the honesty `getSelectedRows()` and `expandAll()` already practise, and it is asserted by a test
that gives the grid seven rows at a page size of four and checks the row count does not change.

## 7. Verification

`npm run verify`, end to end, on the final tree:

```
> apsw-gridwright@0.10.0 verify

All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)

> tsc --noEmit
> eslint .
> vitest run
 Test Files  42 passed (42)
      Tests  757 passed (757)

> npm run build && vitest run --config vitest.smoke.config.ts
 Test Files  2 passed (2)
      Tests  28 passed (28)

> node scripts/check-exports.mjs
  ok   core ESM entry exports 25 expected names
  ok   VERSION matches package.json (0.10.0)
  ok   react ESM entry exports 50 expected names
  ok   both entries share one module instance
the published package resolves cleanly.

> node scripts/security-audit.mjs
security audit: no findings (source, manifest, dist)
```

Eighteen new tests in `tests/react/cell-navigation.test.tsx`, none asserting a class name: what
matters is which cell is focused and which single cell is tabbable, and both are visible in the DOM
a screen reader reads.

| Test | Holds |
| :--- | :--- |
| one tab stop | exactly one cell is `tabIndex=0`, every other is `-1` |
| arrows | across columns, down rows, and the tab stop follows the cursor |
| edges | no wrapping from the first column to the previous row |
| `Home` / `End` | first and last column of the row |
| `Ctrl+End` | the last **loaded** row, with the page unchanged -- the §6 claim |
| `PageDown` | one page of rows, clamped, with no fetch |
| **key repeat** | three keydowns in one task move three rows, not one |
| `onActiveCellChange` | fires on a move, never on mount |
| pointer focus | clicking a cell moves the cursor, so the two cannot disagree |
| extra columns | the selection checkbox cell is reachable, and `includeExtraColumns: false` excludes it |
| interactive child | an `<input>` in a cell keeps its arrow keys |
| tree | `ArrowRight` expands, `ArrowLeft` collapses |
| windowed | moving 60 rows past the window asks the viewport for that row, and the grid still has exactly one tab stop |
| windowed fallback | with the cursor scrolled out of view the stop sits on a rendered row, in the cursor's column |
| no add-on | no cell gains a `tabIndex` |

**The browser pass found the bug the suite could not.** Driving the built package in Chrome showed
three rapid `ArrowDown`s moving one row instead of three: each handler computed its move from the
cursor as of the last *render*, and key repeat delivers several keydowns before React re-renders --
so holding an arrow key moved once and stopped. `userEvent` awaits each key, which is exactly why
twelve passing tests never saw it. Fixed with a ref that advances synchronously inside `moveTo`, and
covered by two tests confirmed to fail against the old code and pass against the new.

Also confirmed in Chrome against `dist/`: 225 cells with exactly one tabbable; every binding --
arrows, `Home`, `End`, `Ctrl+Home`, `Ctrl+End`, `PageDown` -- landing on the right cell, including
`Ctrl+End` stopping at the last loaded row; edges not wrapping; and the focus ring rendering inset
with no layout shift.

## Change 2: clipboard copy (2026-09-22)

The maintainer asked for copying that does not depend on the operating system. That moved the
design off `navigator.clipboard.write()`, which the plan named, onto the browser's own `copy` event
-- recorded as spec C-4 with the reasons, and in `api-surface.md` under "Added by change 2".

1. **Boundary.** `src/react/navigation/clipboard.ts` and the add-on only. It reuses `core/export`
   (`buildExportTable`, `formatCsv`, `escapeMarkup`) and changes nothing there, so a copied cell
   reads exactly as an exported one. No engine, pipeline or data-source change.
2. **Seam.** Copies `api.getSelectedRows()` -- loaded rows, in display order -- or the cursor's
   cell. Nothing asks where the rows came from.
3. **Surface.** Minor, still unreleased: `cellNavigationMessages`, `CellNavigationOptions.copy`
   (default `true`), two message keys. The add-on contract is unchanged: `onCopy` arrives through
   `tableAttributes`, which already allowed and composed `on*` handlers.
4. **Accessibility and i18n.** A copy is announced, a cursor move still is not. Both strings are in
   all five languages; `tests/unit/i18n.test.ts` now audits the add-on's catalog against every pack.
5. **Supply chain.** No dependency. No `execCommand`, no hidden textarea, no focus stolen.
6. **Honest output.** There is no "could not copy" message, and that is deliberate: the `copy` event
   cannot be refused, and a browser that never fires one tells nobody, so the add-on would be
   announcing a failure it cannot observe. Both flavours are formula-guarded and the HTML is
   escaped; a test feeds `=HYPERLINK(...)` and an `<img onerror>` through both.
7. **Verification.**
   - `npm run verify`: exit 0. 43 files / 773 tests, smoke 2 files / 28 tests, `check:exports`
     "the published package resolves cleanly", security audit "no findings (source, manifest, dist)".
   - 16 new tests in `tests/react/cell-navigation-clipboard.test.tsx`, covering the shortcut on every
     layout and modifier combination. Removing the keydown's `addRange` makes the Firefox/Safari
     test fail, so it tests the selection step and not only the result.
   - **In Chrome, against `dist/` in the playground, with real keypresses:** `Ctrl+C` on a name cell
     fired `copy` at the cell's own text span, the grid prevented the default, wrote
     `Ada Lovelace` as text and a one-cell table as HTML, cleared the selection, and announced
     "Copied the cell to the clipboard". Pasting with `Ctrl+V` into the search box produced
     `Ada Lovelace`, so it reached the Windows clipboard. With two rows ticked, `Ctrl+C` produced
     the header row and both rows in display order and announced "Copied 2 rows to the clipboard".
     `Ctrl+Insert` was seen to fire `copy` in Chrome, but in an attempt where focus had left the
     grid, so the grid's handling of it is covered by the jsdom test only. With the add-on switched off, the table carries no `onCopy`
     and no cell a `tabindex`.

8. **Documentation moved with it.** `docs/api.md` (the `copy` option and a copying section),
   `docs/accessibility.md`, both playbooks (the agent playbook's decision table and rules, the
   React playbook's testing recipe and three traps), `docs/i18n.md` (key table and exported
   catalogs), `docs/addons.md` (the add-on table), `docs/export.md`, the docs index, README,
   CHANGELOG, `specs/DEPENDENCY_MAP.md`, the playground hint, and `AGENTS.md`'s repository map. The
   `application_security` skill now names the clipboard as a sink, and the `accessibility` skill has
   the announce and keyboard-shortcut rules this change follows. Some of this also fixed things that
   change 1 left out: the React playbook never mentioned `cellNavigation()`, `docs/addons.md` had
   neither it nor `rowDetail()`, and the docs index had no link to `accessibility.md`.

## Known gaps

- **The keyboard walk-through was done on 2026-09-24, except for the windowed grid** (see "Walk-through,
  2026-09-24" below). Before that, it was not completed: the automation tab ran backgrounded (`document.hasFocus()` false,
  `visibilityState` hidden), which stops real key and pointer delivery and stops a programmatic
  `.focus()` from firing focus events. Every binding was exercised by dispatching `KeyboardEvent`s
  against the built package instead, and the pointer-focus path is covered in jsdom, but a person
  should still hold an arrow key and Tab in and out of the grid before this is called done.
- **The windowed tab stop was a real defect, found in this review and now fixed.** The tab stop is
  contributed per cell, and a cell that is not rendered cannot carry one -- so with the cursor
  scrolled out of a windowed grid, **zero** cells held `tabIndex="0"` and a keyboard user could not
  enter the grid at all until they scrolled back.

  Fixed without coupling the two add-ons: `cellAttributes` is called for exactly the mounted cells,
  so collecting the row ids it is asked about is the add-on's own honest view of the window, and the
  stop falls back to the cursor's column in the first rendered row when the cursor's row is not
  among them. Tab then lands where the reader is looking, and focusing it moves the cursor there
  through the usual `onFocus` path. The focus **ring** stays on the cursor rather than following the
  fallback, because the two are different questions and painting the fallback would tell the reader
  their cursor had moved when it has not. Two tests, both confirmed to fail against the unfixed
  code.

  The window is read one render behind -- `provide` runs before the body, so the current pass has
  not happened yet -- which is enough, because scrolling re-renders and the answer converges on the
  next frame. The add-on contract exposes no rendered range, and reaching into `virtualRows()` for
  one would have coupled an optional add-on to another.
- **Clipboard copy is verified in Chrome on Windows only.** The route was chosen so that Firefox
  and Safari (and macOS, Linux, ChromeOS) need nothing different -- see below -- but no browser
  other than Chrome was driven. Someone should press `Cmd+C` in Safari and `Ctrl+C` in Firefox once.
- **`Escape` out of an editor** was listed here as not implemented. Fixed on 2026-09-24 in
  `inlineEditing()`, which owns the editor: see the walk-through below, defect 3.

## Walk-through, 2026-09-24

Real key presses from Chrome on Windows against the built playground (`npm run example`), with the
page holding focus (`document.hasFocus()` true). The tab was still `visibilityState: hidden`, which
matters for one item below.

**Holds.**

- One `tabIndex="0"` cell at every step. Clicking a cell moves the cursor and the focus ring there.
- Arrow keys, `Home`, `End`, `PageDown` (clamped at the last loaded row), `Ctrl+End` (last loaded
  row) and `Ctrl+Home` all move the real focus.
- `Ctrl+C` on a cell writes `text/plain` and an HTML table, and announces "Copied the cell to the
  clipboard". With two rows selected it writes a header row plus both rows, and announces "Copied 2
  rows to the clipboard". `Ctrl+Insert` copies as well.
- An inline editor keeps its arrow keys (the caret moves; `ArrowDown` does not leave the input).
- Under `treeData()`, `ArrowLeft` on a group collapses it and the arrows walk the visible nodes.
- Switching `cellNavigation()` off again leaves no cell with a `tabindex` and no focused class.

**Defects found, and fixed the same day** as change 3 in `api-surface.md` (C-3 corrected),
covered by `tests/react/cell-controls.test.tsx`, nine of whose tests failed against the code before
the fix. `cellNavigation()` is unreleased, so none of this is a semver event for it; the one released
behaviour that changes, focus after an inline edit, is a fix in CHANGELOG.

1. **`Tab` does not leave the grid.** Every control inside a cell keeps its own Tab stop (C-3): with the
   default checkbox column that is 25 checkboxes, so `Tab` from a cell lands on the next row's
   checkbox instead of leaving. The header sort buttons are Tab stops as well. C-3 says "Tab leaves
   the grid" and, in the same sentence, keeps these stops, and the walk-through shows the two cannot
   both hold. The ARIA grid pattern takes widgets inside cells out of the Tab order and operates them
   from the cell.
2. **A focused cell cannot operate its control.** `Space` on the checkbox cell selects nothing, and
   `Enter` or `F2` on an editable cell or on a tree toggle cell does nothing. The arrow keys reach
   these cells (`includeExtraColumns` defaults to `true`), but only the mouse, or `Tab` into the child
   control, operates them.
3. **Closing an editor drops focus to `<body>`.** `Escape` was already listed below. `Enter`, which
   commits, does the same, so a keyboard user who edits a cell is ejected from the grid either way.

**Not verified: windowed navigation.** Under `virtualRows()`, arrowing past the mounted rows called
`scrollToIndex` (`scrollTop` moved to 480) but the mounted window stayed at rows 2 to 10, and focus
stayed on row 10. The tab was hidden and `requestAnimationFrame` never ran (checked: it did not fire
within a second), and scroll events are delivered from the rendering steps it drives, so this proves
nothing either way. It needs the same keys pressed in a visible tab.

**Left for later: the header row.** The sort buttons keep their Tab stops, because header cells
are not part of the cursor. `Shift+Tab` from the body therefore walks back through them. Bringing
the header row into the cursor model is its own change.

