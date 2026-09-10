# Data model: Tree data

## TreeNode

```ts
interface TreeNode<TRow> {
    nodeId: NodeId;              // path-shaped, one per placement
    rowId: RowId;                // shared by every placement
    row: TRow;                   // the same object across placements
    parentNodeId: NodeId | null;
    left: number;                // nested set interval
    right: number;
    depth: number;
    rowPath: readonly RowId[];   // root to here, for cycle detection
    childNodeIds: readonly NodeId[];
    hasChildren: boolean;        // including children not yet loaded
    loadState: 'idle' | 'unloaded' | 'loading' | 'loaded' | 'error';
    cyclic: boolean;
}
```

Derived, not stored:

| Question | Expression |
| :--- | :--- |
| Is `a` an ancestor of `b`? | `a.left < b.left && b.right < a.right` |
| How many descendants? | `(right - left - 1) / 2` |
| Is it a leaf? | `right === left + 1` |
| The subtree | a contiguous slice of `nodes`, found by binary search on `left` |

## TreeIndex

| Field | Purpose |
| :--- | :--- |
| `nodes` | every node in ascending `left`, which is render order |
| `byNodeId` | lookup by placement |
| `placementsByRowId` | every placement of a row, so an edit reaches all of them |
| `rootNodeIds` | the walk starts here |
| `cyclicNodeIds` | placements that repeat an ancestor row |
| `hasMultipleParents` | true when any row is placed more than once |

Intervals are assigned in post-order, because a node's interval cannot close until its children are
visited. The array is sorted into ascending `left` afterwards.

## Node ids

`parent + '/' + encode(rowId)`, where `encode` escapes `%` then `/`. Without escaping, row `a/b`
under `a` collides with row `b` under `a/b`, and two grid rows end up sharing a key.

## The internal store

Both input shapes normalise to one store, so a mutation has one implementation:

```ts
{ rows: Map<RowId, TRow>; childIds: Map<RowId | null, RowId[]> }   // null key = roots
```

The index is derived from it and rebuilt when it changes.

## Change objects

```ts
type TreeChange<TRow> =
    | { type: 'update'; rowId; row; previous }
    | { type: 'insert'; rowId; row; parentRowId; index }
    | { type: 'move';   rowId; fromParentRowId; toParentRowId; index }
    | { type: 'remove'; rowId; row; parentRowId; scope: 'placement' | 'row' };
```

Keyed on **row** ids rather than node ids, because that is what a server stores. `scope`
distinguishes removing one edge from removing the row everywhere.

## State shape

`GridState` and `GridQuery` are unchanged. Expansion, load state and pending edits live in the
controller, because none of them is a query facet and no server needs them.
