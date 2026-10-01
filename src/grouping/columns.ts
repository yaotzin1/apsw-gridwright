import type { ColumnDef, ColumnValue, FilterSpec } from '../core/types';
import type { GroupedRow } from './types';

/**
 * Rewrites a column written against your row so it reads a grouped row instead.
 *
 * The grid's row type while grouping is listed is `GroupedRow<TRow>`, a union of group headers and
 * member rows. A group header carries no row of its own, so every value-reading member answers as
 * it would for an empty cell rather than throwing — the same choice `formatValue` and `exportValue`
 * make, which is what keeps a group header from breaking a plain CSV export of a grouped grid.
 */
export function groupColumn<TRow>(column: ColumnDef<TRow, ColumnValue>): ColumnDef<GroupedRow<TRow>, ColumnValue> {
    const accessor = column.accessor;

    const readRow = (grouped: GroupedRow<TRow>): TRow | undefined => (grouped.kind === 'row' ? grouped.row : undefined);

    const getValue = (grouped: GroupedRow<TRow>): ColumnValue => {
        const row = readRow(grouped);
        if (row === undefined) return undefined;
        if (typeof accessor === 'function') return (accessor as (row: TRow) => ColumnValue)(row);
        const key = (accessor ?? column.id) as keyof TRow;
        return (row as Record<string, unknown>)[key as string];
    };

    // The row-shaped members are pulled out of the spread rather than overwritten by it, or the
    // original signatures survive in the resulting type and nothing lines up.
    const { accessor: _accessor, comparator, filterFn, formatValue, exportValue, ...rest } = column;

    return {
        ...rest,
        accessor: getValue,
        ...(comparator
            ? {
                  comparator: (a: ColumnValue, b: ColumnValue, left: GroupedRow<TRow>, right: GroupedRow<TRow>) => {
                      const leftRow = readRow(left);
                      const rightRow = readRow(right);
                      return leftRow === undefined || rightRow === undefined ? 0 : comparator(a, b, leftRow, rightRow);
                  },
              }
            : {}),
        ...(filterFn
            ? {
                  filterFn: (value: ColumnValue, filter: FilterSpec, grouped: GroupedRow<TRow>) => {
                      const row = readRow(grouped);
                      return row === undefined ? true : filterFn(value, filter, row);
                  },
              }
            : {}),
        ...(formatValue
            ? {
                  formatValue: (value: ColumnValue, grouped: GroupedRow<TRow>) => {
                      const row = readRow(grouped);
                      return row === undefined ? '' : formatValue(value, row);
                  },
              }
            : {}),
        ...(exportValue
            ? {
                  exportValue: (value: ColumnValue, grouped: GroupedRow<TRow>) => {
                      const row = readRow(grouped);
                      return row === undefined ? '' : exportValue(value, row);
                  },
              }
            : {}),
    };
}

export function groupColumns<TRow>(columns: readonly ColumnDef<TRow, ColumnValue>[]): readonly ColumnDef<GroupedRow<TRow>, ColumnValue>[] {
    return columns.map((column) => groupColumn(column));
}
