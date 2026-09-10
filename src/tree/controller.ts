import { toGridError } from '../core/errors';
import type { GridError, RowId, Unsubscribe } from '../core/types';
import { buildTreeIndex } from './nested-set';
import type { NodeId, TreeIndex, TreeLoadState, TreeNode, TreeShapeOptions } from './types';

/** Where an inserted or moved node lands, relative to a reference node. */
export type TreeDropPosition = 'before' | 'after' | 'child';

export interface TreeTarget {
    /** The node the position is relative to. Omit with `child` to mean the root list. */
    readonly referenceNodeId?: NodeId;
    readonly position: TreeDropPosition;
}

export type TreeChange<TRow> =
    | { readonly type: 'update'; readonly rowId: RowId; readonly row: TRow; readonly previous: TRow }
    | {
          readonly type: 'insert';
          readonly rowId: RowId;
          readonly row: TRow;
          readonly parentRowId: RowId | null;
          readonly index: number;
      }
    | {
          readonly type: 'move';
          readonly rowId: RowId;
          readonly fromParentRowId: RowId | null;
          readonly toParentRowId: RowId | null;
          readonly index: number;
      }
    | {
          readonly type: 'remove';
          readonly rowId: RowId;
          readonly row: TRow;
          readonly parentRowId: RowId | null;
          readonly scope: 'placement' | 'row';
      };

export interface LoadChildrenContext<TRow> {
    readonly row: TRow;
    readonly rowId: RowId;
    readonly node: TreeNode<TRow>;
    readonly signal: AbortSignal;
}

export interface TreeControllerOptions<TRow> extends TreeShapeOptions<TRow> {
    /**
     * Fetches the children of a node the first time it is expanded.
     *
     * Loading is keyed on the row, not the placement: children of a row are the same wherever that
     * row appears, so expanding its second placement uses what the first one fetched.
     */
    readonly loadChildren?: (context: LoadChildrenContext<TRow>) => Promise<readonly TRow[]>;
    /**
     * Which shape the rows arrive in, asked on every normalise rather than fixed at construction.
     *
     * The controller owns expansion, loaded children and pending edits, so rebuilding it to change
     * shape throws all three away, and the plugin holding a reference to it would be left pointing
     * at a destroyed object. Defaults to `parents` when `getParentIds` is supplied.
     */
    readonly mode?: () => 'nested' | 'parents';
    /** Expand everything down to this depth on first build. Default 0, meaning roots only. */
    readonly defaultExpandedDepth?: number;
    /** Persist an edit. Omit it and edits stay in memory, which is the right default for an array. */
    readonly onCommit?: (change: TreeChange<TRow>) => Promise<void> | void;
    readonly onExpandedChange?: (nodeIds: readonly NodeId[]) => void;
}

export interface TreeNodeState {
    readonly expanded: boolean;
    readonly loadState: TreeLoadState;
    readonly pending: boolean;
    readonly error: GridError | null;
}

export interface TreeController<TRow> {
    getIndex(): TreeIndex<TRow>;
    /** Replaces the source rows. Called by the data source wrapper on every settled fetch. */
    setRows(rows: readonly TRow[]): void;
    subscribe(listener: () => void): Unsubscribe;

    isExpanded(nodeId: NodeId): boolean;
    expand(nodeId: NodeId): void;
    collapse(nodeId: NodeId): void;
    toggle(nodeId: NodeId): void;
    expandAll(toDepth?: number): void;
    collapseAll(): void;
    getExpandedNodeIds(): readonly NodeId[];
    setExpandedNodeIds(nodeIds: readonly NodeId[]): void;

    getNodeState(nodeId: NodeId): TreeNodeState;

    updateRow(rowId: RowId, patch: Partial<TRow>): Promise<void>;
    insertRow(row: TRow, target: TreeTarget): Promise<void>;
    moveNode(nodeId: NodeId, target: TreeTarget): Promise<void>;
    removeNode(nodeId: NodeId, options?: { scope?: 'placement' | 'row' }): Promise<void>;

    destroy(): void;
}

interface Store<TRow> {
    rows: Map<RowId, TRow>;
    /** Ordered child row ids per parent. The `null` key holds the roots. */
    childIds: Map<RowId | null, RowId[]>;
}

/**
 * Owns everything about the tree that is not the nested set arithmetic: what is expanded, what has
 * been loaded, and what is being edited.
 *
 * Input arrives in one of two shapes and is normalised into one store, so a mutation has a single
 * implementation rather than one per shape. The index is derived from that store and rebuilt
 * whenever it changes, which is O(n) and cheaper than trying to patch intervals in place.
 */
export function createTreeController<TRow>(
    options: TreeControllerOptions<TRow>,
): TreeController<TRow> {
    const { getRowId } = options;

    let store: Store<TRow> = { rows: new Map(), childIds: new Map() };
    let index: TreeIndex<TRow> = emptyIndex();
    let expanded = new Set<NodeId>();
    let firstBuild = true;

    const loadedRowIds = new Set<RowId>();
    const loadingRowIds = new Set<RowId>();
    const loadErrors = new Map<RowId, GridError>();
    const pendingRowIds = new Set<RowId>();
    const commitErrors = new Map<RowId, GridError>();
    const inFlight = new Map<RowId, AbortController>();

    const listeners = new Set<() => void>();
    let destroyed = false;

    const notify = (): void => {
        for (const listener of [...listeners]) listener();
    };

    // ------------------------------------------------------------------------------------------
    // Store and index
    // ------------------------------------------------------------------------------------------

    function normalise(rows: readonly TRow[]): Store<TRow> {
        const next: Store<TRow> = { rows: new Map(), childIds: new Map([[null, []]]) };

        const link = (parentId: RowId | null, childId: RowId): void => {
            const bucket = next.childIds.get(parentId);
            if (bucket) bucket.push(childId);
            else next.childIds.set(parentId, [childId]);
        };

        const mode = options.mode?.() ?? (options.getParentIds ? 'parents' : 'nested');

        if (mode === 'parents' && options.getParentIds) {
            for (const row of rows) next.rows.set(getRowId(row), row);

            for (const row of rows) {
                const rowId = getRowId(row);
                const declared = options.getParentIds(row);
                const parents = (declared === null || declared === undefined
                    ? []
                    : Array.isArray(declared)
                      ? declared
                      : [declared as RowId]
                ).filter((parentId) => next.rows.has(parentId));

                if (parents.length === 0) link(null, rowId);
                else for (const parentId of parents) link(parentId, rowId);
            }

            return next;
        }

        const walk = (row: TRow, parentId: RowId | null): void => {
            const rowId = getRowId(row);
            // A row reached twice through nested data is the same row, not two. Recording the edge
            // twice is what makes a nested shape able to express a second parent at all.
            next.rows.set(rowId, row);
            link(parentId, rowId);

            for (const child of options.getChildren?.(row) ?? []) {
                if (getRowId(child) === rowId) continue;
                walk(child, rowId);
            }
        };

        for (const row of rows) walk(row, null);
        return next;
    }

    function rebuild(): void {
        const roots = (store.childIds.get(null) ?? [])
            .map((rowId) => store.rows.get(rowId))
            .filter((row): row is TRow => row !== undefined);

        const shape: TreeShapeOptions<TRow> = {
            getRowId,
            getChildren: (row) =>
                (store.childIds.get(getRowId(row)) ?? [])
                    .map((childId) => store.rows.get(childId))
                    .filter((child): child is TRow => child !== undefined),
            hasChildren: (row) => {
                const rowId = getRowId(row);
                if ((store.childIds.get(rowId)?.length ?? 0) > 0) return true;
                if (loadedRowIds.has(rowId)) return false;
                return options.hasChildren?.(row) ?? false;
            },
            ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
        };

        index = buildTreeIndex(roots, shape);

        if (firstBuild) {
            firstBuild = false;
            const depth = options.defaultExpandedDepth ?? 0;
            if (depth > 0) {
                for (const node of index.nodes) {
                    if (node.depth < depth && node.hasChildren) expanded.add(node.nodeId);
                }
            }
        }

        // An expanded id whose node no longer exists would otherwise accumulate forever as the
        // data changes underneath a long-lived grid.
        for (const nodeId of [...expanded]) {
            if (!index.byNodeId.has(nodeId)) expanded.delete(nodeId);
        }
    }

    function emptyIndex(): TreeIndex<TRow> {
        return {
            nodes: [],
            byNodeId: new Map(),
            placementsByRowId: new Map(),
            rootNodeIds: [],
            maxDepth: 0,
            cyclicNodeIds: [],
            hasMultipleParents: false,
        };
    }

    function snapshot(): Store<TRow> {
        return {
            rows: new Map(store.rows),
            childIds: new Map([...store.childIds].map(([key, value]) => [key, [...value]])),
        };
    }

    // ------------------------------------------------------------------------------------------
    // Lazy children
    // ------------------------------------------------------------------------------------------

    function loadChildrenFor(node: TreeNode<TRow>): void {
        if (!options.loadChildren || destroyed) return;

        // Only a node that declared children and has none present. Without this, expanding a node
        // whose children are already in the data fetches an empty list and replaces them with it.
        if (node.loadState !== 'unloaded' || node.childNodeIds.length > 0) return;

        const { rowId } = node;
        if (loadedRowIds.has(rowId) || loadingRowIds.has(rowId)) return;

        const controller = new AbortController();
        inFlight.set(rowId, controller);
        loadingRowIds.add(rowId);
        loadErrors.delete(rowId);
        notify();

        void Promise.resolve(
            options.loadChildren({ row: node.row, rowId, node, signal: controller.signal }),
        ).then(
            (children) => {
                inFlight.delete(rowId);
                loadingRowIds.delete(rowId);
                if (destroyed || controller.signal.aborted) return;

                loadedRowIds.add(rowId);
                const childIds: RowId[] = [];
                for (const child of children) {
                    const childId = getRowId(child);
                    store.rows.set(childId, child);
                    childIds.push(childId);
                }
                store.childIds.set(rowId, childIds);

                rebuild();
                notify();
            },
            (error: unknown) => {
                inFlight.delete(rowId);
                loadingRowIds.delete(rowId);
                if (destroyed || controller.signal.aborted) return;

                // The node stays expanded and shows the failure, so the reader can retry by
                // collapsing and expanding rather than reloading the page.
                loadErrors.set(rowId, toGridError(error));
                notify();
            },
        );
    }

    // ------------------------------------------------------------------------------------------
    // Mutation, optimistic with rollback
    // ------------------------------------------------------------------------------------------

    async function commit(change: TreeChange<TRow>, restore: Store<TRow>): Promise<void> {
        const { rowId } = change;
        commitErrors.delete(rowId);

        if (!options.onCommit) {
            notify();
            return;
        }

        pendingRowIds.add(rowId);
        notify();

        try {
            await options.onCommit(change);
        } catch (error) {
            // Put the tree back exactly as it was. A half-applied move is worse than a refused
            // one, because the reader cannot tell which half survived.
            store = restore;
            rebuild();
            commitErrors.set(rowId, toGridError(error));
        } finally {
            pendingRowIds.delete(rowId);
            notify();
        }
    }

    function detach(parentId: RowId | null, rowId: RowId): void {
        const bucket = store.childIds.get(parentId);
        if (!bucket) return;
        const position = bucket.indexOf(rowId);
        if (position !== -1) bucket.splice(position, 1);
    }

    /** Resolves a target into the parent row id and the index within that parent's child list. */
    function resolveTarget(target: TreeTarget): { parentRowId: RowId | null; index: number } {
        if (target.referenceNodeId === undefined) {
            const roots = store.childIds.get(null) ?? [];
            return { parentRowId: null, index: roots.length };
        }

        const reference = index.byNodeId.get(target.referenceNodeId);
        if (!reference) {
            const roots = store.childIds.get(null) ?? [];
            return { parentRowId: null, index: roots.length };
        }

        if (target.position === 'child') {
            const children = store.childIds.get(reference.rowId) ?? [];
            return { parentRowId: reference.rowId, index: children.length };
        }

        const parentNode = reference.parentNodeId ? index.byNodeId.get(reference.parentNodeId) : null;
        const parentRowId = parentNode?.rowId ?? null;
        const siblings = store.childIds.get(parentRowId) ?? [];
        const at = siblings.indexOf(reference.rowId);
        const offset = target.position === 'after' ? 1 : 0;

        return { parentRowId, index: at === -1 ? siblings.length : at + offset };
    }

    // ------------------------------------------------------------------------------------------
    // Public surface
    // ------------------------------------------------------------------------------------------

    const controller: TreeController<TRow> = {
        getIndex: () => index,

        setRows(rows) {
            store = normalise(rows);
            // Children fetched lazily are not in the incoming rows, so they are re-attached.
            for (const rowId of loadedRowIds) {
                if (!store.childIds.has(rowId)) continue;
            }
            rebuild();
            notify();
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        isExpanded: (nodeId) => expanded.has(nodeId),

        expand(nodeId) {
            const node = index.byNodeId.get(nodeId);
            if (!node || !node.hasChildren || node.cyclic || expanded.has(nodeId)) return;

            expanded.add(nodeId);
            options.onExpandedChange?.([...expanded]);
            loadChildrenFor(node);
            notify();
        },

        collapse(nodeId) {
            if (!expanded.delete(nodeId)) return;
            options.onExpandedChange?.([...expanded]);
            notify();
        },

        toggle(nodeId) {
            if (expanded.has(nodeId)) controller.collapse(nodeId);
            else controller.expand(nodeId);
        },

        expandAll(toDepth) {
            const limit = toDepth ?? Number.POSITIVE_INFINITY;
            for (const node of index.nodes) {
                if (node.depth < limit && node.hasChildren && !node.cyclic) expanded.add(node.nodeId);
            }
            options.onExpandedChange?.([...expanded]);
            notify();
        },

        collapseAll() {
            expanded.clear();
            options.onExpandedChange?.([]);
            notify();
        },

        getExpandedNodeIds: () => [...expanded],

        setExpandedNodeIds(nodeIds) {
            expanded = new Set(nodeIds);
            notify();
        },

        getNodeState(nodeId) {
            const node = index.byNodeId.get(nodeId);
            const rowId = node?.rowId;

            const loadState: TreeLoadState = !node
                ? 'idle'
                : rowId !== undefined && loadingRowIds.has(rowId)
                  ? 'loading'
                  : rowId !== undefined && loadErrors.has(rowId)
                    ? 'error'
                    : node.loadState;

            return {
                expanded: expanded.has(nodeId),
                loadState,
                pending: rowId !== undefined && pendingRowIds.has(rowId),
                error:
                    rowId === undefined
                        ? null
                        : commitErrors.get(rowId) ?? loadErrors.get(rowId) ?? null,
            };
        },

        async updateRow(rowId, patch) {
            const previous = store.rows.get(rowId);
            if (previous === undefined) return;

            const restore = snapshot();
            const row = { ...previous, ...patch } as TRow;
            store.rows.set(rowId, row);
            rebuild();

            await commit({ type: 'update', rowId, row, previous }, restore);
        },

        async insertRow(row, target) {
            const restore = snapshot();
            const rowId = getRowId(row);
            const { parentRowId, index: at } = resolveTarget(target);

            store.rows.set(rowId, row);
            const siblings = store.childIds.get(parentRowId) ?? [];
            siblings.splice(at, 0, rowId);
            store.childIds.set(parentRowId, siblings);

            // Inserting into a collapsed parent hides the new row, which reads as the insert
            // having failed.
            if (target.referenceNodeId && target.position === 'child') {
                expanded.add(target.referenceNodeId);
            }

            rebuild();
            await commit({ type: 'insert', rowId, row, parentRowId, index: at }, restore);
        },

        async moveNode(nodeId, target) {
            const node = index.byNodeId.get(nodeId);
            if (!node) return;

            const reference = target.referenceNodeId
                ? index.byNodeId.get(target.referenceNodeId)
                : undefined;

            // Moving a node inside its own subtree would detach that subtree from the tree
            // entirely, and the rows would vanish rather than move.
            if (reference && (reference.rowPath.includes(node.rowId) || reference.nodeId === nodeId)) {
                return;
            }

            const restore = snapshot();
            const parentNode = node.parentNodeId ? index.byNodeId.get(node.parentNodeId) : null;
            const fromParentRowId = parentNode?.rowId ?? null;

            detach(fromParentRowId, node.rowId);

            const { parentRowId, index: at } = resolveTarget(target);
            const siblings = store.childIds.get(parentRowId) ?? [];
            siblings.splice(Math.min(at, siblings.length), 0, node.rowId);
            store.childIds.set(parentRowId, siblings);

            if (target.referenceNodeId && target.position === 'child') {
                expanded.add(target.referenceNodeId);
            }

            rebuild();
            await commit(
                {
                    type: 'move',
                    rowId: node.rowId,
                    fromParentRowId,
                    toParentRowId: parentRowId,
                    index: at,
                },
                restore,
            );
        },

        async removeNode(nodeId, removeOptions) {
            const node = index.byNodeId.get(nodeId);
            if (!node) return;

            const restore = snapshot();
            const scope = removeOptions?.scope ?? 'row';
            const parentNode = node.parentNodeId ? index.byNodeId.get(node.parentNodeId) : null;
            const parentRowId = parentNode?.rowId ?? null;

            if (scope === 'placement') {
                // Removes the edge, not the row. With several parents that is the difference
                // between taking a file out of one folder and deleting it.
                detach(parentRowId, node.rowId);
            } else {
                for (const [parent, children] of store.childIds) {
                    const position = children.indexOf(node.rowId);
                    if (position !== -1) store.childIds.set(parent, children.filter((id) => id !== node.rowId));
                }
                store.rows.delete(node.rowId);
                store.childIds.delete(node.rowId);
            }

            rebuild();
            await commit(
                { type: 'remove', rowId: node.rowId, row: node.row, parentRowId, scope },
                restore,
            );
        },

        destroy() {
            destroyed = true;
            for (const controllerInFlight of inFlight.values()) controllerInFlight.abort();
            inFlight.clear();
            listeners.clear();
        },
    };

    return controller;
}
