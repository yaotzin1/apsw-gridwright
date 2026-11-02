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

The Indaba engine is not installed on this machine, so this is not an Indaba run. It has the same
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
