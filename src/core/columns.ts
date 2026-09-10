import type { ColumnDef, ColumnValue, ResolvedColumn } from './types';
import { toText } from './values';

/**
 * Turns author-facing column definitions into the fully defaulted form the engine and every
 * adapter read.
 *
 * Resolution happens once per `setColumns` call, not once per row: `getValue` is closed over the
 * accessor here so the hot path is a function call rather than a branch on the accessor shape.
 */
export function resolveColumns<TRow>(
    columns: readonly ColumnDef<TRow, ColumnValue>[],
): readonly ResolvedColumn<TRow, ColumnValue>[] {
    const seen = new Set<string>();

    return columns.map((column, index) => {
        if (!column.id) {
            throw new Error(`[gridwright] column at index ${index} has no id`);
        }
        if (seen.has(column.id)) {
            // Duplicate ids make sort and filter state ambiguous, and the symptom (a filter that
            // applies to the wrong column) is far harder to read than this message.
            throw new Error(`[gridwright] duplicate column id "${column.id}"`);
        }
        seen.add(column.id);

        const accessor = column.accessor;
        const getValue = ((row: TRow): never => {
            if (typeof accessor === 'function') {
                return (accessor as (value: TRow) => never)(row);
            }
            const key = (accessor ?? column.id) as keyof TRow;
            return (row as Record<string, unknown>)[key as string] as never;
        }) as (row: TRow) => never;

        const formatValue = column.formatValue;
        const getText = (row: TRow): string => {
            const value = getValue(row);
            return formatValue ? formatValue(value, row) : toText(value);
        };

        return {
            ...column,
            index,
            header: column.header ?? column.id,
            sortable: column.sortable ?? true,
            filterable: column.filterable ?? true,
            searchable: column.searchable ?? true,
            hidden: column.hidden ?? false,
            getValue,
            getText,
        } satisfies ResolvedColumn<TRow, ColumnValue>;
    });
}

export function findColumn<TRow>(
    columns: readonly ResolvedColumn<TRow, ColumnValue>[],
    columnId: string,
): ResolvedColumn<TRow, ColumnValue> | undefined {
    return columns.find((column) => column.id === columnId);
}

/** The columns an adapter should render, in order. */
export function visibleColumns<TRow>(
    columns: readonly ResolvedColumn<TRow, ColumnValue>[],
): readonly ResolvedColumn<TRow, ColumnValue>[] {
    return columns.filter((column) => !column.hidden);
}
