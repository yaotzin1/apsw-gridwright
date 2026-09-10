# Lifecycle contract: Tree data

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

None on the grid emitter. The tree's own notifications go through the controller's `subscribe`,
which is not the grid event bus:

```ts
controller.subscribe(() => { /* expansion, load state or the store changed */ });
```

That is deliberate. `GridEventMap` is a published contract read by every adapter, and adding
tree-only events would make it describe a feature most grids do not use.

## Events changed

None.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| `core:tree` | 500 (`TRANSFORM`) | none | yes, to the visible node count |

It declares no capability because flattening is never done by a server. It consults
`pipeline.capabilities` itself to decide whether to filter, search and sort.

It **replaces** `core:filter`, `core:search` and `core:sort`: `treePlugins()` installs the tree
stage and pagination, and not those three.

## Ordering guarantees

- The tree stage reads the controller's live index, not the rows handed to it. A lazy load or a
  mutation rebuilds the index without a fetch, so the engine's cached rows are a snapshot of the
  tree as it was one mutation ago.
- A controller notification triggers `api.invalidatePipeline()`, which recomputes and publishes
  `state:change`. It does **not** emit `fetch:success`: a recompute is not a round trip, and
  anything counting requests would be wrong.
- `setRows` is called inside the source's `fetch`, before the engine applies the result, so the
  index is current by the time the stage runs.
- A mutation applies to the store, rebuilds, notifies, and only then awaits `onCommit`. The reader
  sees the change immediately; the rollback comes later if it comes at all.

## Lifecycle

`createTreeController` owns an abort controller per in-flight child load. `destroy()` aborts them
all and clears the listeners. `useTreeGridwright` calls it on unmount.

The tree plugin's `setup` returns a teardown that removes the stage and unsubscribes from the
controller, so removing the plugin leaves nothing behind.
