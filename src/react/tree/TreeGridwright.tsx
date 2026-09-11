import { Gridwright } from '../Gridwright';
import type { GridTreeOptions, GridwrightProps } from '../types';

export type TreeGridwrightProps<TRow> = Omit<GridwrightProps<TRow>, 'tree'> & GridTreeOptions<TRow>;

/**
 * A tree grid.
 *
 * Kept as a name because a tree is a common enough starting point to deserve one, but it is
 * `<Gridwright tree={...} />` and nothing else. Every option of the grid works here, and every
 * option here works on the grid: there is one implementation, not two.
 */
export function TreeGridwright<TRow>({
    getRowId,
    getChildren,
    getParentIds,
    hasChildren,
    loadChildren,
    maxDepth,
    defaultExpandedDepth,
    onCommit,
    onExpandedChange,
    treeColumnId,
    keepAncestorsOfMatches,
    controllerRef,
    ...rest
}: TreeGridwrightProps<TRow>) {
    return (
        <Gridwright<TRow>
            {...(rest as GridwrightProps<TRow>)}
            tree={{
                getRowId,
                ...(getChildren ? { getChildren } : {}),
                ...(getParentIds ? { getParentIds } : {}),
                ...(hasChildren ? { hasChildren } : {}),
                ...(loadChildren ? { loadChildren } : {}),
                ...(maxDepth !== undefined ? { maxDepth } : {}),
                ...(defaultExpandedDepth !== undefined ? { defaultExpandedDepth } : {}),
                ...(onCommit ? { onCommit } : {}),
                ...(onExpandedChange ? { onExpandedChange } : {}),
                ...(treeColumnId ? { treeColumnId } : {}),
                ...(keepAncestorsOfMatches !== undefined ? { keepAncestorsOfMatches } : {}),
                ...(controllerRef ? { controllerRef } : {}),
            }}
        />
    );
}
