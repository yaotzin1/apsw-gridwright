import type { GridRow } from '../../core/types';
import type { TreeNode } from '../../tree/types';

/**
 * The consumer's own row, whether or not the grid is a tree.
 *
 * A tree grid's rows are `TreeNode`s, because a node is what carries the interval, the depth and
 * the placement identity, and two placements of one row need two grid rows. Anything written
 * against rows rather than placements, a row action or a click handler, wants the row inside.
 *
 * It is a runtime check rather than a type test because the same handler is expected to work on
 * both: `tree` is an option on the grid, so a menu written for a flat grid keeps working when the
 * tree is switched on, which is the whole point of the option being a switch.
 */
export function rowDataOf<TRow>(row: GridRow<TRow> | GridRow<TreeNode<TRow>>): TRow {
    const data = row.data as TRow | TreeNode<TRow>;
    return isTreeNode<TRow>(data) ? data.row : data;
}

function isTreeNode<TRow>(value: TRow | TreeNode<TRow>): value is TreeNode<TRow> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'nodeId' in value &&
        'rowId' in value &&
        'row' in value
    );
}
