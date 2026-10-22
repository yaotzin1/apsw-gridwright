# Self-review: an inline editor follows its record

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

Stages run: 1 and 2, 3 (api-surface), 5 (analysis, below), 6, 7, 8. Stage 4 skipped: one step.

## 1. Boundary and layering

Everything is under `src/react/plugins`. Nothing in core, data or plugins changed. `presenceIn` reads the
duck-typed `rowId` and `row` beside a tree node or a group member, the same shape `rowDataOf` reads, rather
than importing the tree module, so `inlineEditing()` does not pull the tree into a bundle that lacks it.

## 2. The local/remote seam

The check reads `state.status` and `state.rows`, which are the same for every source. Tests run it over a
server that is held, failed and re-answered, and the `refreshing` wait leaves the editor alone.

## 3. Public surface and semver

**Minor** by surface: an optional `isPresent` on `InlineEditProviderProps` and an optional second parameter on
`useInlineEdit`. See `api-surface.md`.

## 4. Accessibility and i18n

No text, no announcement. When an editor closes because its record left, focus was already inside a removed
element; the spec lists this as a non-goal. No label added.

## 5. Supply chain and packaging

No dependency or tarball change. `check:exports` and `test:smoke` pass.

**Analysis found one defect before the code was written down as done:** the first version compared the
editor's id with `state.rows[].id`, which closed every editor in a tree, because the editor's id is the
record's and a tree row's id is the placement's. `tests/react/inline-edit-follows-record.test.tsx` has the
tree case that caught it, and the contract became a function that asks by the record's id.

## 6. Honest output

An editor that closes says nothing and writes nothing, which is what the reader's own action (moving the
record off the page) amounted to. Nothing claims a save that did not happen.

## 7. Verification

`tests/react/inline-edit-follows-record.test.tsx` (8 cases: Strict Mode, another record leaving, neighbours
replaced, the wait for an answer, leaving and returning, editing again after returning, a provider with no
`isPresent`, a tree) and the five departures in `tests/react/combinations-edit.test.tsx` that were
`it.fails` before this change and are ordinary tests now.

## Known gaps

- The draft typed before the record left is gone. Keeping it is the non-goal in the spec; the condition that
  would justify it is a consumer asking for a draft that survives pagination.
- Not clicked through in the playground in a real browser. jsdom does not fire `blur` when a focused node is
  moved, and a browser might, so the in-page reorder case is the one to watch there.
