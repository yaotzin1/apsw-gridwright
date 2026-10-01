import type { GridRow } from '../../core/types';
import type { GroupMemberRow } from '../../grouping/types';
import type { TreeNode } from '../../tree/types';

/**
 * The consumer's own row, whether or not the grid is a tree.
 *
 * A tree grid's rows are `TreeNode`s, because a node is what carries the interval, the depth and
 * the placement identity, and two placements of one row need two grid rows. Anything written
 * against rows rather than placements, a row action or a click handler, wants the row inside.
 *
 * The same under `grouping()`, where a grid row holds a member wrapper around your row. A group
 * header is not one of your rows and is returned as it is: the header draws its own `<tr>`, so no
 * cell renderer, row attribute or row action is ever asked about one.
 *
 * It is a runtime check rather than a type test because the same handler is expected to work on
 * both: `tree` is an option on the grid, so a menu written for a flat grid keeps working when the
 * tree is switched on, which is the whole point of the option being a switch.
 */
export function rowDataOf<TRow>(row: GridRow<TRow> | GridRow<TreeNode<TRow>> | GridRow<GroupMemberRow<TRow>>): TRow {
    const data = row.data as TRow | TreeNode<TRow> | GroupMemberRow<TRow>;
    if (isTreeNode<TRow>(data as TRow | TreeNode<TRow>)) return (data as TreeNode<TRow>).row;
    return isGroupMember<TRow>(data) ? data.row : (data as TRow);
}

/**
 * Whether this grid row is a group header drawn by `grouping()`.
 *
 * Internal, like `isTreeNode`: a header spans the row with one cell, so a cursor that visits cells
 * has nothing to land on there.
 */
export function isGroupHeaderRow(row: { readonly data: unknown }): boolean {
    const data = row.data;
    return typeof data === 'object' && data !== null && (data as { kind?: unknown }).kind === 'group' && 'groupId' in data;
}

/** Whether this grid row is a member of a group: your row, wrapped by `grouping()`. */
function isGroupMember<TRow>(value: unknown): value is GroupMemberRow<TRow> {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { kind?: unknown }).kind === 'row' &&
        'row' in value &&
        'rowId' in value &&
        'depth' in value
    );
}

/**
 * Whether this grid row is a tree placement.
 *
 * Internal to the adapter and deliberately not exported from the package: it is a duck type, and
 * a duck type in the public surface is a promise about the shape of a row that this package is not
 * in a position to keep.
 */
export function isTreeNode<TRow>(value: TRow | TreeNode<TRow>): value is TreeNode<TRow> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'nodeId' in value &&
        'rowId' in value &&
        'row' in value
    );
}
