import { STAGE_ORDER } from '../core/pipeline';
import { compareValues, matchesFilter } from '../core/values';
import type {
    ColumnValue,
    DataSource,
    DataSourceRequest,
    DataSourceResult,
    GridPlugin,
    GridQuery,
    ResolvedColumn,
    RowId,
    Unsubscribe,
} from '../core/types';
import { paginationPlugin } from '../plugins/pagination';
import type { TreeController } from './controller';
import type { NodeId, TreeNode } from './types';

export const TREE_STAGE_ID = 'core:tree';

const isThenable = (value: unknown): value is Promise<unknown> =>
    typeof (value as { then?: unknown } | null)?.then === 'function';

/**
 * Wraps a data source so the grid's rows become tree nodes.
 *
 * The underlying source keeps answering in whatever shape it already does. This turns each answer
 * into a nested set through the controller, and hands the engine the nodes. Everything downstream
 * then works on nodes, which is what lets one row appear twice without two grid rows sharing an id.
 */
export function createTreeDataSource<TRow>(
    source: DataSource<TRow>,
    controller: TreeController<TRow>,
): DataSource<TreeNode<TRow>> {
    return {
        kind: `tree:${source.kind}`,
        capabilities: source.capabilities,

        fetch(request: DataSourceRequest<TreeNode<TRow>>) {
            // Column ids are identical on both sides of the wrapper, and a source that reads
            // columns only reads their ids, so the cast is safe and avoids duplicating the set.
            const inner = request as unknown as DataSourceRequest<TRow>;

            const toNodes = (result: DataSourceResult<TRow>): DataSourceResult<TreeNode<TRow>> => {
                controller.setRows(result.rows);
                const index = controller.getIndex();

                return {
                    rows: index.nodes,
                    // A placeholder. The tree stage replaces it with the count of visible nodes,
                    // which is the number the page controls have to describe.
                    totalRows: index.nodes.length,
                    ...(result.meta ? { meta: result.meta } : {}),
                };
            };

            // Deliberately not an async function. An array answers synchronously, the engine
            // detects that and skips the loading state, and wrapping it in a promise here would
            // make every tree over in-memory data flash a spinner it never needed.
            const result = source.fetch(inner);
            return isThenable(result) ? result.then(toNodes) : toNodes(result);
        },

        subscribe(onInvalidate: () => void): Unsubscribe {
            return source.subscribe?.(onInvalidate) ?? (() => undefined);
        },

        dispose() {
            source.dispose?.();
        },
    };
}

export interface TreePluginOptions<TRow> {
    readonly controller: TreeController<TRow>;
    /**
     * Keep a non-matching row whose descendant matches. Default true.
     *
     * Without it, filtering a tree returns matches with no context: a file with no folder above
     * it. The ancestors are shown and marked, not counted as matches.
     */
    readonly keepAncestorsOfMatches?: boolean;
}

/**
 * Filters, sorts and flattens the tree into the rows the grid renders.
 *
 * It replaces the filter, search and sort stages rather than joining them, because all three are
 * different operations on a tree. Filtering a flat list removes rows; filtering a tree has to keep
 * the ancestors of a match or the match has no context. Sorting a flat list orders everything;
 * sorting a tree orders siblings within each parent and nothing else.
 *
 * It still honours the data source's capabilities: a facet the server resolved is not redone here.
 */
export function treePlugin<TRow>(options: TreePluginOptions<TRow>): GridPlugin<TreeNode<TRow>> {
    const { controller } = options;
    const keepAncestors = options.keepAncestorsOfMatches ?? true;

    return {
        name: 'gridwright:tree',
        setup(context) {
            const stopListening = controller.subscribe(() => {
                // Expansion and lazy children change what is visible, not what was fetched, so the
                // pipeline is recomputed rather than the source asked again.
                context.api.invalidatePipeline();
            });

            const removeStage = context.registerStage({
                id: TREE_STAGE_ID,
                order: STAGE_ORDER.TRANSFORM,
                run(_nodes, pipeline) {
                    // The controller's index, not the rows handed in. A lazy load or an edit
                    // rebuilds the index without a fetch, so the engine's cached rows are a
                    // snapshot of the tree as it was one mutation ago.
                    const visible = flatten(
                        controller.getIndex().nodes,
                        pipeline.query,
                        pipeline.columns as readonly ResolvedColumn<TreeNode<TRow>, ColumnValue>[],
                        pipeline.capabilities,
                        controller,
                        keepAncestors,
                    );
                    return { rows: visible, totalRows: visible.length };
                },
            });

            return () => {
                removeStage();
                stopListening();
            };
        },
    };
}

/** The plugin set a tree grid installs: the tree stage, then pagination over what it produced. */
export function treePlugins<TRow>(
    options: TreePluginOptions<TRow>,
): readonly GridPlugin<TreeNode<TRow>>[] {
    return [treePlugin(options), paginationPlugin<TreeNode<TRow>>()];
}

interface Capabilities {
    readonly sort: boolean;
    readonly filter: boolean;
    readonly search: boolean;
}

function flatten<TRow>(
    nodes: readonly TreeNode<TRow>[],
    query: GridQuery,
    columns: readonly ResolvedColumn<TreeNode<TRow>, ColumnValue>[],
    capabilities: Capabilities,
    controller: TreeController<TRow>,
    keepAncestors: boolean,
): readonly TreeNode<TRow>[] {
    const byNodeId = new Map<NodeId, TreeNode<TRow>>();
    const childrenOf = new Map<NodeId | null, TreeNode<TRow>[]>();

    for (const node of nodes) {
        byNodeId.set(node.nodeId, node);
        const bucket = childrenOf.get(node.parentNodeId);
        if (bucket) bucket.push(node);
        else childrenOf.set(node.parentNodeId, [node]);
    }

    const filtering = !capabilities.filter && query.filters.length > 0;
    const searching = !capabilities.search && query.search.trim() !== '';
    const narrowing = filtering || searching;

    let keep: Set<NodeId> | null = null;
    if (narrowing) {
        const matched = new Set<NodeId>();
        for (const node of nodes) {
            if (matches(node, query, columns, filtering, searching)) matched.add(node.nodeId);
        }

        keep = new Set(matched);
        if (keepAncestors) {
            for (const nodeId of matched) {
                let parent = byNodeId.get(nodeId)?.parentNodeId ?? null;
                while (parent !== null && !keep.has(parent)) {
                    keep.add(parent);
                    parent = byNodeId.get(parent)?.parentNodeId ?? null;
                }
            }
        }
    }

    if (!capabilities.sort && query.sort.length > 0) {
        const plan = query.sort
            .map((spec) => ({
                column: columns.find((entry) => entry.id === spec.columnId),
                direction: spec.direction === 'desc' ? -1 : 1,
            }))
            .filter((entry): entry is { column: ResolvedColumn<TreeNode<TRow>, ColumnValue>; direction: number } =>
                entry.column !== undefined && entry.column.sortable,
            );

        if (plan.length > 0) {
            // Siblings only. Ordering the whole flat list would break the nesting it is drawn from.
            for (const [, siblings] of childrenOf) {
                siblings.sort((left, right) => {
                    for (const { column, direction } of plan) {
                        const a = column.getValue(left);
                        const b = column.getValue(right);
                        const result = column.comparator
                            ? column.comparator(a, b, left, right)
                            : compareValues(a, b);
                        if (result !== 0) return result * direction;
                    }
                    return 0;
                });
            }
        }
    }

    const output: TreeNode<TRow>[] = [];

    const walk = (parentNodeId: NodeId | null): void => {
        for (const node of childrenOf.get(parentNodeId) ?? []) {
            if (keep !== null && !keep.has(node.nodeId)) continue;

            output.push(node);

            // While narrowing, an ancestor is opened whether or not the reader opened it, or the
            // matches it was kept for stay hidden underneath it.
            const open = narrowing ? true : controller.isExpanded(node.nodeId);
            if (open && node.hasChildren && !node.cyclic) walk(node.nodeId);
        }
    };

    walk(null);
    return output;
}

function matches<TRow>(
    node: TreeNode<TRow>,
    query: GridQuery,
    columns: readonly ResolvedColumn<TreeNode<TRow>, ColumnValue>[],
    filtering: boolean,
    searching: boolean,
): boolean {
    if (filtering) {
        for (const filter of query.filters) {
            const column = columns.find((entry) => entry.id === filter.columnId);
            if (!column || !column.filterable) continue;

            const value = column.getValue(node);
            const ok = column.filterFn ? column.filterFn(value, filter, node) : matchesFilter(value, filter);
            if (!ok) return false;
        }
    }

    if (searching) {
        const term = query.search.trim().toLowerCase();
        const hit = columns.some(
            (column) => column.searchable && column.getText(node).toLowerCase().includes(term),
        );
        if (!hit) return false;
    }

    return true;
}

/** Row ids of every node currently kept, for a consumer wiring their own selection semantics. */
export function rowIdsOf<TRow>(nodes: readonly TreeNode<TRow>[]): readonly RowId[] {
    return [...new Set(nodes.map((node) => node.rowId))];
}
