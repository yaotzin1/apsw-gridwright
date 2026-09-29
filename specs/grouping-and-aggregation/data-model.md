# Data model: row grouping and aggregation

## Types added

```ts
export type GroupId = string;

export interface GroupHeaderRow {
    readonly kind: 'group';
    readonly groupId: GroupId;
    readonly columnId: string;
    readonly value: unknown;
    readonly key: string;
    readonly depth: number;
    readonly count: number;
    readonly aggregates: Readonly<Record<string, unknown>>;
    readonly expanded: boolean;
}

export interface GroupMemberRow<TRow> {
    readonly kind: 'row';
    readonly row: TRow;
    readonly rowId: RowId;
    readonly depth: number;
}

export type GroupedRow<TRow> = GroupHeaderRow | GroupMemberRow<TRow>;

export type BuiltinAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type AggregateAccumulator<TRow, TValue = ColumnValue> = (values: readonly TValue[], rows: readonly TRow[]) => unknown;
export type AggregateSpecFn<TRow, TValue = ColumnValue> = BuiltinAggregate | AggregateAccumulator<TRow, TValue>;

export interface GroupAggregateSpec<TRow> {
    readonly columnId: string;
    readonly fn: AggregateSpecFn<TRow, ColumnValue>;
}
```

`GroupHeaderRow` carries no `TRow`: a group header is not one of your rows, and nothing about it
reads your row's shape. This is why it has no generic parameter, unlike `TreeNode<TRow>`.

## Types changed

None. `ColumnDef`, `GridQuery`, `DataSourceCapabilities` and every other core type are untouched.

**Before** / **After**: not applicable.

## State shape

Nothing added to `GridState` or `GridQuery`. The engine's row type becomes `GroupedRow<TRow>` while
`grouping()` is listed, the same mechanism a tree uses for `TreeNode<TRow>`: a value on `state.rows`,
not a new field.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| `state.meta['gridwright:grouping:summary']` | `Readonly<Record<string, unknown>>` | not published | `groupingPlugin`'s stage, only when `summary: true` |

## Serialisation

Nothing here travels to a data source unless `serverGrouped` is used, and in that case the source
receives an ordinary `GridQuery` — `groupBy` is never added to it (non-goal, spec.md §4) — and is
expected to answer `GroupedRow<TRow>[]` directly. The shape above is the wire contract for that case:
plain JSON-serialisable fields, no functions, no class instances.
