# Plan: Tree data

## Modules

| File | Responsibility |
| :--- | :--- |
| `src/tree/types.ts` | `TreeNode`, `TreeIndex`, the shape options |
| `src/tree/nested-set.ts` | building the index, interval queries, node ids |
| `src/tree/controller.ts` | expansion, lazy children, optimistic mutations |
| `src/tree/plugin.ts` | the data source wrapper and the flattening stage |
| `src/tree/columns.ts` | rewriting a row column to read a node |
| `src/react/tree/*` | the component, the hook, the cell, the context |
| `src/react/plugins/BubbleMenu.tsx` | floating row actions |
| `src/react/plugins/InlineEdit.tsx` | the editing state machine and the cell |

## Where the behaviour lives

- **Structure** is a pipeline concern, so it wraps the data source and registers a stage.
- **Expansion** is neither a query facet nor server state, so it lives in the controller.
- **Mutation** is optimistic locally then delegated, so it lives in the controller too, and inline
  editing calls into it rather than reimplementing rollback.
- **Anything needing the DOM** is an adapter component, because the core is DOM-free by contract.

## The one engine change

`invalidatePipeline()`: recompute the visible rows from the last settled result without asking the
source again. Toggling expansion needs it; `refresh()` would issue a network request to answer a
question the client can already answer.

## Layering

```
tree/types          contract
    │
tree/nested-set     intervals, ids, queries          (no React, no DOM)
    │
tree/controller     expansion, lazy load, mutation   (no React, no DOM)
    │
tree/plugin         source wrapper + flatten stage   (no React, no DOM)
    │
react/tree          provider, hook, cell, component
    │
react/plugins       bubble menu, inline edit
```

## Trade-offs taken

- **The index is rebuilt on every mutation**, O(n), rather than patching intervals. Simpler and
  measurably fine at client sizes; recorded in research.md so it is a decision not an accident.
- **Subtrees are materialised per placement.** A doubly-placed node duplicates its subtree. That is
  what makes each placement independently expandable.
- **The tree replaces three stages** rather than composing with them.
- **The grid's row type becomes `TreeNode<TRow>`**, hidden behind the hook.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A cyclic graph recurses forever | path check on every visit, plus a depth limit; tested |
| A cycle-only graph renders nothing | unreached rows promoted to roots; tested |
| Two placements share a React key | grid row id is the node id; tested |
| A stale node array after a mutation | the stage reads the controller's live index, not its argument |
| An in-memory tree flashes a spinner | the source wrapper stays synchronous when its inner source is |
