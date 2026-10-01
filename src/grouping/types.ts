import type { ColumnValue, RowId } from '../core/types';

/** Identity of one group, stable across renders so expansion state survives a re-sort. */
export type GroupId = string;

/** A row the grouping stage inserts: a header summarising the rows beneath it. */
export interface GroupHeaderRow {
    readonly kind: 'group';
    readonly groupId: GroupId;
    /** Which `groupBy` column this level groups by. */
    readonly columnId: string;
    /** The raw value every row in this group shares. */
    readonly value: unknown;
    /** The value, formatted the way the column already formats it, for the group's title. */
    readonly key: string;
    /** Zero-based nesting depth: the first `groupBy` column is 0. */
    readonly depth: number;
    /** Rows under this group, however deep. */
    readonly count: number;
    readonly aggregates: Readonly<Record<string, unknown>>;
    readonly expanded: boolean;
}

/** A row grouping did not replace: your row, wrapped so the engine can sit it beside group headers. */
export interface GroupMemberRow<TRow> {
    readonly kind: 'row';
    readonly row: TRow;
    readonly rowId: RowId;
    /** How many `groupBy` levels are above this row. Matches the deepest group header's depth + 1. */
    readonly depth: number;
}

/** What the grouping plugin's stage emits in place of flat rows. */
export type GroupedRow<TRow> = GroupHeaderRow | GroupMemberRow<TRow>;

export type BuiltinAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** A custom aggregate: whatever a group's cells and its rows reduce to. */
export type AggregateAccumulator<TRow, TValue = ColumnValue> = (
    values: readonly TValue[],
    rows: readonly TRow[],
) => unknown;

export type AggregateSpecFn<TRow, TValue = ColumnValue> = BuiltinAggregate | AggregateAccumulator<TRow, TValue>;

/** One column's aggregate, as the plugin needs it: a column id and how to reduce it. */
export interface GroupAggregateSpec<TRow> {
    readonly columnId: string;
    readonly fn: AggregateSpecFn<TRow, ColumnValue>;
}
