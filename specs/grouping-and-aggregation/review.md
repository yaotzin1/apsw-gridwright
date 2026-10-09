# Self-review: row grouping and aggregation

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

`src/grouping/` (the plugin, the controller, the aggregate math, the column and data-source
wrappers) imports nothing from `src/react`, `document` or `window` — it is pure TypeScript over
`src/core/types`, `src/core/pipeline`, `src/core/values` and `src/core/errors`. `eslint.config.js`'s
`no-restricted-globals`/`no-restricted-imports` rules pass over it, the same gate every core module
sits behind. Every decision that touches DOM or React — the toggle button, the treegrid role, the
column augmentation, the controller's React lifecycle — lives in `src/react/grouping/`. Imports run
one way: `src/react/grouping` depends on `src/grouping`, never the reverse. Bucketing, ordering and
aggregate computation are plain functions in `plugin.ts` and `aggregate.ts`, not methods on a
component or a hook.

## 2. The local/remote seam

Grouping works over a plain array (`createLocalDataSource`, every unit test) and is the one place in
this feature that explicitly does **not** work over a source that resolves pagination itself: it
needs every matching row in memory, and refuses (via a thrown `GridwrightError`, caught by the
pipeline, reported on `plugin:error`) rather than silently grouping one page. `serverGrouped: true`
is the escape hatch for a source that already grouped — the local stage's `skip` returns `true` and
the source's own rows pass through untouched. No code branches on the data source's `kind` or on
anything other than `capabilities.paginate` and the `serverGrouped` option; the branch is on a
declared capability, which is what the seam is for. The stage reports the new total (`totalRows:
grouped.length`, group headers included) whenever it actually narrows or reshapes the set.

## 3. Public surface and semver

**Minor.** Recorded in api-surface.md: new exports only (`groupingPlugin`, `createGroupingController`,
`createGroupingDataSource`, `groupColumn(s)`, `ungroupedRows`, `computeAggregate`, three string
constants, the `GroupedRow`/`GroupHeaderRow`/`GroupMemberRow`/`GroupAggregateSpec`/aggregate-function
types, and `grouping`/`GroupRow`/`SummaryRow`/`groupingMessages` from the React entry), plus one new
column field (`aggregate`, via module augmentation — additive, opt-in per column). Nothing existing
changed signature or default. Every type appearing in a new signature is itself exported (checked by
hand against `src/grouping/index.ts` and `src/react/grouping/index.ts`); both `import` and `require`
conditions resolve types (`npm run check:exports`, both `dist/index.d.ts` and `dist/index.d.cts`
checked).

## 4. Accessibility and i18n

The toggle is a real `<button>`, reachable by Tab and activated by Enter/Space because it is a
button and not a styled `<div>`; it carries no `aria-expanded` of its own (the row does, per the
treegrid pattern — the same choice the tree already made, so the two are consistent). Every group
header row has `aria-expanded` and `aria-level`; every member row has `aria-level` one past its
group's. The table is `role="treegrid"` while `grouping()` is listed. `aria-sort` is untouched:
grouping does not own the header cell's sort button, `sorting()` still does. Every visible string —
`expand`, `collapse`, `itemsCount`, `summaryTotal`, `summaryAverage` — is in `gridwright:grouping`'s
messages, none written into JSX directly, translated in `de`, `es`, `fr`, `pl` and audited by
`auditAddonMessages` in `tests/unit/i18n.test.ts`. English carries no separate locale-pack entry, by
design (`en.ts` re-exports `englishCatalog` verbatim; every add-on's own `messages.en` is the English
fallback), matching every other built-in add-on.

**Verified in the browser**: the built package, served through the playground
(`npm run example:serve`), driven through Chrome — group by department, collapse/expand, the summary
row, and role/aria-expanded/aria-level read directly off the live DOM via
`document.querySelector`/`getAttribute`, not asserted only in jsdom. See "Caught during this review"
below for what that walk-through actually found.

## 5. Supply chain and packaging

No new runtime dependency; `package.json`'s `dependencies` is untouched (`scripts/security-audit.mjs`
and `scripts/check-exports.mjs` both check this and both pass). `npm run check:exports` passes,
extended with `groupingPlugin` and `grouping` in the packaging audit's allowlists so the new surface
is actually checked rather than merely present. `npm pack --dry-run` lists only `dist/`, `README.md`,
`LICENSE.md`, `CHANGELOG.md` and `package.json` — no new file category entered the tarball (`docs/`,
`specs/`, `tests/` and `examples/` are not in `files` and none of that changed).

## 6. Honest output

The grid never computes a total it was not given: `totalRows` from the grouping stage is
`grouped.length`, a count of what the stage actually produced, not an estimate. No loading state is
published for the local case — `createGroupingDataSource` wraps a synchronous local source
synchronously (`isThenable` guards it, matching `createTreeDataSource`'s exact pattern), so a
grouped grid over an array renders its first paint without a spinner it never needed. The refusal to
group a paginating source is a sentence naming the actual problem and the fix ("cannot group a data
source that paginates for itself... Set serverGrouped..."), not a silent wrong answer.

## 7. Verification

```
> apsw-gridwright@0.12.1 typecheck
> tsc --noEmit
(clean)

> apsw-gridwright@0.12.1 lint
> eslint .
(clean)

> apsw-gridwright@0.12.1 test
> vitest run
 Test Files  52 passed (52)
      Tests  953 passed (953)

> apsw-gridwright@0.12.1 test:smoke
> npm run build && vitest run --config vitest.smoke.config.ts
 Test Files  3 passed (3)
      Tests  30 passed (30)

> apsw-gridwright@0.12.1 check:exports
ok   core ESM entry exports 29 expected names
ok   react ESM entry exports 65 expected names
ok   both entries share one module instance
ok   apsw-gridwright-mui imports the grid and carries no copy of it
the published package resolves cleanly.

> apsw-gridwright@0.12.1 security:audit
> node scripts/security-audit.mjs
security audit: no findings (source, manifest, dist)

node scripts/sync-claude-skills.mjs --check && node scripts/sync-agent-docs.mjs --check && node scripts/check-workflow.mjs
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync
workflow.ai.yml matches the repository
```

`npm run verify` passed end to end, this exact output, on 2026-09-29. Tests that would have caught
this feature's absence: every test in `tests/unit/grouping.test.ts` and
`tests/react/grouping.test.tsx` fails against `dev` before this change (the modules do not exist).
Tests that would catch a regression: the same two files, plus `tests/unit/i18n.test.ts`'s catalog
completeness check (drops the `gridwright:grouping` locale entries out from under a future edit) and
`scripts/check-exports.mjs`'s extended allowlist (drops the two new representative export names).

**Caught during this review — two bugs the automated suite did not, both found by actually running
the playground:**

1. **A column's `cell` and `icon` renderers received the `GroupedRow` wrapper, not your row.** The
   first version of `groupColumn` wrapped only the core `ColumnDef` fields (`accessor`, `comparator`,
   `filterFn`, `formatValue`, `exportValue`) — not the React-only `cell`/`icon`, which `...rest`
   carried through unrewritten. Every test up to that point used plain `{ id, header }` columns, so
   nothing exercised this path; the employees playground's `name` column (a custom `cell` and `icon`)
   would have shown `undefined` fields. Fixed by `src/react/grouping/columns.tsx`
   (`reactGroupColumns`), the React half `reactTreeColumns` already has for the same reason.
   `tests/react/grouping.test.tsx`'s "passes a custom cell and icon renderer your row" asserts the
   specific failure mode directly.
2. **Toggling `summaryRow` (or `groupBy`, `serverGrouped`) after the grid had already mounted did
   nothing.** `GroupingPluginOptions` were destructured once when `groupingPlugin()` was called;
   recreating the plugin object on every render is a no-op once a plugin is installed, because
   `UseGridwrightOptions.plugins` is reconciled by name and a new object under a name already
   installed is ignored. This was invisible to every test written so far, because none of them
   changed an option after the initial render — the bug only showed up live in the browser (the
   summary row's `<tfoot>` rendered, correctly reactive since that part is a plain React prop, but
   its aggregate cell stayed blank, because the stage that fills it never re-ran). Fixed two ways:
   `groupingPlugin`'s stage now reads `options.*` fresh on every pipeline pass instead of once at
   creation, and `GroupingController` gained `refresh()` — notify subscribers with no expansion
   change — which `grouping()` calls from a `useEffect` whenever its own options change, reusing the
   exact wiring a toggle already had. `tests/react/grouping.test.tsx`'s "turns summaryRow on after
   the grid already mounted" exercises the whole path, not the plugin in isolation, so it would have
   caught this the first time.

Both were found running `npm run example:serve` and driving the built package in Chrome — clicking
"group by department" and "summary row" in the employees playground, reading `aria-*` attributes off
the live DOM, not only asserting them in jsdom. A CSS layout bug (a spanned `<td>` given
`display: flex` directly does not reliably stretch to its full colSpan width in table auto-layout;
`src/react/grouping/GroupRow.tsx` now nests the flex row one level in, inside a plain `<td>`) was
found the same way and is not a correctness bug, so it is not counted above, but it is the same
lesson: nothing in `tests/react/*.test.tsx` renders real CSS, so a layout bug is invisible to jsdom
assertions by construction.

## Change after release: the range counts records (2026-10-09, issue #60, PR #71)

Answers for the dimensions this change touched; the rest did not move.

- **2. Seam.** The stage already refuses a paginating source, so it only ever sees every matching row.
  The record range is counted from what it produced and used only when `isTotalExact`, so it never
  stands in for a count a paginating source did not send.
- **3. Public surface.** minor, recorded in api-surface.md under "Changes after release": one additive
  observable key, `state.meta['gridwright:grouping:records']`, and a behaviour fix to `pageRangeOf`.
  The PR first called it a patch; the table in the `api_surface` skill puts a new optional field at
  minor, and this corrects the label. `totalRows`, `pageCount` and `aria-rowcount` are unchanged, so
  AC-03 still holds.
- **4. Accessibility.** The live-region sentence now reads the same range as the footer, and re-runs
  when a group opening moves it. A page holding only headers announces "0 to 0 of N".
- **6. Honest output.** "Never invents a total" still holds: `total` is a count of member rows the
  stage received, not an estimate, and it is ignored when the source's own total is inexact.
- **7. Verification.** Four grouping tests (expanded, all collapsed, a group opening with the live
  region, a remote source) fail without the change, plus a `pageRangeOf` unit case.

## Known gaps

- **No manual walk-through with an actual screen reader.** The browser walk-through (above) drove the
  built package with the mouse and read ARIA attributes off the DOM directly, and every role-queried
  Testing Library selector confirms the accessible name/role Testing Library computes the same way a
  screen reader would — but nobody ran a real screen reader (NVDA, VoiceOver) against it this session.
- **`defaultExpanded` does not live-update.** It is read once, at controller creation
  (`useState(() => createGroupingController({ defaultExpanded: ... }))`), matching how `treeData()`'s
  `defaultExpandedDepth` behaves. Changing it on an already-mounted grid has no effect — arguably
  correct (an already-toggled group's state shouldn't reset under the reader), but undocumented as a
  deliberate choice versus a limitation. Unlike `groupBy`/`aggregates`/`summaryRow`/`serverGrouped`
  (see "Caught during this review"), no playground control exercises this, so it was not verified
  either way.
- **No sort-groups-by-aggregate option.** The spec's original wording ("groups are ordered by key,
  then optionally by an aggregate") was narrowed during implementation — see spec.md §8. Add a
  `compareGroups` plugin option if a consumer asks for it; nothing in the acceptance criteria needed
  it.
- **No scroll compensation when a group above the viewport collapses under `virtualRows()`.**
  Recorded as an unmitigated risk in plan.md §5. The row count changes correctly and the window
  renders the right rows; nothing scrolls to keep the reader's eye on the same content. A future
  enhancement, not a regression — a windowed table without grouping has the same property for any
  row-count change today.
- **No dedicated performance measurement.** research.md records this honestly rather than asserting a
  number. The bucketing algorithm is one `Map`-based pass per `groupBy` level, which is the same
  order of work a `sort` does, but nobody ran it against a 50k-row set.
- **~~Row actions, inline edit, pay band and row detail were switched off while grouping was on.~~
  Resolved 2026-10-01** (`specs/header-row-navigation/review.md`). `rowDataOf` now unwraps a member
  row, a member row's id is the consumer's own (it was `row:<id>`, which `inlineEditing`'s `commit`
  and `onSelectionChange` leaked), and `cellNavigation()` passes over a group header. Found while
  doing it, and caught only in the playground: `grouping()` rendered forever when an add-on listed
  before it (`inlineEditing()`) rebuilt the columns, because the effect that re-runs the pipeline was
  keyed on an array rebuilt every render. It is keyed on the aggregates' ids and names now.
