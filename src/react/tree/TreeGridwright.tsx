import { Gridwright } from '../Gridwright';
import type { ColumnValue } from '../../core/types';
import type { TreeNode } from '../../tree/types';
import type { GridwrightProps } from '../types';
import { TreeProvider } from './context';
import { useTreeGridwright } from './useTreeGridwright';
import type { TreeGridwrightInstance, UseTreeGridwrightOptions } from './useTreeGridwright';

export interface TreeGridwrightProps<TRow>
    extends UseTreeGridwrightOptions<TRow>,
        Omit<
            GridwrightProps<TreeNode<TRow>>,
            keyof UseTreeGridwrightOptions<TRow> | 'instance' | 'columns' | 'data' | 'dataSource' | 'getRowId'
        > {
    readonly instance?: TreeGridwrightInstance<TRow>;
}

/**
 * The assembled tree grid.
 *
 * Everything the flat component does, over a tree: search, filter, sort, select, page, translate,
 * theme. The difference is that sorting orders siblings rather than the whole list, filtering keeps
 * the ancestors of a match, and one row can appear under several parents.
 *
 * Drop to `useTreeGridwright` plus `<TreeProvider>` and the parts when this arrangement does not
 * fit. The controller it returns is the same object this renders through.
 */
export function TreeGridwright<TRow>(props: TreeGridwrightProps<TRow>) {
    return props.instance ? (
        <TreeGridwrightView {...props} instance={props.instance} />
    ) : (
        <TreeGridwrightOwned {...props} />
    );
}

function TreeGridwrightOwned<TRow>(props: TreeGridwrightProps<TRow>) {
    const instance = useTreeGridwright<TRow>(props);
    return <TreeGridwrightView {...props} instance={instance} />;
}

function TreeGridwrightView<TRow>({
    instance,
    treeColumnId: _treeColumnId,
    getRowId: _getRowId,
    getChildren: _getChildren,
    getParentIds: _getParentIds,
    hasChildren: _hasChildren,
    loadChildren: _loadChildren,
    maxDepth: _maxDepth,
    defaultExpandedDepth: _defaultExpandedDepth,
    onCommit: _onCommit,
    onExpandedChange: _onExpandedChange,
    keepAncestorsOfMatches: _keepAncestorsOfMatches,
    data: _data,
    dataSource: _dataSource,
    columns: _columns,
    ...gridProps
}: TreeGridwrightProps<TRow> & { instance: TreeGridwrightInstance<TRow> }) {
    return (
        <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
            <Gridwright<TreeNode<TRow>>
                {...(gridProps as GridwrightProps<TreeNode<TRow>>)}
                instance={instance}
                columns={instance.gridColumns}
            />
        </TreeProvider>
    );
}

export type { TreeGridwrightInstance, UseTreeGridwrightOptions };
export type { ColumnValue };
