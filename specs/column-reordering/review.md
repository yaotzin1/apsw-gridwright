# Self-review: column reordering

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Nothing under `src/core`, `src/data`, `src/plugins` or `src/tree` changed. The feature adds **no
module at all**: every file it touches already existed, which is the strongest evidence available
that it went where it belonged.

The split inside `src/react/layout/` holds. `orderedColumns` and `moveInOrder` are in `layout.ts`
with the rest of the pure arithmetic — no DOM, no React, no state — and are covered by
`tests/unit/column-layout.test.ts` without rendering a table. The DOM is touched only through
handlers the browser calls on elements the shell rendered.

Imports still point one way. `src/react/index.ts` gained two function exports and no new path.

The engine does the reordering, in the sense that matters: `configure` hands it a reordered array
and `setColumns` takes it from there. Nothing reorders while rendering, which is why
`api.getColumns()`, global search and every export agree with the header row instead of the header
row being a view of its own.

What could have gone in the core and did not is an `order` field on `ColumnDef`. The declared array
*is* the declared order; a field saying it again would be a second source of truth, correct until
the day it disagreed.

## 2. The local/remote seam

Nothing in this feature reads or writes `GridQuery`, and there is no branch anywhere on where the
rows came from. No `capabilities` facet is involved, and a reorder makes **no request**: it calls
`setColumns`, which re-resolves columns and re-runs the pipeline over the rows already held.

One observable effect across the seam, documented rather than hidden: a source that reads
`DataSourceRequest.columns` to build its own projection now receives them in the reader's order. For
a server that echoes that order into a file, that is the behaviour a reader wants; for one that
ignores it, nothing changes. Verified in the playground against the mock endpoint with every "the
server resolves" facet on and with all four off.

## 3. Public surface and semver

**Minor, with one type-level break stated rather than hidden**, classified in `api-surface.md` and
repeated in `CHANGELOG.md`.

Added: `orderedColumns` and `moveInOrder`, both pure. Changed, all additive except the first and the
last:

- `ColumnLayoutState` gained a **required** `order: readonly string[]`. Receiving the state and
  handing back a `Partial` are unaffected; building a complete literal by hand now needs `order`.
  A compile error with an obvious fix, no silent behaviour change, and the package is unpublished.
  `order?:` was rejected: the other three fields are required because the state is the whole layout,
  and a layout always has an order.
- `ColumnLayoutOptions` gained `reorderable?`, `ColumnLayoutColumnOptions` gained `movable?`, and
  `ColumnLayoutController` gained `order`, `indexOf`, `canMove` and `moveColumn` — an interface
  consumers receive and never implement.
- `setPinned` now **moves** the column to the edge it is pinned to, and clear of the run when
  unpinning, in one update. A behaviour change to a method added earlier on this same branch and
  never released. Two calls could not have composed: `moveColumn` decides a pin from the neighbours
  it finds, so a `setPinned` followed by a `moveColumn` would have read the pins from before the
  first call and undone it. Recorded in `spec.md` C-11 with the reasoning.

One inherited behaviour that changes rendered markup without breaking a build, recorded in
`api-surface.md`: **every movable header is now `draggable`**, which changes what click-and-hold
does on it. `reorderable: false` restores the previous markup exactly, and a test asserts it.

Three decisions changed from the draft during stages 5 and 6, each recorded as a clarification in
`spec.md` rather than left as drift: C-8 (`aria-keyshortcuts` instead of `aria-roledescription`),
C-9 (the `Ctrl` keydown arrives before any arrow) and C-10 (the `move` string was dropped once it
had nowhere to go). A fourth was added after the feature was working, C-11: the picker gained pin
toggles, because reordering exposed that a reader on a grid with nothing pinned had no route to
pinning at all.

## 4. Accessibility and i18n

The keyboard route is not an afterthought here, and it cost the most thought.

- **No new tab stop.** `Ctrl`/`Cmd` + arrow rides the header's existing sort button. A third
  focusable control per header would make tabbing a ten-column header thirty presses for every
  keyboard user, whether or not they ever reorder. The handler is contributed through
  `headerAttributes` and **composes** with the sorting add-on rather than replacing it — the plan
  named this as the top risk, it was probed before any feature code was written, and a test asserts
  that a header which reorders still sorts.
- **`Ctrl` rather than a bare arrow**, because bare arrows inside a `role="grid"` belong to cell
  navigation (`specs/cell-navigation-and-clipboard`). A shortcut that moves things is much harder to
  take away than one never offered.
- **`aria-keyshortcuts`, not `aria-roledescription`.** Caught at stage 5, before code: a role
  description *replaces* the role name, so a movable header would have announced "movable column"
  instead of "column header" and the reader would have lost the structural fact to gain an
  affordance. The trade looks conscientious and is bad.
- **Every move is announced** by name and position, through the add-on's announcement contributor
  rather than `announce`, for the same reason visibility is: a reorder settles new engine state and
  a sentence said any other way is spoken over by the row range that follows. The position counts
  the data columns a reader can see and not the checkbox column — "of 8", not "of 9" — which the
  browser check confirmed.
- **The sentence is never wrong.** Moving a column one place and moving its neighbour the other way
  produce the identical array, so a diff cannot name the mover, and the keyboard path produces
  exactly that case every time. The add-on records which column it moved instead of reconstructing
  it; for a move made by a consumer's own control the diff still answers where it can and returns
  null where it cannot, so the region says the row range rather than naming the wrong column.

Every new string is a key under `gridwright:column-layout`, translated into `de`, `es`, `fr` and
`pl`, and audited by the existing `tests/unit/i18n.test.ts`. One string, not two: the draft's `move`
label was dropped when its home disappeared, because a string nothing renders is a string four
translators write and nobody reads. Direction is mirrored in a right-to-left page, so "towards the
end of the row" is the same physical key it is for resizing.

## 5. Supply chain and packaging

No new dependency, runtime or dev. The whole feature is the native drag-and-drop API, React state
and two array functions. The obvious alternative — `dnd-kit`, `react-dnd`, `interactjs` — is larger
than this entire package and was rejected in `research.md` before anything was written.

No new file enters the tarball: every module touched already shipped. No new entry point, no change
to `files` or the export map. `npm run check:exports` passes, `npm pack --dry-run` lists 35 files
from `dist/` plus the four manifest files, and the security audit passes against source, manifest
and the built `dist/`.

The security questions from `application_security/SKILL.md`:

1. **Which untrusted inputs does this change touch, and which sink does each reach?** Two, both
   already in scope for this add-on and both extended here. A **column id** now also reaches a
   `DataTransfer`. A **saved layout** now also carries an `order` array.
2. **Does any new code create a string that becomes markup, a URL, a selector, a style or a
   script?** No. The one new string that leaves the page is the column id on the drag's data
   transfer, and it is put on a **private type**, `application/x-gridwright-column`, never
   `text/plain` — so it cannot be dropped into whatever text field happens to be on the page or in
   another application. Firefox requires *some* data for a drag to begin, so this is a deliberate
   choice rather than decoration. A test asserts `setData` is called exactly once and with that
   type, and the real-browser check confirmed `dataTransfer.types` held only it with `text/plain`
   empty — something jsdom could not have proved.
3. **Does any new extension point let third-party code reach something a consumer's renderer could
   not?** No new extension point at all. This is the sharpest evidence for the add-on contract in
   the repository: `draggable` was already in `CONTRIBUTABLE_ATTRIBUTES` and `on*` handlers were
   already permitted, so a third-party add-on could have written this feature without a line
   changing in `src/react/addons/`.
4. **Did the security audit pass, and did it scan `dist/`?** Yes, both — see §7.

`normalizeLayout` treats `order` the way it treats the other three records: it must be an array, and
every entry must be a string, or it is dropped and the grid keeps its declared order. Ids are
deliberately not checked against the columns there, because `initial` is read before the columns are
known; an unknown id falls out of `orderedColumns` instead. Tested against a string, an object and a
mixed array.

## 6. Honest output

Nothing is invented. The order shown is the order the reader arranged, the position announced is
counted from the columns they can see, and a column the saved order does not name is placed by a
stated rule rather than a guess about where they would have wanted it.

The one place this feature could have lied is the announcement, and it is the place most of the
design effort went. See §4: rather than name a column a diff cannot identify, it stays silent and
the region falls back to the row range. A sentence naming the wrong column is worse than no
sentence, because the reader has no way to tell it is wrong.

No loading state, no totals, no new failure path. Nothing here fetches.

## 7. Verification

`npm run verify`, end to end, on the final tree:

```
> apsw-gridwright@0.7.0 verify
> npm run clean && npm run validate:skills && npm run sync:check && node scripts/security-audit.mjs --source && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports && npm run security:audit

✨ All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)

.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 14 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)

> tsc --noEmit
> eslint .

> vitest run
 Test Files  36 passed (36)
      Tests  623 passed (623)

> npm run build && vitest run --config vitest.smoke.config.ts
 Test Files  2 passed (2)
      Tests  25 passed (25)

> node scripts/check-exports.mjs
  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   core ESM entry exports 25 expected names
  ok   react ESM entry exports 43 expected names
  ok   both entries share one module instance
the published package resolves cleanly.

> node scripts/security-audit.mjs
security audit: no findings (source, manifest, dist)
```

623 unit and React tests, up from 596: 9 new in `tests/unit/column-layout.test.ts` for the ordering
arithmetic and the validated `order`, and 18 new in `tests/react/column-layout.test.tsx`.

What would catch this change's absence, and its regression:

| Test | Holds |
| :--- | :--- |
| `orderedColumns` / `moveInOrder` units | the declared order when nothing is saved, an unknown id skipped, an unnamed column appended, clamping at both ends, and the identity return that lets a no-op move skip a state update |
| `normalizeLayout` unit | an order of strings kept, a string, an object and a mixed array refused |
| drag tests | a drop moves the column, the in-flight marks are drawn, an abandoned drag changes nothing, and the transfer carries the private type only |
| keyboard tests | `Ctrl`+arrow moves and stops at the ends, **sorting still works on the same header**, and the bare `Ctrl` keydown moves nothing |
| lock tests | a locked column is not a drag source, refuses to move, and cannot be moved across; `reorderable: false` removes every attribute |
| integration tests | a drag from the resize handle resizes and does not reorder; a drop into a pinned run pins the column; the move is announced; `onChange` reports an order that survives JSON and restores through `initial`; an export follows the order |

The manual checks no gate can make, in Chrome against the built package:

- **The drag, with a real `DataTransfer`** — the thing jsdom structurally cannot do. Dragging Salary
  onto Name moved it to position 1, drew `data-dragging` and `data-drop-target="start"`,
  `preventDefault` ran so the drop was allowed, and `dataTransfer.types` held only
  `application/x-gridwright-column` with `text/plain` empty.
- **The keyboard**, from the header's own sort button: Email moved from position 3 to 2, announced
  "Email moved to position 2 of 8" — confirming the position counts data columns and not the
  checkbox.
- `draggable="true"`, the `aria-keyshortcuts` attribute and a `grab` cursor on a movable header.
- The order persisted to `localStorage` alongside the widths and pinning, and the pin rule firing:
  Salary dropped at the start, against a left-pinned Name, came out pinned left.

## Known gaps

- **Native drag-and-drop is weak on touch.** A tablet reader gets the keyboard route and the
  controller, not a drag. The alternative was pointer events, which means re-implementing the drag
  image, the cancel gesture and the edge auto-scroll, or a dependency. Stated in
  `docs/column-layout.md` rather than left to be discovered.
- **A move made by a consumer's own `moveColumn` call that swaps two neighbours is not announced.**
  The add-on records its own moves; a consumer's are diffed, and that one case is genuinely
  ambiguous. Silence is the honest answer. A consumer who wants the sentence can say it through
  `announce`.
- **A column added after a layout was saved appears last** for readers with a saved order. Documented
  in three places because it is the one rule that will generate a bug report that is not a bug.
- **A pin control outside the picker is still the application's.** The picker covers the reader;
  a toolbar pin control, a settings dialog or a per-column menu is `useColumnLayout()` and about ten
  lines, as the playground shows. That split is deliberate rather than unfinished.
- **No drop indicator between columns, only on them.** The drop target shows which edge the column
  lands against, which is enough to be unambiguous and needs no extra element in the header row.
- **Reordering does not move a column into or out of the hidden set**, and hidden columns keep their
  neighbours through a move rather than following the column they were next to. The alternative
  needs a rule for where a hidden column "is", which is a question with no good answer.
