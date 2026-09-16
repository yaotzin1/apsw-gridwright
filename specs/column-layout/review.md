# Self-review: column layout (resizing, pinning and visibility)

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Nothing under `src/core`, `src/data`, `src/plugins`, `src/tree`, `src/i18n` or `src/locales`
changed, except the four locale packs gaining a translated section. The engine gained no field, no
event and no plugin.

Everything is under `src/react/layout/`, and inside that the split is deliberate:

- `layout.ts` is pure arithmetic and pure data handling, with no `document`, no `window` and no
  React. It holds the offsets, the clamping, the custom property name and the reading of a saved
  layout, which is everything easy to get wrong, and `tests/unit/column-layout.test.ts` covers it
  without rendering a table.
- `GridResizeHandle.tsx` is the only file that touches the DOM, and only through the element it
  rendered itself: `closest('table')` from the handle, and a measurement pass over the cells.

Imports still point one way. `src/react/index.ts` gained exports; no part of the shell imports the
add-on, which `tests/smoke/tree-shaking.test.ts` now holds with a marker of its own.

The one thing that could have gone in the engine and did not is `pinned`. `ColumnDef` already
carries `width`, `minWidth` and `hidden`, which is everything the engine has an opinion about; a
sticky edge is a decision only a renderer can act on, and putting it on `ColumnDef` would make it
vocabulary a headless consumer has to read and ignore.

One design constraint found during implementation and worth recording: the add-on contributes no
`tableWrapper`. `GridTable` keeps the **last** ref it is handed, so a grid listing both
`columnLayout()` and `virtualRows()` would silently lose one of them. The drag reaches the table
with `closest('table')` instead, which needs no ref, and the playground was driven with both add-ons
on together to confirm it.

## 2. The local/remote seam

Nothing in this feature reads the query, writes the query, or asks where a row came from. There is
no branch on a data source anywhere in `src/react/layout/`, and no `capabilities` facet is involved.

The one thing that reaches the engine is `ColumnDef.hidden`, written through `configure`. That is
the same field a consumer can already set on a column, so a hidden column behaves identically over
an array and over a paginating endpoint: the column is not rendered and `buildExportTable` leaves it
out. No stage narrows rows, so no total changes and there is nothing new to report.

Verified in the playground against the mock endpoint with every "the server resolves" facet on and
with all four off, and with `virtualRows()` on top: same markup, same offsets.

## 3. Public surface and semver

**Minor.** Everything is added; nothing existing changed signature, and no existing default moved.
Recorded in `api-surface.md` and in `CHANGELOG.md`.

Added, all from `apsw-gridwright/react`: `columnLayout`, `COLUMN_LAYOUT_ADDON`,
`columnLayoutMessages`, `GridColumnPicker`, `GridResizeHandle`, `ColumnLayoutProvider`,
`useColumnLayout`, `useOptionalColumnLayout`, `useColumnLayoutController`, and the pure helpers
`stickyOffsets`, `columnWidthProperty`, `columnWidthVar`, `clampWidth`, `autoFitWidth`,
`pixelWidth`. Types: `ColumnLayoutOptions`, `ColumnLayoutState`, `ColumnLayoutController`,
`ColumnLayoutColumnOptions`, `ColumnPin`, `LayoutColumn`, `StickyOffsets`, `WidthBounds`,
`GridColumnPickerProps`, `GridResizeHandleProps`, `ColumnLayoutProviderProps`. Every type in a new
signature is exported; `npm run check:exports` verifies both module conditions and now asserts four
of the new names by hand.

The column option `layout` is added to `GridwrightColumn` by module augmentation, from the add-on's
own module, exactly as `filter` and `edit` are. Optional, so nothing that compiles today stops
compiling.

Two contract decisions changed from the stage-1 draft and are recorded as clarifications in
`spec.md` rather than left as drift:

- **C-3: an unpinned column is `null`, not `undefined`.** The layout exists to be saved, and
  `JSON.stringify` drops the key of an `undefined` value, so "explicitly not pinned" would come back
  from storage saying nothing and the column's own `layout.pinned` would pin it again. Confirmed in
  the browser: unpinning a column that declares `pinned: 'left'` persists `"name": null` and
  survives a reload.
- **C-2: no `columnSignature` contribution.** The draft asked for one; `useGridwright` applies every
  `configure` before it builds the signature and the signature already reads `column.hidden`, so it
  would have been a second copy of one fact.

Two behaviours a consumer inherits by listing the add-on, neither of which breaks a build, both
recorded in `api-surface.md` under "Defaults introduced or changed": the table gets
`table-layout: fixed`, and its cells truncate rather than wrap. Both arrive on the add-on's own
class on the table, so a grid that does not list it renders exactly what it rendered before —
asserted by a test.

## 4. Accessibility and i18n

Every new control is reachable by keyboard and named:

- The resize handle is a focusable `role="separator"` with `aria-orientation="vertical"`,
  `aria-label="Resize {column}"`, `aria-valuenow` and `aria-valuemin`, and `aria-valuemax` only
  where the column declared a `maxWidth`. Arrow keys step 5px, `Shift` 20px, `Home` snaps to the
  floor, `Enter` fits the content. A `<button>` would have replaced the semantics holding the value
  with semantics holding a press.
- The picker is a real `role="menu"`: arrow keys move between items, `Escape` closes it and returns
  focus to the trigger, and each column is a `menuitemcheckbox` carrying its own state. A column
  that may not be hidden is `aria-disabled` rather than `disabled`, so it stays in the arrow-key
  order and can still say why.
- `aria-sort` is untouched; the handle sits beside the sort button through `headerAfter`, never
  inside it, which a test asserts.

A hidden column is not rendered at all, so the DOM order stays the column order and the decision in
`specs/react-only-accessible-state` §4 to carry no `aria-colindex` still holds.

Announcements went through two channels, on purpose, and the reason is now in
`docs/accessibility.md`:

- A **width** change says "{column} width: {n} pixels" through `grid.announce`. A width changes
  nothing the engine knows, so nothing speaks over it.
- A column **shown or hidden** goes through an `announce` contributor at priority 15. Said through
  `grid.announce` it was overwritten by the row range the refetch produces a moment later — found by
  a failing test, not by reading. Several columns at once say nothing, because naming one would tell
  the reader the others are still hidden.

Every visible string is a message key under `gridwright:column-layout`, translated into `de`, `es`,
`fr` and `pl`, and `tests/unit/i18n.test.ts` now audits this add-on with the rest. No literal is
rendered from JSX. Sticky offsets are logical (`inset-inline-start`), and the keyboard direction is
mirrored in a right-to-left page, so "pinned to the start" means the start of the row.

## 5. Supply chain and packaging

No new runtime dependency and no new dev dependency: pointer capture, CSS custom properties, a
`Range` measurement and React state. `dependencies` is still empty.

New files entering the tarball: the eight modules under `src/react/layout/`, built into the existing
`dist/react` entry. No new entry point, no change to `files`, no change to the export map.
`npm run check:exports` passes, including "both entries share one module instance" and "core bundle
and shared chunks contain no react import".

The security questions from `application_security/SKILL.md`:

1. **Which untrusted inputs does this change touch, and which sink does each reach?** Two. A
   **column id**, which can come from a server-driven column set, reaches a CSS custom property
   name. A **saved layout**, which is parsed JSON of a shape nobody checked, reaches the add-on's
   state.
2. **Does any new code create a string that becomes markup, a URL, a selector, a style or a
   script?** One: the custom property name. `columnWidthProperty` escapes every character outside
   `[A-Za-z0-9-]`, `_` included so the escape is injective and two columns cannot collide on one
   property. `tests/unit/column-layout.test.ts` feeds it `a); background: url(http://evil.test`, a
   quote, a brace, a newline, a comment opener and a backslash, and asserts the result matches
   `^--gw-col-w-[A-Za-z0-9_-]+$`. No markup, no URL and no script is built anywhere in this feature.
   Auto-fit deliberately builds **no selector**: it reads every `[data-column-id]` element and
   compares the dataset value, because a comparison needs no encoding at all.
3. **Does any new extension point let third-party code reach something a consumer's renderer could
   not?** No new extension point. `useColumnLayout()` returns setters over the add-on's own state,
   reachable only inside a grid that lists the add-on, and everything it can do the picker can do.
   The add-on itself is written against the published contract and contributes only attributes the
   allowlist already permits.
4. **Did the security audit pass, and did it scan `dist/`?** Yes, both — see §7.

The saved layout gets the explicit treatment the skill asks for: `normalizeLayout` reads the three
records field by field, keeps only values of the type they claim to be, and refuses `__proto__`,
`prototype` and `constructor` by name; `withEntry` refuses to write them. A test feeds it
`JSON.parse('{"widths":{"__proto__":{"polluted":true},"name":120}}')` and asserts both that the key
is dropped and that `Object.prototype` is clean. Every read of a layout record goes through
`entryOf`, so a column called `toString` behaves like any other column instead of finding a function.

## 6. Honest output

No number is invented. Every width the grid shows is one the reader set, one the column declared, or
the add-on's stated default; `aria-valuemax` is omitted rather than filled in where a column
declared no ceiling, so the grid never reports a limit it does not have. Nothing here touches totals,
so `isTotalExact` is unaffected.

Auto-fit is the one measurement, and it is honest about its scope in two ways. It measures the cells
that are mounted, which under `virtualRows()` is the rows on screen and not every row in the result
— documented, because fitting to rows nobody has scrolled to would mean fetching them. And it
measures the text with a `Range` rather than `scrollWidth`: `scrollWidth` never reports less than the
element already is, so the first implementation "fitted" a too-wide column to the width it already
had. Driven in Chrome afterwards, auto-fit converges on the same width from 180px, from 234px and
from 50px, and leaves no cell ellipsised.

No loading state is published by this feature at all. No new failure path: a browser without storage
costs the reader a saved layout and nothing else, which the playground shows by swallowing the
`localStorage` error.

The boundary shadow is drawn whether or not the grid is scrolled, which is a deliberate difference
from AC-04; see "Known gaps".

## 7. Verification

`npm run verify`, end to end, on the final tree:

```
> apsw-gridwright@0.7.0 verify
> npm run clean && npm run validate:skills && npm run sync:check && node scripts/security-audit.mjs --source && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports && npm run security:audit

> apsw-gridwright@0.7.0 clean
> node -e "require('node:fs').rmSync('dist', { recursive: true, force: true })"

> apsw-gridwright@0.7.0 validate:skills
> node scripts/validate-skills.mjs

🔍 Gridwright Agent Skills Validator & Security Auditor
Scanning directory: D:\projects\private\apsw-gridwright\.agents\skills

  ✔ [PASS] accessibility, api_surface, application_security, architect, data_source, debugger,
            documentation, extensibility, performance, qa, react_adapter, refactor, release,
            security_guard, smoke_tests, styling   (16 of 16)

────────────────────────────────────────────────────────────
✨ All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)

> apsw-gridwright@0.7.0 sync:check
> node scripts/sync-claude-skills.mjs --check && node scripts/sync-agent-docs.mjs --check && node scripts/check-workflow.mjs

.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 14 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)

> apsw-gridwright@0.7.0 typecheck
> tsc --noEmit

> apsw-gridwright@0.7.0 lint
> eslint .

> apsw-gridwright@0.7.0 test
> vitest run

 RUN  v5.0.0 D:/projects/private/apsw-gridwright

Error: Not implemented: window.focus
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:83:14)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined
Error: Not implemented: window.print
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:85:18)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined
Error: Not implemented: window.focus
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:83:14)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined
Error: Not implemented: window.print
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:85:18)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined
Error: Not implemented: window.focus
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:83:14)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined
Error: Not implemented: window.print
    at module.exports (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\Window.js:960:7
    at HTMLIFrameElement.<anonymous> (D:/projects/private/apsw-gridwright/src/react/export/download.ts:85:18)
    at HTMLIFrameElement.callTheUserObjectsOperation (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLIFrameElementImpl._dispatch (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at fireAnEvent (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\helpers\events.js:18:36)
    at onLoad (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\living\nodes\HTMLFrameElement-impl.js:27:5)
    at Object.check (D:\projects\private\apsw-gridwright\node_modules\jsdom\lib\jsdom\browser\resources\resource-queue.js:76:23) undefined

 Test Files  36 passed (36)
      Tests  596 passed (596)
   Start at  09:06:30
   Duration  13.88s (tests 48%, environment 31%, transform 10%, setup 7%, import 4%, worker 1%)

Environment  jsdom was created 36 times · 41.55s total, 31% of tracked time
             create it once per worker with pool: 'vmThreads' (keeps per-file isolation) or isolate: false (shares it across files)
             learn more: https://vitest.dev/guide/improving-performance#test-environments

> apsw-gridwright@0.7.0 test:smoke
> npm run build && vitest run --config vitest.smoke.config.ts

> apsw-gridwright@0.7.0 build
> tsup

CLI Building entry: {"index":"src/index.ts","react/index":"src/react/index.ts","locales/index":"src/locales/index.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: D:\projects\private\apsw-gridwright\tsup.config.ts
CLI Target: es2021
CLI Cleaning output folder
ESM Build start
CJS Build start
DTS Build start

 RUN  v5.0.0 D:/projects/private/apsw-gridwright

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Start at  09:06:55
   Duration  2.85s (tests 54%, environment 21%, transform 8%, setup 8%, import 8%, worker 1%)

> apsw-gridwright@0.7.0 check:exports
> node scripts/check-exports.mjs

checking the built package as a consumer meets it

  ok   [.][import][types] -> dist/index.d.ts
  ok   [.][import][default] -> dist/index.js
  ok   [.][require][types] -> dist/index.d.cts
  ok   [.][require][default] -> dist/index.cjs
  ok   [./react][import][types] -> dist/react/index.d.ts
  ok   [./react][import][default] -> dist/react/index.js
  ok   [./react][require][types] -> dist/react/index.d.cts
  ok   [./react][require][default] -> dist/react/index.cjs
  ok   [./locales][import][types] -> dist/locales/index.d.ts
  ok   [./locales][import][default] -> dist/locales/index.js
  ok   [./locales][require][types] -> dist/locales/index.d.cts
  ok   [./locales][require][default] -> dist/locales/index.cjs
  ok   [./styles.css] -> dist/styles.css
  ok   [./package.json] -> package.json
  ok   files: dist
  ok   files: README.md
  ok   files: LICENSE
  ok   files: CHANGELOG.md
  ok   types declared for . (import)
  ok   types declared for . (require)
  ok   types declared for ./react (import)
  ok   types declared for ./react (require)
  ok   types declared for ./locales (import)
  ok   types declared for ./locales (require)
  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   stylesheet exposes theming custom properties
  ok   core ESM entry exports 25 expected names
  ok   core CommonJS entry matches the ESM entry
  ok   VERSION matches package.json (0.7.0)
  ok   locales entry exports 5 catalogs
  ok   react ESM entry exports 43 expected names
  ok   react ESM entry no longer exports TreeGridwright, useTreeGridwright
  ok   both entries share one module instance

the published package resolves cleanly.

> apsw-gridwright@0.7.0 security:audit
> node scripts/security-audit.mjs

security audit: no findings (source, manifest, dist)

[33 per-file test lines and tsup bundle listings elided; every summary line above is verbatim]
```

Tests that would have caught this change's absence, and would catch its regression:

| Test | Holds |
| :--- | :--- |
| `tests/unit/column-layout.test.ts` (22) | the offsets, the clamping, the escaped property name against six hostile ids, injectivity, a saved layout naming `__proto__`, `entryOf` against `toString` |
| `tests/react/column-layout.test.tsx` (34) | the handle by role and name, the keyboard model, the pointer drag committing only on release, a cancelled drag keeping its width, a pointer it never captured, the picker by role, a locked column, "show all" and "reset", a hidden column leaving an export, a hidden column still being searched, pinning on data and on the selection column, `onChange` silent on mount, and a layout that round-trips through JSON |
| `tests/react/accessible-state.test.tsx` | the `announce` regression: a sentence survives a render in the same tick. Verified to fail on the pre-fix `context.tsx` and pass after |
| `tests/unit/i18n.test.ts` | all four locale packs carry this add-on's keys and invent none |
| `tests/smoke/tree-shaking.test.ts` | a grid that does not import the feature does not ship it |
| `scripts/check-exports.mjs` | `columnLayout`, `GridColumnPicker`, `GridResizeHandle` and `useColumnLayout` are in the built react entry |

The manual checks no gate can make, done in Chrome against the built package on the playground:

- Dragged a column edge: the custom property moved during the drag while `aria-valuenow` did not,
  and the commit landed on release. Confirmed the geometry exactly — every column at its declared
  width, the checkbox column at offset 0 and the pinned name at 48.
- Scrolled a table wider than its container: the checkbox column and the pinned name stayed at 1px
  and 49px from the wrapper's edge while an unpinned column passed under them at -211px, and the
  right-pinned status column stayed at the far edge.
- Keyboard walk-through: Tab to a handle, arrows 5px, `Shift` 20px, `Home` to the floor, `Enter` to
  fit, each one announced, focus never lost.
- The picker: opened, hid a column (announced, persisted, unchecked), found the locked column
  `aria-disabled`, "show all", "reset layout" with focus returned to the trigger, `Escape`.
- Pinning from the page's own controls, built on `useColumnLayout()`: pinning a second column moved
  the boundary shadow, and unpinning one that declares `pinned: 'left'` persisted `null` and
  survived a reload.
- Every add-on switch on and then off again, alone and combined: layout with `virtualRows()`, with
  `columnFilters()`, with `treeData()`, and with row actions, inline editing and export together.
  With the add-on off the table has no `gw-table--fixed`, no handles and no picker. No console error
  in any combination.

Two defects were found this way and fixed rather than noted: the picker menu hung 107px past the
grid (it now measures and flips its edge, as the export menu already did), and auto-fit could only
ever widen a column.

## Known gaps

- **The pinned shadow is always drawn, not only while the table is scrolled** (AC-04 asked for the
  latter). Knowing the scroll position means holding a ref to the scrolling wrapper, and
  `GridTable` keeps only the last `tableWrapper` ref it is handed, so taking one would break
  `virtualRows()` in any grid listing both. A permanent shadow also tells the reader which columns
  will stay before they find out by scrolling. Worth revisiting if the contract ever lets more than
  one add-on observe the wrapper.
- **No pin control ships with the package.** `useColumnLayout()` is the surface, and the playground
  builds a pin UI out of it in about thirty lines. Where a pin button belongs is a layout decision,
  and the picker would have grown a second vocabulary to hold it. Worth adding if consumers keep
  writing the same control.
- **A column whose `width` is not a pixel count renders at `defaultWidth`.** `'20%'` and `'auto'`
  cannot be summed into a sticky offset. Measuring the rendered width instead would make the layout
  depend on mount order; documented in `docs/column-layout.md` rather than guessed at.
- **Auto-fit measures rendered text, so a cell whose renderer returns a block element measures as
  the full cell.** Fitting such a column is a no-op rather than wrong. A renderer-supplied
  measurement hook would fix it and is not worth a contract seam yet.
- **Column reordering and nested header groups are non-goals**, unchanged from `spec.md` §4.
