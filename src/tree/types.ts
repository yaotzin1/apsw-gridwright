import type { RowId } from '../core/types';

/**
 * Identity of one *placement* of a row in the tree.
 *
 * Not the same thing as a row id. A row may sit under several parents, and each of those positions
 * is its own node with its own interval, depth and expansion state, while all of them share one
 * `rowId` and one row object. Editing the row changes every placement; expanding one placement
 * expands only that one.
 */
export type NodeId = string;

export type TreeLoadState = 'idle' | 'unloaded' | 'loading' | 'loaded' | 'error';

/**
 * A node in the nested set.
 *
 * `left` and `right` are the classic Celko interval. They buy three things a tree grid needs on
 * every keystroke:
 *
 * - **Ancestry in two comparisons.** `a.left < b.left && b.right < a.right`, with no walk.
 * - **Subtree size for free.** `(right - left - 1) / 2`.
 * - **A total order that is already the display order.** Walking by ascending `left` is a
 *   depth-first traversal, which is exactly the flat row list a grid renders.
 *
 * The intervals describe structure only. Sorting siblings reorders the walk without touching them,
 * so a sort does not invalidate an ancestry check.
 */
export interface TreeNode<TRow> {
    readonly nodeId: NodeId;
    readonly rowId: RowId;
    readonly row: TRow;
    readonly parentNodeId: NodeId | null;
    readonly left: number;
    readonly right: number;
    /** Zero at the roots. */
    readonly depth: number;
    /** Row ids from the root down to and including this node. Used to detect cycles. */
    readonly rowPath: readonly RowId[];
    readonly childNodeIds: readonly NodeId[];
    /** True when children exist, including children that have not been loaded yet. */
    readonly hasChildren: boolean;
    readonly loadState: TreeLoadState;
    /**
     * True when this placement repeats a row already on its own path.
     *
     * A cyclic node is rendered once and never expanded, because following it would produce an
     * infinite tree. Graphs with cycles are not a malformed input; they are what you get the first
     * time a "reports to" field points in a circle.
     */
    readonly cyclic: boolean;
}

export interface TreeIndex<TRow> {
    /** Every node, in ascending `left`, which is depth-first order. */
    readonly nodes: readonly TreeNode<TRow>[];
    readonly byNodeId: ReadonlyMap<NodeId, TreeNode<TRow>>;
    /** Every placement of a row, so an edit can reach all of them. */
    readonly placementsByRowId: ReadonlyMap<RowId, readonly NodeId[]>;
    readonly rootNodeIds: readonly NodeId[];
    readonly maxDepth: number;
    /** Nodes dropped because they repeated a row already on their path. */
    readonly cyclicNodeIds: readonly NodeId[];
    /** True when at least one row is placed under more than one parent. */
    readonly hasMultipleParents: boolean;
}

export interface TreeShapeOptions<TRow> {
    /** Stable identity of the row itself, shared by every placement of it. */
    readonly getRowId: (row: TRow) => RowId;
    /**
     * Children carried on the row. The nested shape: `{ id, name, children: [...] }`.
     * Mutually exclusive with `getParentIds`.
     */
    readonly getChildren?: (row: TRow) => readonly TRow[] | undefined;
    /**
     * Parents named by the row. The flat shape, and the only one of the two that can express a row
     * with several parents: `{ id, name, parentIds: ['a', 'b'] }`.
     */
    readonly getParentIds?: (row: TRow) => readonly RowId[] | RowId | null | undefined;
    /**
     * Whether a row has children that have not been loaded. Consulted only for a node with no
     * children present, so a lazy tree can render a toggle before it knows what is behind it.
     */
    readonly hasChildren?: (row: TRow) => boolean;
    /** Stop descending past this depth. Guards a pathological input, not a normal tree. */
    readonly maxDepth?: number;
}
