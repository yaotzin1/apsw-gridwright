# Self-review: Tree data

## 1. Boundary and layering

`src/tree` is entirely free of the DOM and React, and it is covered by the lint boundary rule.
Layering holds: types, then intervals, then the controller, then the plugin, then the adapter.

The feature needed exactly one engine addition, `invalidatePipeline()`. Everything else attached at
two seams the extensibility document already described as the supported way to do this: a data
source wrapper and a pipeline stage. That is the strongest evidence available that the earlier
design put the seams in the right places.

Anything needing the DOM went to the adapter, which forced a useful clarification into the docs:
"plugin" in this package means a pipeline stage, and a floating menu is a component.

## 2. The local/remote seam

The stage consults `pipeline.capabilities` and skips filtering, searching or sorting that the
source already did. Flattening is never skipped, because no server does it, which is why the stage
declares no capability of its own.

The source wrapper is deliberately not an `async function`: an array answers synchronously, the
engine detects that and skips the loading state, and wrapping it in a promise would have made every
in-memory tree flash a spinner. Caught by a test that read state synchronously after construction.

## 3. Public surface and semver

Minor, recorded in full. One change deserves naming rather than burying: `GridApi` gained a method,
which is additive for callers and breaking for anyone implementing the interface by hand. Nobody is
expected to, and it is written down anyway.

`GridwrightLabels` gained five members. A consumer passing a complete object rather than a partial
one would now fail to type-check; the prop is `Partial<GridwrightLabels>`, so this does not arise.

## 4. Accessibility and i18n

The toggle is a button with `aria-expanded` and a label naming the action. Indentation is padding
on a spacer, so the table stays one cell per column. Child counts are announced through a visually
hidden element. The bubble menu is a `role="menu"` of buttons that opens on focus as well as hover,
because a hover-only menu is decoration that some people cannot use. An editable cell is a button,
so Tab reaches it and Enter opens it. Tests assert the keyboard route for all three.

Five new keys, translated in every bundled locale, with Polish taking four plural forms.

## 5. Supply chain and packaging

No dependency added. The positioning is `getBoundingClientRect` and two numbers rather than a
measurement library. The tree is tree-shakeable: a consumer who never imports it does not carry it.

## 6. Honest output

A cyclic node says so rather than rendering a leaf where a subtree is expected. A failed child load
shows on its own node and stays open so it can be retried. A refused edit reverts completely and
reports, because a half-applied move is worse than a refused one. A row whose parent is missing
becomes a root rather than disappearing. A cycle-only graph still renders every row.

## 7. Verification

```
Test Files  15 passed (15)
     Tests  267 passed (267)

Test Files   1 passed (1)      [smoke, against dist/]
     Tests  12 passed (12)

typecheck      exit 0
lint           exit 0
check-exports  the published package resolves cleanly.
```

Three real bugs were found by tests rather than by reading:

- The node array was in post-order, so `descendantsOf` binary searched an unsorted array.
- A graph that is entirely a cycle produced no roots and therefore an empty grid.
- `BubbleMenu` compared `data-row-id` strictly against the row id, so a grid keyed on numbers never
  opened a menu. Found by the smoke suite, the only layer exercising numeric ids.

A fourth was found by writing a test that failed for the wrong reason: a refused edit rolled back
silently, because the tree cell announced a failed *load* but not a failed *edit*.

## Known gaps

- **No virtualization**, named as a non-goal. A fully expanded tree is still a long list.
- **No drag and drop.** `moveNode` exists; the pointer semantics do not.
- **No cascading selection.** Neither default is obviously right, so neither ships.
- **Subtrees are materialised per placement.** A row under three parents duplicates its subtree
  three times. Correct for the model, and worth measuring before anyone points a genuinely large
  graph at it.
- **The index is rebuilt in O(n) on every mutation.** Fine at client sizes and recorded in
  research.md, but it is the first thing to look at if editing ever feels slow.
- **`onCommit` receives no abort signal.** A rapid sequence of edits to one row can settle out of
  order. The pending flag discourages it; nothing prevents it.
