# Self-review: column filtering

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Nothing under `src/core`, `src/data`, `src/plugins` or `src/tree` changed. The engine already had
the whole of filtering: the operators, `matchesFilter`, `setFilter`, the page reset, the capability
skip, the tree stage's ancestor rule. The feature is controls, and controls are adapter.

The one thing that could have tempted a core change is the column's filter *type*. It stayed in the
adapter, on `GridwrightColumn.filter`, next to `edit.inputType`, because it decides which input to
draw and which conditions to list, and the engine never needs to know whether a date picker or a
text box produced a value. The operator table and the draft conversion are pure functions in
`src/react/filters/operators.ts`, unit tested with no renderer.

Imports still point one way. `react/filters` imports `react/context` and core types; the header
imports `react/filters`; nothing in `react/filters` imports a part.

## 2. The local/remote seam

The dialog's only write is `api.setFilter(columnId, spec)`. It cannot tell, and does not ask, where
the rows come from. Covered by tests on both sides: an array filtered by `core:filter`; a source
declaring `filter: true` that receives the identical `FilterSpec` and whose deliberately unfiltered
answer is rendered as the server sent it; a tree keeping the folder above a match.

The playground was the place the seam was not honest. Its paging fetcher never sent `filters`, so a
source declaring `filter: true` was promising work its server was never asked to do, and the export
of every matching row ignored filters the same way. Both now send them, and the mock server
implements every operator with the meanings `matchesFilter` gives them, so the capability switch
moves the work without changing the answer.

## 3. Public surface and semver

Minor, as classified in `api-surface.md` before the code: four runtime exports, six types, three
attached parts, an optional column field, an optional prop defaulting to false, eleven labels, two
class name slots, thirty message keys. No default changed and no core type changed. The export audit
lists the four new names, and every type in a new signature is exported.

One internal export was added that is not public: `columnSignature` from `useGridwright.ts`, used by
the component's column memo (section 7). It is not re-exported from any entry.

## 4. Accessibility and i18n

- Trigger: a `<button>` beside, never inside, the sort button; `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls` while open; named "Filter Salary" or "Filter Salary, filtered".
- Dialog: `role="dialog"`, `aria-modal="true"`, named for the column, rendered outside the table so
  it never joins a column header's accessible name (asserted: the header's name does not contain
  "Condition"). Focus moves to the condition; Tab and Shift+Tab wrap; Escape, Apply and Clear return
  focus to the trigger; a click outside closes without stealing focus.
- Clear all: focus moves to the first filter trigger before the button unmounts.
- Live region: "{column}, filtered" and "{column}, filter removed", ranked with the sort change. When
  several columns change at once (clear all) it says only the range, because naming one would imply
  the others remain.
- `aria-sort` is still on the `<th>`.
- Every string is a catalog key, in all five locales, and the Polish plural for "Clear n filters"
  has all four forms. Choice labels are the consumer's, passed translated, like a custom export
  format's label. Tested in Polish.

## 5. Supply chain and packaging

No dependency. No portal, so no `react-dom` import entered the React entry. The new source files are
under `src/react/filters/` and reach the tarball only through `dist`. The smoke suite imports the
four exports through `apsw-gridwright/react` and drives a filter end to end on the built bundle.

## 6. Honest output

- The column type is declared, never inferred from the rows on a page.
- An incomplete condition cannot be applied: a blank "contains" would keep every row and a `NaN`
  bound would keep none, and either would be reported as the result.
- A filter set by code on a condition the dialog does not offer is shown as filtered and can be
  cleared, but the dialog opens blank rather than rewriting it.
- A date "on" is not silently turned into a range; the limitation is documented instead.
- The features page does not offer the switch over its ten-million-row source, whose range
  endpoint cannot filter, rather than let a switch appear to work.

## 7. Verification

```
> npm run clean && npm run validate:skills && npm run sync:check && npm run typecheck && npm run lint && npm test && npm run test:smoke && npm run check:exports

✨ All 15 skills validated successfully! (0 Security Threats / 0 Syntax Errors)
.claude/skills is in sync (15 skills)
AGENTS.md and GEMINI.md are in sync (8 stages, 15 skills, 6 gates, 12 rules)

 Test Files  28 passed (28)
      Tests  449 passed (449)

 Test Files  1 passed (1)
      Tests  21 passed (21)

  ok   no runtime dependencies
  ok   core ESM entry exports 25 expected names
  ok   react ESM entry exports 21 expected names
  ok   both entries share one module instance
the published package resolves cleanly.
```

Driven in Chrome against the built package, on a second copy of the playground server so the mock
endpoint's new operators were live. React page, server filtering: Status "Inactive" 715 of 5,000;
plus Department Research and Operations 286; plus Started before 2016-01-01 52; "Clear 3 filters"
back to 5,000 with focus on "Filter Name". Salary "between 130,000 and 135,000" 270. By keyboard
only: Enter opened the dialog on the condition, Tab reached the value and Apply and wrapped back to
the condition, Shift+Tab and Enter applied, focus returned to "Filter Salary, filtered", Enter
reopened on the applied draft, Escape closed it and kept the filter. With the filter on: the export
of all matching rows wrote 1 row, virtual kept the filter, the tree kept Engineering and Platform
above Grace Hopper, Polish translated every condition and button, and a click outside closed the
dialog. Switching column filters off restored the header markup exactly. Features page: on by
default, Size greater than 1 MB kept Photos above its two files, 20,000 rows filtered by owner, the
switch was disabled and off over ten million rows and came back on after. No console errors.

### Found by building it, and fixed

- **A column changed after the first render never reached the engine.** `<Gridwright />` memoised
  its columns on id, `edit` and `icon`. With editing off the memo returned the array captured when it
  last ran, so hiding a column, renaming its header, or changing `sortable` in a later render did
  nothing. Reproduced at `HEAD` before touching it, then fixed by keying the memo on everything the
  engine reads and not memoising unwrapped columns at all. Regression test with editing on and off.
- **Opening the dialog left focus on the page body, in a real browser only.** The dialog started
  `visibility: hidden` until measured, and the focus effect ran before the measurement's re-render,
  so the browser refused to focus the condition. jsdom does not model visibility, so every test
  passed. It now starts transparent and focuses in the same layout effect that places it. Found by
  clicking it in Chrome.

## Known gaps

- **Inside a CSS `transform`, the dialog is positioned against the transformed ancestor.** It is
  `position: fixed` to escape the table wrapper's clipping; a transform creates a containing block
  that `fixed` cannot see past. A portal would fix it at the cost of `react-dom` in the entry and the
  theme variables. Worth revisiting if a consumer reports it.
- **One condition per column.** `api.setFilter` replaces a column's filter. "Between" covers the
  common case; OR within a column is a query builder.
- **No filter row.** Deferred as a non-goal in the spec. The draft model would serve it unchanged.
- **A source that pages but does not filter reports the page's matches as the total.** Seen in the
  playground: with the server paging and the pipeline filtering, "between 130,000 and 135,000" found
  nothing among the 25 rows that arrived, and the range read "0 of 0" although the server holds 270
  matches. This is the engine's existing behaviour for any facet the pipeline applies to a page it
  did not page itself (search does the same), not something column filters introduced, and it is
  the capability table's documented "on the page received". It is still a total the grid computed
  from one page, which the package's own rule forbids. Changing it is an engine decision with a
  semver classification of its own, so it is recorded here as a follow-up rather than folded into
  this feature.
- **Remote announcements can be superseded.** As with a sort, when a filter and the loading state it
  causes land in the same render, the live region says "Loading rows" and then the range, without
  the column's name. That is the existing sort behaviour, kept consistent rather than special-cased.
