import type { ColumnDef, ColumnValue, FilterSpec } from '../core/types';
import type { TreeNode } from './types';

/**
 * Rewrites a column written against your row so it reads a tree node instead.
 *
 * The grid's row type in tree mode is `TreeNode<TRow>`, because a node is what carries the
 * interval, the depth and the placement identity. Asking every consumer to write
 * `accessor: (node) => node.row.name` would leak that decision into every column definition, so it
 * is unwrapped here once instead.
 */
export function treeColumn<TRow>(
    column: ColumnDef<TRow, ColumnValue>,
): ColumnDef<TreeNode<TRow>, ColumnValue> {
    const accessor = column.accessor;

    const getValue = (node: TreeNode<TRow>): ColumnValue => {
        if (typeof accessor === 'function') return (accessor as (row: TRow) => ColumnValue)(node.row);
        const key = (accessor ?? column.id) as keyof TRow;
        return (node.row as Record<string, unknown>)[key as string];
    };

    // The four row-shaped members are pulled out of the spread rather than overwritten by it, or
    // the original signatures survive in the resulting type and nothing lines up.
    const { accessor: _accessor, comparator, filterFn, formatValue, ...rest } = column;

    return {
        ...rest,
        accessor: getValue,
        ...(comparator
            ? {
                  comparator: (a: ColumnValue, b: ColumnValue, left: TreeNode<TRow>, right: TreeNode<TRow>) =>
                      comparator(a, b, left.row, right.row),
              }
            : {}),
        ...(filterFn
            ? {
                  filterFn: (value: ColumnValue, filter: FilterSpec, node: TreeNode<TRow>) =>
                      filterFn(value, filter, node.row),
              }
            : {}),
        ...(formatValue
            ? {
                  formatValue: (value: ColumnValue, node: TreeNode<TRow>) =>
                      formatValue(value, node.row),
              }
            : {}),
    };
}

export function treeColumns<TRow>(
    columns: readonly ColumnDef<TRow, ColumnValue>[],
): readonly ColumnDef<TreeNode<TRow>, ColumnValue>[] {
    return columns.map((column) => treeColumn(column));
}
