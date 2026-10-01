import type { ReactNode } from 'react';
import type { ColumnValue } from '../../core/types';
import { groupColumn } from '../../grouping/columns';
import type { GroupedRow } from '../../grouping/types';
import type { CellContext, GridwrightColumn } from '../types';

/**
 * Rewrites columns for a grouped grid.
 *
 * The value-reading members (`accessor`, `comparator`, `filterFn`, `formatValue`, `exportValue`)
 * are unwrapped by the core helper, `groupColumn`. This adds the React half: `cell` and `icon`
 * receive your row, not the group header or member wrapper around it, the same way
 * `reactTreeColumns` unwraps a tree node for them. `headerCell` needs no rewriting — its context
 * carries no row.
 *
 * A group header row never actually reaches `cell` or `icon`: `renderRow` replaces its whole `<tr>`
 * before a cell would be drawn. The fallback here is only reached if that ever stops being true.
 */
export function reactGroupColumns<TRow>(columns: readonly GridwrightColumn<TRow, ColumnValue>[]): readonly GridwrightColumn<GroupedRow<TRow>, ColumnValue>[] {
    return columns.map((column) => {
        const base = groupColumn<TRow>(column) as GridwrightColumn<GroupedRow<TRow>, ColumnValue>;
        const { cell, icon } = column;

        const wrap = <TResult,>(render: (context: CellContext<TRow, ColumnValue>) => TResult, fallback: TResult) => (context: CellContext<GroupedRow<TRow>, ColumnValue>): TResult => {
            if (context.row.kind !== 'row') return fallback;
            return render({
                value: context.value,
                row: context.row.row,
                rowId: context.rowId,
                rowIndex: context.rowIndex,
                column: context.column as never,
                api: context.api as never,
            });
        };

        return {
            ...base,
            ...(cell ? { cell: wrap<ReactNode>(cell, null) } : {}),
            ...(icon ? { icon: wrap<ReactNode>(icon, undefined) } : {}),
        };
    });
}
