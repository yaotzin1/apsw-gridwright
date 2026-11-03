# Self-review: Framework-neutral adapter architecture

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

## 2. The local/remote seam

## 3. Public surface and semver

## 4. Accessibility and i18n

## 5. Supply chain and packaging

## 6. Honest output

## 7. Verification

```
<paste the actual output of npm run verify>
```

## Known gaps

<!-- What was deliberately left undone, and the condition that would justify doing it. -->

## Review debate, 2026-11-02 (interim, covers T-03 to T-08 only)

This was written believing the Indaba engine was not installed on this machine, so it is a stand-in, not an Indaba run. (It was
there, as source in a sibling checkout and not as a command on PATH; the real run is the next section.) It has the same
shape: an independent reviewer that saw only the branch diff critiqued it, the author answered with
code, and the reviewer attacked the answers (two rounds). Nothing here is a ruling by the maintainer.

Round 1 found eight issues; all were reproduced with a probe before fixing:
prototype-key lookups in slot and component registries (crash), no slot cycle guard (stack overflow),
`sanitizeNode` throwing on non-list children, unchecked style values, `type` checked only on `input`,
headless lint gaps (`.tsx`, `navigator`, relative adapter imports), a store that stopped notifying after
one listener threw, and a component guard that blocked legitimate recursion.

Round 2 found that the fixes held except three: the depth cap did not bound work (a component
rendering itself twice, or slots holding two of the next, expand exponentially inside 64 levels), the
CSS check was a denylist that `=rl(` and `src(` passed, and a style getter was read twice, so the
checked value was not the drawn one. Fixed with a 20 000-node budget, an allowlist of CSS functions that
also refuses backslashes, comments, `;`, braces and at-rules, and by checking a copy of the style.
Each has a regression test that fails without its fix.

## Known gaps

- Lint does not see dynamic `import('react')`, `require` or `globalThis.document` in the headless
  directories. A narrow selector would be cheap but a broad one could break core code; the headless
  lint test and review carry it until a renderer package makes it matter.
- The relative-import ban matches any path ending in a `react` directory, and does not catch an import
  that reaches the adapter through a barrel elsewhere.
- The CSS value check is deliberately conservative: a value using a function outside the allowlist is
  refused, and an adapter author who needs one must add it to `SAFE_CSS_FUNCTIONS` with a reason.
- Not started: T-13 onward. T-09 to T-11 are done; T-12 is the checkpoint below and waits for the maintainer.

## T-12 checkpoint, 2026-11-02 (T-09 to T-11 done; the maintainer decides whether to expand)

**What was built.** The neutral add-on contract, the React renderer, and `sorting()` written once as plain data
and drawn through that renderer. The React `sorting()` *is* the neutral one now, so every existing sorting,
multi-sort, `aria-sort`, header-row-navigation and live-region test exercises the new path unchanged. The five
markup snapshots are byte-identical. The render benchmark is within 6 percent of the parent commit on all three
fixtures (`research.md`).

**Research question 1: does the node description hold without `component`?** For the add-on's own markup, yes:
the sort button, its indicator, its priority badge, `aria-sort` and the title are all elements, text and
attributes. Two things were *not* the add-on's to write, and both reached it through the grid it is handed:

1. *The navigation cursor.* Whether the button leaves the Tab order depends on `cellNavigation()`, a React
   context. It became `headerControlTabIndex` on the render grid; the adapter reads the cursor and hands over a
   plain `-1 | undefined`. Every control a future add-on draws inside a cell needs the same kind of value.
2. *A column's own header renderer.* `headerCell` returns React. The add-on asks `grid.headerContent(column)` and
   receives text, or a `component` node the *adapter* created and resolves. So `component` is needed for content
   the consumer supplies in the adapter's framework, and not for anything a built-in add-on authors. That is the
   use the spec reserved it for, and it is the answer to the question: the description is enough for the
   built-ins as long as the render grid carries a few adapter-owned values.

**A defect the renderer boundary found.** The sanitizer copies `style` into an object with no prototype (the
fix for the getter hole in round 2), and React calls `styles.hasOwnProperty`, which that object lacks, so every
sanitized style crashed `renderNode`. The text renderer never touched that path. Found by the test that
compares the React DOM with the text renderer's output for one description; fixed in `renderNode` by copying
with `Object.fromEntries`, with a regression test using a `__proto__` key. Lesson recorded: a second renderer is
what exercises the first one's assumptions, which is the point of the architecture.

**Departures from the plan, all small.**
- `ViewAddonContribution` holds six slots, not "every field": it grows with the add-ons that migrate (stated in
  the type's comment). A slot that is absent is one the React contract still owns.
- `setup` is called whenever the adapter wants the contribution (React: each render), not once per grid as C-5
  planned. That is harmless while an add-on has no state, and it is *the* open design question for T-15, below.
- Store binding in `useGridwright` (part of T-10) is not built, for the same reason.
- `ViewRenderGrid` is split from `ViewGrid`: attribute functions run outside a render and cannot read the cursor.

**Open for the maintainer before T-13 onward.**
1. *Per-grid state.* Selection (page, indeterminate, shift-range) and pagination (size) have state. Options:
   the adapter passes `setup` a `state(key, initial) => Store<T>` that it keeps per grid instance (React: a
   `useRef` map, bound with `useSyncExternalStore`); or a neutral add-on creates its store in its factory and the
   adapter calls the factory once per grid. The first keeps `sorting({ multiSort })` options live as today; the
   second freezes them. Recommendation: the first.
2. *Selection's DOM reads* (`closest`, `getSelection`, `cellControlOf`) need a structural description of the event
   target (T-15). Not started.
3. *The contract keeps growing.* Selection needs `extra columns`, `rowAttributes`, `tableKeyDown` and a toolbar
   status; pagination needs `belowTable`. Each is additive, but the neutral contribution is on track to mirror
   the React one slot for slot. If that is unwelcome, say so before T-15.
4. *What remains of the aim.* Nothing here draws a table. `buildTableModel` (T-14) is the step that lets a second
   framework draw one without re-implementing the shell, and it is the larger piece of work.

## T-14 go/no-go, 2026-11-02

**Question.** Is the table model, with the neutral add-ons, a complete enough description of a grid that a renderer
needs nothing from React?

**Answer for the core path: yes.** A host with no DOM and no framework (`createGridHost`) runs the engine, the add-ons and
their state, and publishes a table model. A driver in a plain Node environment (`typeof document === 'undefined'` is
asserted) draws `tableNode(model)` through the allowlist, finds elements by role and name, delivers clicks, Shift-clicks,
Tab and Enter to the handlers the nodes carry, and passes all six sorting scenarios that the React grid passes. A
second test renders the same grid through the React shell and through the model and compares the two trees line by line
(default page, three sorts, an empty grid, right-to-left): they are identical.

**What the exercise found, each now fixed and tested.**
1. *React and the text renderer disagreed about units*: React draws `width: 140` as `140px`, the text renderer printed
   `140`. A description is only renderer-independent if the unit rule is shared, so `styleValueText` is in the view layer.
2. *The sanitizer rejected `style: undefined`*, which every framework reads as "no style", and the model produces it for
   a cell with no alignment. An absent style is now no attribute; a string or a list is still an error.
3. *The allowlist lacked `<p>`*, which the shell's error body uses. Added; inert.
4. *A host told of every publish never announced a sort*: the engine publishes the new query before the rows, and the
   live region (correctly) waits for the rows. React batches the two publishes into one render and never sees the first;
   a host that sees both spent the change on the first. The retry rule is now in `createLiveRegion`'s contract and the
   host follows it. This is the kind of rule a second adapter would have had to rediscover.

**What this does not show.** The core path is one add-on (sorting) and the shell's plain body. Not covered, and the
likely places for the answer to turn into "no":
- *Selection* (T-15): its handlers read the DOM, and the checkbox column is an extra column the neutral contract has no
  slot for.
- *Virtualization*: needs the scrolling element, a measured window, and a body the add-on owns.
- *Cell navigation*: DOM focus management, `closest`, and a cursor shared across cells.
- *Add-ons that hold React state or context* (inline editing, row detail, the tree, the filter popover).
Each of those needs a neutral slot or a deliberate decision to stay React-only. The decision for the maintainer is where
the line goes; the architecture does not force it either way.

**The React shell does not draw from the model.** It shares the model's logic (numbering, body status, labels, the live
region) but keeps its own rendering, because it supports features the model cannot yet express. That is a choice, not an
omission: switching it would have dropped column windows, extra columns, custom rows, `rowAfter`, footers and wrapper refs.

## Indaba review debate, 2026-11-03 (a real run; covers the branch through T-17)

**What ran.** Indaba `0.1.0-alpha.5` from its checkout, workflow `adapter-architecture-review` (one `review_debate`-style step), roles
`claude` (runner `claude-code`) and `antigravity`, `--permissions read`, task `adapter-review-1`, trace `66e54b21f033f69b0083bfddcc60e379`.
The working tree was clean at `c4ce2f7` and nothing under `src/` changed while they read it. Outcome: **reached after 3 rounds**, no
arbiter needed (`arbiter: human` was set and not asked). Cost: three `claude-code` calls, about $0.50; the antigravity calls were not
priced. The transcript is [`indaba-debate-2026-11-03.md`](indaba-debate-2026-11-03.md). No record was added to `.indaba-decisions`,
because no arbiter ruled.

**What agreement means.** As Indaba's own docs say, `AGREEMENT` here is "I accept the other reviewer's findings", not "the code is
good", and two models agreeing is not evidence a finding is true. Each was reproduced with a probe on the unfixed code before anything
changed, and every fix has a regression test that fails without it (16 of 20 new tests fail on the old source; the other 4 assert
behaviour that was already right).

| # | Agreed finding | Verdict | What was done |
| :--- | :--- | :--- | :--- |
| 1 | Header, table and row attribute bags skip the node allowlist | **Real, security.** A `url(...)` background reached all three; a raw `SyntheticBaseEvent` reached an add-on's `onClick`. | `sanitizeAttrs` (view layer, exported) applied to all three bags in `adaptViewAddon`; returns the same object when nothing is dropped. |
| 2 | A handler's `focus` action resolves a DOM id across the document | **Real, security.** Focus reached an input outside the grid. | `ViewAction` focus is now `{ type: 'focus', key }`, the same shape `settled` returns (`ViewFocus`); resolved only among the keyed elements of the same drawing; a request with no drawing is dropped. |
| 3a | Style property names are unchecked | **Real, security.** A name carrying `; other-property` printed a second declaration in the string renderer. | Names must match a plain CSS name (camelCase, kebab-case or custom property). |
| 3b | A fixed-position overlay can redress clicks | **Real as a capability, small.** | `position: fixed` refused. `absolute`, `relative`, `sticky` stay. |
| 3c | `id`, `name`, `htmlFor` are allowlisted on every tag | **Accepted, no change.** They are in the existing React add-on allowlist and ARIA relationships need them; a neutral add-on has the power a React one always had. Recorded here so it is a decision, not an oversight. | None. |
| 4 | Host notifies before `settled` runs; a request can linger; extra refreshes | **Real**, except the reviewers' reference to a `createViewSignal` at `host.ts:102`, **which does not exist anywhere in the code**. Listeners saw `null` 8 times of 8; a request survived an unrelated page change; one press caused 4 notifications. | `settled` runs before the model is built and before anyone is told; a request belongs to its page and a newer page replaces one nobody took; an add-on writing its own state while settling is built for once, before the notification, so a press now tells listeners no more than the same page change through the API plus recording the press. |
| 5 | `origin` is read lazily after dispatch | **Real.** Read after dispatch it said `textSelected: true` when nothing was selected during the click. | Once React has cleared `currentTarget`, an uncomputed `origin` answers cautiously (from a control, nested, text selected, no cell) and is not remembered; documented on `ViewEvent.origin`: read it while the handler runs. |
| 6a | `rowHandlers` allocates per row against a spec promise of a cached object | **Real, but the spec was wrong.** A cache keyed by row id would hold a closure for every row ever scrolled past. | Spec corrected to say what the code does and what it was measured at. |
| 6b | `rowModelOf` recomputes slot lists and extra columns per row | **Real.** | Found once per model (`RowPlan`); a test shows building fifty rows reads the contribution no more than building none. |
| 6c | `<NeutralSlot>` per extra-column cell is per-row work | **Dropped in the debate itself** (round 3), and measured: no fixture over 20 percent (research.md, T-17). | None. |
| 7 | Spec and code disagree: `HANDLER_NAMES` (8 against 6), `ViewAction`, `resolveContributions` against `resolveSet`, `conformanceSuite` signature | **Real, all four**, verified by reading both sides. | `api-surface.md` now states the built names and shapes. |

**Cost of the fixes, measured.** The contributed attributes are now checked for every row, so the benchmark was re-run (eight
interleaved pairs, the commit before the fixes against the working tree, on an idle machine, the two fixtures that draw per-row
attributes): `virtualRows` mount -2% and change +1% by median; the checkbox fixture level or faster (head slower in 1 of 8 pairs on mount).
Nothing measurable.

**Behaviour changes this introduces, on purpose.** `ViewAction`'s focus field is `key`, not `targetId`; `__proto__` and any name that is
not a plain CSS name is refused as a style key, and a style with one refused value is refused whole (the existing rule); `position: fixed`
is refused; an add-on that reads `ViewEvent.origin` after its handler returned gets the cautious answer. All of this is in the
unpublished `apsw-gridwright/view` entry, so none of it is a change to a published surface.

**Not covered by the debate.** It read `src/view`, `src/conformance`, `src/react/view`, the three migrated add-ons, `GridPagination` and
the spec's two files. It ran nothing and did not see the benchmarks, the build or the packaging (T-18 is next), or the docs. Two
reviewers are not a security audit.
