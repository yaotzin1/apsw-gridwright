import type { TreeController } from '../../tree/controller';
import type { TreeNode } from '../../tree/types';

/** The hierarchy attributes for one row of a `treegrid`. */
export interface TreeRowAria {
    readonly 'aria-level': number;
    readonly 'aria-posinset'?: number;
    readonly 'aria-setsize'?: number;
    readonly 'aria-expanded'?: boolean;
}

/**
 * What a tree row tells a screen reader about its place in the tree.
 *
 * The indentation in `TreeCell` is padding, and padding conveys nothing: a reader hears a flat list
 * of names unless the row itself carries the depth and the sibling counts. That has always been
 * written in `TreeCell`'s comment and was never actually rendered anywhere, which is the defect
 * this repairs.
 *
 * Everything comes from the nested set the controller already holds, so the core learns nothing
 * about ARIA and the adapter asks it for nothing new.
 */
export function treeRowAria<TRow>(
    controller: TreeController<TRow>,
    node: TreeNode<TRow>,
): TreeRowAria {
    const index = controller.getIndex();
    const siblings =
        node.parentNodeId === null
            ? index.rootNodeIds
            : (index.byNodeId.get(node.parentNodeId)?.childNodeIds ?? []);

    const position = siblings.indexOf(node.nodeId);

    return {
        // ARIA levels are one-based; depth is zero at the roots.
        'aria-level': node.depth + 1,
        // A node the index cannot place among its siblings gets neither attribute rather than a
        // guessed one. "Item 0 of 0" is worse than silence, and it is what an unguarded indexOf
        // produces for a placement that has just been removed.
        ...(position >= 0 ? { 'aria-posinset': position + 1, 'aria-setsize': siblings.length } : {}),
        // A cyclic node has children in the data and can never be expanded, so it is a leaf as far
        // as a reader is concerned. `TreeCell` already says as much in words.
        ...(node.hasChildren && !node.cyclic
            ? { 'aria-expanded': controller.isExpanded(node.nodeId) }
            : {}),
    };
}
