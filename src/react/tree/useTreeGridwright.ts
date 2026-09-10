import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocalDataSource } from '../../data/local';
import { createTreeController } from '../../tree/controller';
import { createTreeDataSource, treePlugins } from '../../tree/plugin';
import type {
    LoadChildrenContext,
    TreeChange,
    TreeController,
    TreeControllerOptions,
} from '../../tree/controller';
import type { NodeId, TreeNode } from '../../tree/types';
import type { ColumnValue, DataSource, RowId } from '../../core/types';
import { useGridwright } from '../useGridwright';
import type { GridwrightColumn, GridwrightInstance, UseGridwrightOptions } from '../types';
import { reactTreeColumns } from './TreeCell';

export interface UseTreeGridwrightOptions<TRow>
    extends Omit<UseGridwrightOptions<TRow>, 'columns' | 'data' | 'dataSource' | 'getRowId' | 'plugins'>,
        Omit<TreeControllerOptions<TRow>, 'getRowId'> {
    readonly columns: readonly GridwrightColumn<TRow, ColumnValue>[];
    readonly data?: readonly TRow[];
    readonly dataSource?: DataSource<TRow>;
    /** Identity of the row. Every placement of it shares this. */
    readonly getRowId: (row: TRow) => RowId;
    /** Which column carries the indentation and the toggle. Default: the first visible one. */
    readonly treeColumnId?: string;
    /** Keep a non-matching row whose descendant matches while filtering. Default true. */
    readonly keepAncestorsOfMatches?: boolean;
}

export interface TreeGridwrightInstance<TRow> extends GridwrightInstance<TreeNode<TRow>> {
    readonly tree: TreeController<TRow>;
    readonly treeColumnId: string | null;
    /** The wrapped columns, so a hand-composed layout passes the same set the engine resolved. */
    readonly gridColumns: readonly GridwrightColumn<TreeNode<TRow>, ColumnValue>[];
}

/**
 * A grid whose rows are tree nodes.
 *
 * The grid's row type becomes `TreeNode<TRow>`, because a node is what carries the interval, the
 * depth and the placement identity, and because two placements of one row need two grid rows with
 * two different ids. Your columns and renderers keep receiving your row: the wrapping happens here
 * so that decision does not leak into every column definition.
 */
export function useTreeGridwright<TRow>(
    options: UseTreeGridwrightOptions<TRow>,
): TreeGridwrightInstance<TRow> {
    if (options.data !== undefined && options.dataSource !== undefined) {
        throw new Error(
            '[gridwright] pass either `data` for an in-memory tree or `dataSource` for anything else, not both.',
        );
    }

    const latest = useRef(options);
    latest.current = options;

    // One controller for the life of the hook. It owns expansion, loaded children and pending
    // edits, and the plugin holds a reference to it, so it is never rebuilt. Both shape callbacks
    // are always supplied and `mode` decides between them on every normalise.
    const [controller] = useState<TreeController<TRow>>(() =>
        createTreeController<TRow>({
            getRowId: (row) => latest.current.getRowId(row),
            mode: () => (latest.current.getParentIds ? 'parents' : 'nested'),
            getChildren: (row: TRow) => latest.current.getChildren?.(row),
            getParentIds: (row: TRow) => latest.current.getParentIds?.(row),
            hasChildren: (row: TRow) => latest.current.hasChildren?.(row) ?? false,
            loadChildren: (context: LoadChildrenContext<TRow>) =>
                latest.current.loadChildren
                    ? latest.current.loadChildren(context)
                    : Promise.resolve([]),
            ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
            ...(options.defaultExpandedDepth !== undefined
                ? { defaultExpandedDepth: options.defaultExpandedDepth }
                : {}),
            onCommit: (change: TreeChange<TRow>) => latest.current.onCommit?.(change),
            onExpandedChange: (ids: readonly NodeId[]) => latest.current.onExpandedChange?.(ids),
        }),
    );

    useEffect(() => () => controller.destroy(), [controller]);

    const ownedSource = useRef<ReturnType<typeof createLocalDataSource<TRow>> | null>(null);
    const inner: DataSource<TRow> = useMemo(() => {
        if (options.dataSource) return options.dataSource;
        ownedSource.current ??= createLocalDataSource<TRow>(options.data ?? []);
        return ownedSource.current;
    }, [options.dataSource, options.data]);

    useEffect(() => {
        if (options.data === undefined) return;
        const source = ownedSource.current;
        if (!source || source.getRows() === options.data) return;
        source.setRows(options.data);
    }, [options.data]);

    const dataSource = useMemo(() => createTreeDataSource(inner, controller), [inner, controller]);

    const treeColumnId =
        options.treeColumnId ?? options.columns.find((column) => !column.hidden)?.id ?? null;

    const columnSignature = options.columns.map((column) => column.id).join('|');
    const columns = useMemo(
        () => reactTreeColumns(latest.current.columns, treeColumnId),
        // Renderers are read from props at render time, so only the shape matters here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columnSignature, treeColumnId],
    );

    const plugins = useMemo(
        () =>
            treePlugins<TRow>({
                controller,
                ...(options.keepAncestorsOfMatches !== undefined
                    ? { keepAncestorsOfMatches: options.keepAncestorsOfMatches }
                    : {}),
            }),
        [controller, options.keepAncestorsOfMatches],
    );

    const instance = useGridwright<TreeNode<TRow>>({
        columns,
        dataSource,
        plugins,
        getRowId: (node) => node.nodeId,
        ...(options.initialQuery ? { initialQuery: options.initialQuery } : {}),
        ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
        ...(options.selectionMode ? { selectionMode: options.selectionMode } : {}),
        ...(options.keepPreviousData !== undefined ? { keepPreviousData: options.keepPreviousData } : {}),
        ...(options.queryDebounceMs !== undefined ? { queryDebounceMs: options.queryDebounceMs } : {}),
        ...(options.onQueryChange ? { onQueryChange: options.onQueryChange } : {}),
        ...(options.onError ? { onError: options.onError } : {}),
    });

    return useMemo(
        () => ({ ...instance, tree: controller, treeColumnId, gridColumns: columns }),
        [instance, controller, treeColumnId, columns],
    );
}
