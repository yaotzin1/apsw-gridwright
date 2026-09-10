import type { RowId } from '../core/types';
import type { NodeId, TreeIndex, TreeNode, TreeShapeOptions } from './types';

/**
 * Row ids go into a node id, and a row id may contain the separator.
 *
 * Without escaping, a row `a/b` under `a` collides with a row `b` under `a/b`. Rare, and the kind
 * of rare that produces two rows sharing a React key and a selection that jumps between them.
 */
const ESCAPED = /%/g;
const SEPARATOR_IN_ID = /\//g;

export function encodeSegment(rowId: RowId): string {
    return String(rowId).replace(ESCAPED, '%25').replace(SEPARATOR_IN_ID, '%2F');
}

export function joinNodeId(parentNodeId: NodeId | null, rowId: RowId): NodeId {
    const segment = encodeSegment(rowId);
    return parentNodeId === null ? segment : `${parentNodeId}/${segment}`;
}

/** Ancestry in two comparisons, which is the whole reason for the interval. */
export function isAncestor<TRow>(ancestor: TreeNode<TRow>, node: TreeNode<TRow>): boolean {
    return ancestor.left < node.left && node.right < ancestor.right;
}

export function isSelfOrAncestor<TRow>(ancestor: TreeNode<TRow>, node: TreeNode<TRow>): boolean {
    return ancestor.left <= node.left && node.right <= ancestor.right;
}

/** Subtree size without walking it. */
export function descendantCount<TRow>(node: TreeNode<TRow>): number {
    return (node.right - node.left - 1) / 2;
}

export function isLeaf<TRow>(node: TreeNode<TRow>): boolean {
    return node.right === node.left + 1;
}

export function descendantsOf<TRow>(
    index: TreeIndex<TRow>,
    nodeId: NodeId,
): readonly TreeNode<TRow>[] {
    const node = index.byNodeId.get(nodeId);
    if (!node) return [];

    // The nodes array is in ascending `left`, so a subtree is a contiguous slice of it. No walk,
    // no recursion, no set of visited ids.
    const start = binarySearchByLeft(index.nodes, node.left) + 1;
    const found: TreeNode<TRow>[] = [];
    for (let position = start; position < index.nodes.length; position += 1) {
        const candidate = index.nodes[position]!;
        if (candidate.left > node.right) break;
        found.push(candidate);
    }
    return found;
}

export function ancestorsOf<TRow>(
    index: TreeIndex<TRow>,
    nodeId: NodeId,
): readonly TreeNode<TRow>[] {
    const found: TreeNode<TRow>[] = [];
    let current = index.byNodeId.get(nodeId)?.parentNodeId ?? null;

    while (current !== null) {
        const parent = index.byNodeId.get(current);
        if (!parent) break;
        found.unshift(parent);
        current = parent.parentNodeId;
    }

    return found;
}

function binarySearchByLeft<TRow>(nodes: readonly TreeNode<TRow>[], left: number): number {
    let low = 0;
    let high = nodes.length - 1;

    while (low <= high) {
        const middle = (low + high) >> 1;
        const value = nodes[middle]!.left;
        if (value === left) return middle;
        if (value < left) low = middle + 1;
        else high = middle - 1;
    }

    return low - 1;
}

interface BuildState<TRow> {
    readonly nodes: TreeNode<TRow>[];
    readonly byNodeId: Map<NodeId, TreeNode<TRow>>;
    readonly placements: Map<RowId, NodeId[]>;
    readonly cyclic: NodeId[];
    counter: number;
    maxDepth: number;
}

/**
 * Builds the nested set from either shape of input.
 *
 * Nested rows carrying `children`, or flat rows naming `parentIds`. The flat shape is the one that
 * can express a row with several parents, and such a row is visited once per parent, producing one
 * node per placement.
 */
export function buildTreeIndex<TRow>(
    rows: readonly TRow[],
    options: TreeShapeOptions<TRow>,
): TreeIndex<TRow> {
    const state: BuildState<TRow> = {
        nodes: [],
        byNodeId: new Map(),
        placements: new Map(),
        cyclic: [],
        counter: 0,
        maxDepth: 0,
    };

    const depthLimit = options.maxDepth ?? 64;
    const rootNodeIds: NodeId[] = [];

    if (options.getParentIds) {
        const { roots, childrenByRowId, rowsById } = adjacencyFrom(rows, options);
        const source: Source<TRow> = { kind: 'adjacency', childrenByRowId, rowsById };

        for (const row of roots) {
            rootNodeIds.push(visit(row, null, [], 0, state, options, depthLimit, source));
        }

        // Rows that no root reaches. A graph that is entirely a cycle has no root at all, and
        // without this every one of its rows would silently vanish from the grid. Each unreached
        // row is promoted to a root, in input order, until all of them are placed.
        for (const row of rows) {
            if (state.placements.has(options.getRowId(row))) continue;
            rootNodeIds.push(visit(row, null, [], 0, state, options, depthLimit, source));
        }
    } else {
        for (const row of rows) {
            rootNodeIds.push(visit(row, null, [], 0, state, options, depthLimit, { kind: 'nested' }));
        }
    }

    const hasMultipleParents = [...state.placements.values()].some((ids) => ids.length > 1);

    return {
        // Built in post-order, because a node's interval is not closed until its children are
        // visited. Sorted here into ascending `left`, which is depth-first pre-order, which is the
        // order a grid renders and the order `descendantsOf` binary searches.
        nodes: state.nodes.sort((a, b) => a.left - b.left),
        byNodeId: state.byNodeId,
        placementsByRowId: state.placements,
        rootNodeIds,
        maxDepth: state.maxDepth,
        cyclicNodeIds: state.cyclic,
        hasMultipleParents,
    };
}

type Source<TRow> =
    | { readonly kind: 'nested' }
    | {
          readonly kind: 'adjacency';
          readonly childrenByRowId: Map<RowId, TRow[]>;
          readonly rowsById: Map<RowId, TRow>;
      };

/**
 * Turns flat rows into roots plus an adjacency map.
 *
 * A row is a root when it names no parent, or names a parent that is not in the data. The second
 * case matters: a filtered or paginated slice of a tree routinely arrives with its parents
 * missing, and dropping those rows entirely would show an empty grid for data that is present.
 */
function adjacencyFrom<TRow>(rows: readonly TRow[], options: TreeShapeOptions<TRow>) {
    const rowsById = new Map<RowId, TRow>();
    const childrenByRowId = new Map<RowId, TRow[]>();
    const roots: TRow[] = [];

    for (const row of rows) {
        rowsById.set(options.getRowId(row), row);
    }

    for (const row of rows) {
        const parents = normaliseParents(options.getParentIds!(row));
        const known = parents.filter((parentId) => rowsById.has(parentId));

        if (known.length === 0) {
            roots.push(row);
            continue;
        }

        for (const parentId of known) {
            const bucket = childrenByRowId.get(parentId);
            if (bucket) bucket.push(row);
            else childrenByRowId.set(parentId, [row]);
        }
    }

    return { roots, childrenByRowId, rowsById };
}

function normaliseParents(value: readonly RowId[] | RowId | null | undefined): readonly RowId[] {
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value as RowId];
}

function visit<TRow>(
    row: TRow,
    parentNodeId: NodeId | null,
    parentPath: readonly RowId[],
    depth: number,
    state: BuildState<TRow>,
    options: TreeShapeOptions<TRow>,
    depthLimit: number,
    source: Source<TRow>,
): NodeId {
    const rowId = options.getRowId(row);
    const nodeId = joinNodeId(parentNodeId, rowId);
    const rowPath = [...parentPath, rowId];

    // A row that already appears on its own path would recurse forever. It is placed once, marked,
    // and not descended into.
    const cyclic = parentPath.includes(rowId);
    const atLimit = depth >= depthLimit;

    const left = (state.counter += 1);
    const childNodeIds: NodeId[] = [];

    const children = cyclic || atLimit ? [] : childrenOf(row, rowId, options, source);
    for (const child of children) {
        childNodeIds.push(visit(child, nodeId, rowPath, depth + 1, state, options, depthLimit, source));
    }

    const right = (state.counter += 1);

    const declaredHasChildren = options.hasChildren?.(row) ?? false;
    const node: TreeNode<TRow> = {
        nodeId,
        rowId,
        row,
        parentNodeId,
        left,
        right,
        depth,
        rowPath,
        childNodeIds,
        hasChildren: childNodeIds.length > 0 || (!cyclic && declaredHasChildren),
        // A node with children present is loaded. One that only claims to have them is not, which
        // is what tells the controller to fetch on first expand.
        loadState: childNodeIds.length > 0 ? 'loaded' : declaredHasChildren && !cyclic ? 'unloaded' : 'idle',
        cyclic,
    };

    state.nodes.push(node);
    state.byNodeId.set(nodeId, node);
    state.maxDepth = Math.max(state.maxDepth, depth);
    if (cyclic) state.cyclic.push(nodeId);

    const placements = state.placements.get(rowId);
    if (placements) placements.push(nodeId);
    else state.placements.set(rowId, [nodeId]);

    return nodeId;
}

function childrenOf<TRow>(
    row: TRow,
    rowId: RowId,
    options: TreeShapeOptions<TRow>,
    source: Source<TRow>,
): readonly TRow[] {
    if (source.kind === 'adjacency') return source.childrenByRowId.get(rowId) ?? [];
    return options.getChildren?.(row) ?? [];
}

/**
 * Re-sorts the whole index so the nodes array is in ascending `left` again.
 *
 * Callers build incrementally when lazy children arrive, which appends nodes out of order. The
 * intervals themselves stay valid; only the array order needs restoring.
 */
export function orderIndex<TRow>(index: TreeIndex<TRow>): TreeIndex<TRow> {
    const nodes = [...index.nodes].sort((a, b) => a.left - b.left);
    return { ...index, nodes };
}
