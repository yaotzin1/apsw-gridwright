import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocalDataSource } from '../../data/local';
import type { LocalDataSource } from '../../data/local';
import { createTreeController } from '../../tree/controller';
import type { LoadChildrenContext, TreeChange, TreeController } from '../../tree/controller';
import { createTreeDataSource, treePlugins } from '../../tree/plugin';
import type { NodeId, TreeNode } from '../../tree/types';
import type { DataSource, GridPlugin, RowId } from '../../core/types';
import { treeRowAria } from '../a11y/tree';
import type { GridAddon } from '../addons/types';
import type { UseGridwrightOptions } from '../types';
import { TreeProvider } from './context';
import { isTreeNode } from './rowData';
import { TREE_ADDON, treeMessages } from './messages';
import { reactTreeColumns } from './TreeCell';

/** Turns the grid into a tree. Every other add-on keeps working on top of it. */
export interface TreeDataOptions<TRow> {
    /** Stable identity of the row. Every placement of it shares this. */
    readonly getRowId: (row: TRow) => RowId;
    /** Children carried on the row. Mutually exclusive with `getParentIds`. */
    readonly getChildren?: (row: TRow) => readonly TRow[] | undefined;
    /** Parents named by the row. The only shape that can express several parents. */
    readonly getParentIds?: (row: TRow) => readonly RowId[] | RowId | null | undefined;
    /** Whether a row has children that have not been loaded. Draws a toggle before they arrive. */
    readonly hasChildren?: (row: TRow) => boolean;
    /** Fetches children on first expand, keyed on the row rather than the placement. */
    readonly loadChildren?: (context: LoadChildrenContext<TRow>) => Promise<readonly TRow[]>;
    readonly maxDepth?: number;
    readonly defaultExpandedDepth?: number;
    /** Persists an edit, an insert, a move or a removal. Omit it and changes stay in memory. */
    readonly onCommit?: (change: TreeChange<TRow>) => Promise<void> | void;
    readonly onExpandedChange?: (nodeIds: readonly string[]) => void;
    /** Which column carries the indentation and the toggle. Default: the first visible one. */
    readonly treeColumnId?: string;
    /** Keep a non-matching row whose descendant matches while filtering. Default true. */
    readonly keepAncestorsOfMatches?: boolean;
    /**
     * Receives the controller once it exists, and `null` when the grid unmounts.
     *
     * Expansion, insertion, moving and removal live on the controller. Its identity is stable for the
     * life of the grid, so this fires once rather than on every state change.
     */
    readonly controllerRef?: (controller: TreeController<TRow> | null) => void;
}

/**
 * A tree.
 *
 * The engine's rows become `TreeNode<TRow>`, because a node is what carries the interval, the depth
 * and the placement identity, and because two placements of one row need two grid rows with two
 * different ids. Your columns, renderers, `onSelectionChange` and `onRowClick` (through `rowDataOf`)
 * keep receiving your row: the wrapping happens here, so that decision does not leak into every
 * column definition.
 *
 * Placed after any add-on that wraps a cell's content, such as inline editing, so an editor renders
 * inside the tree cell rather than around its indentation.
 */
export function treeData<TRow>(options: TreeDataOptions<TRow>): GridAddon<TRow> {
    return {
        name: TREE_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useTreeDataSetup({ options: grid }) {
            return useTree(options, grid);
        },
    };
}

function useTree<TRow>(options: TreeDataOptions<TRow>, grid: UseGridwrightOptions<TRow>) {
    const latest = useRef(options);
    latest.current = options;

    // One controller for the life of the grid. It owns expansion, loaded children and pending edits,
    // and the plugin and the data source hold a reference to it, so it is never rebuilt.
    const [controller] = useState<TreeController<TRow>>(() =>
        createTreeController<TRow>({
            getRowId: (row) => latest.current.getRowId(row),
            mode: () => (latest.current.getParentIds ? 'parents' : 'nested'),
            getChildren: (row: TRow) => latest.current.getChildren?.(row),
            getParentIds: (row: TRow) => latest.current.getParentIds?.(row),
            hasChildren: (row: TRow) => latest.current.hasChildren?.(row) ?? false,
            loadChildren: (context: LoadChildrenContext<TRow>) =>
                latest.current.loadChildren ? latest.current.loadChildren(context) : Promise.resolve([]),
            ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
            ...(options.defaultExpandedDepth !== undefined ? { defaultExpandedDepth: options.defaultExpandedDepth } : {}),
            onCommit: (change: TreeChange<TRow>) => latest.current.onCommit?.(change),
            onExpandedChange: (ids: readonly NodeId[]) => latest.current.onExpandedChange?.(ids),
        }),
    );

    // Destroyed a task after unmount rather than in the cleanup itself. Strict Mode runs the cleanup
    // and the effect again at once on mount, and a controller destroyed there stops loading children
    // for good while the grid looks alive.
    useEffect(() => {
        const pending = destroyTimers.get(controller);
        if (pending !== undefined) clearTimeout(pending);
        return () => {
            destroyTimers.set(controller, setTimeout(() => controller.destroy(), 0));
        };
    }, [controller]);

    // The controller changes outside React. Expanding a node whose children are still loading changes
    // no row, but it does change `aria-expanded`, so the grid re-renders on every notification.
    const [, setRevision] = useState(0);
    useEffect(() => controller.subscribe(() => setRevision((value) => value + 1)), [controller]);

    const controllerRef = options.controllerRef;
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef(controller);
        return () => controllerRef(null);
    }, [controllerRef, controller]);

    const ownedSource = useRef<LocalDataSource<TRow> | null>(null);
    const inner: DataSource<TRow> = useMemo(() => {
        if (grid.dataSource) return grid.dataSource;
        ownedSource.current ??= createLocalDataSource<TRow>(grid.data ?? []);
        return ownedSource.current;
    }, [grid.dataSource, grid.data]);

    useEffect(() => {
        if (grid.data === undefined) return;
        const source = ownedSource.current;
        if (!source || source.getRows() === grid.data) return;
        source.setRows(grid.data);
    }, [grid.data]);

    const dataSource = useMemo(() => createTreeDataSource(inner, controller), [inner, controller]);

    const plugins = useMemo(
        () =>
            treePlugins<TRow>({
                controller,
                ...(options.keepAncestorsOfMatches !== undefined ? { keepAncestorsOfMatches: options.keepAncestorsOfMatches } : {}),
            }),
        [controller, options.keepAncestorsOfMatches],
    );

    const treeColumnId = options.treeColumnId ?? grid.columns.find((column) => !column.hidden)?.id ?? null;

    return {
        messages: treeMessages,
        // The grid is generic over your row; the engine underneath holds nodes. The casts are the one
        // place that is admitted, and every value handed back to you is unwrapped again.
        plugins: plugins as unknown as readonly GridPlugin<TRow>[],
        configure: (current: UseGridwrightOptions<TRow>): UseGridwrightOptions<TRow> => {
            const { data: _data, onSelectionChange, ...rest } = current;
            const configured: UseGridwrightOptions<TreeNode<TRow>> = {
                ...(rest as unknown as UseGridwrightOptions<TreeNode<TRow>>),
                columns: reactTreeColumns(current.columns, treeColumnId),
                dataSource,
                getRowId: (node: TreeNode<TRow>) => node.nodeId,
                ...(onSelectionChange
                    ? {
                          onSelectionChange: (ids: readonly RowId[], nodes: readonly TreeNode<TRow>[]) =>
                              onSelectionChange(ids, nodes.map((node) => node.row)),
                      }
                    : {}),
            };
            return configured as unknown as UseGridwrightOptions<TRow>;
        },
        provide: (children: React.ReactNode) => (
            <TreeProvider controller={controller} treeColumnId={treeColumnId}>
                {children}
            </TreeProvider>
        ),
        // The role is what tells a screen reader to expect `aria-level` and `aria-expanded` on the rows
        // and to offer the expand and collapse keys for them.
        tableAttributes: () => ({ role: 'treegrid' }),
        rowAttributes: (row: { data: unknown }) => (isTreeNode<TRow>(row.data as TRow) ? treeRowAria(controller, row.data as TreeNode<TRow>) : {}),
    } satisfies ReturnType<GridAddon<TRow>['setup']>;
}

const destroyTimers = new WeakMap<TreeController<unknown>, ReturnType<typeof setTimeout>>();
