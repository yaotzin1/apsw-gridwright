# API surface contract: row grouping and aggregation

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: a new engine plugin, a new React add-on and a new column option, all additive. Nothing
existing changes signature, default or emitted event payload. `GridQuery` and
`DataSourceCapabilities` are untouched, per the non-goals in spec.md §4.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `groupingPlugin` | `apsw-gridwright` | `<TRow>(options: GroupingPluginOptions<TRow>) => GridPlugin<GroupedRow<TRow>>` |
| `createGroupingController` | `apsw-gridwright` | `(options?: GroupingControllerOptions) => GroupingController` |
| `createGroupingDataSource` | `apsw-gridwright` | `<TRow>(source: DataSource<TRow>, options: GroupingDataSourceOptions<TRow>) => DataSource<GroupMemberRow<TRow>>` |
| `groupColumn` | `apsw-gridwright` | `<TRow>(column: ColumnDef<TRow, ColumnValue>) => ColumnDef<GroupedRow<TRow>, ColumnValue>` |
| `groupColumns` | `apsw-gridwright` | `<TRow>(columns: readonly ColumnDef<TRow, ColumnValue>[]) => readonly ColumnDef<GroupedRow<TRow>, ColumnValue>[]` |
| `ungroupedRows` | `apsw-gridwright` | `<TRow>(rows: readonly GroupedRow<TRow>[]) => readonly TRow[]` |
| `computeAggregate` | `apsw-gridwright` | `<TRow>(fn: AggregateSpecFn<TRow>, values: readonly unknown[], rows: readonly TRow[]) => unknown` |
| `GROUPING_PLUGIN_NAME` | `apsw-gridwright` | `'gridwright:grouping'` |
| `GROUPING_STAGE_ID` | `apsw-gridwright` | `'gridwright:group'` |
| `GROUPING_SUMMARY_META_KEY` | `apsw-gridwright` | `'summary'` |
| `GroupedRow`, `GroupHeaderRow`, `GroupMemberRow`, `GroupId`, `GroupAggregateSpec`, `BuiltinAggregate`, `AggregateAccumulator`, `AggregateSpecFn` | `apsw-gridwright` | types, see data-model.md |
| `GroupingController`, `GroupingControllerOptions` | `apsw-gridwright` | types |
| `GroupingDataSourceOptions` | `apsw-gridwright` | type |
| `GroupingPluginOptions` | `apsw-gridwright` | type |
| `grouping` | `apsw-gridwright/react` | `<TRow>(options: GroupingOptions) => GridAddon<TRow>` |
| `reactGroupColumns` | `apsw-gridwright/react` | `<TRow>(columns: readonly GridwrightColumn<TRow, ColumnValue>[]) => readonly GridwrightColumn<GroupedRow<TRow>, ColumnValue>[]` |
| `GroupingOptions` | `apsw-gridwright/react` | type: `{ groupBy: readonly string[]; summaryRow?: boolean; defaultExpanded?: boolean; serverGrouped?: boolean }` |
| `GROUPING_ADDON` | `apsw-gridwright/react` | `'gridwright:grouping'` |
| `groupingMessages` | `apsw-gridwright/react` | `AddonMessages` |
| `GroupRow`, `GroupRowProps` | `apsw-gridwright/react` | the group header row component and its props |
| `SummaryRow`, `SummaryRowProps` | `apsw-gridwright/react` | the `<tfoot>` grand-total row component and its props |
| `AggregateSpecFn` (re-export) | `apsw-gridwright/react` | for typing a column's `aggregate` field |
| `aggregate` | column field, via `GridwrightColumn` augmentation | `AggregateSpecFn<TRow, TValue>` |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |

None.

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `grouping()`'s `summaryRow` | — | `false` |
| `grouping()`'s `defaultExpanded` | — | `true` |
| `grouping()`'s `serverGrouped` | — | `false` |

All new; nothing existing changes default.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes

## Changes after release

The contract above is the one stage 6 was written against and stays as it was. What changed since
is recorded here, dated, with its own classification.

### 2026-10-09: the range counts records (issue #60, PR #71)

**minor.** One additive observable, and one behaviour that was wrong and now is not.

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `state.meta['gridwright:grouping:records']` | not published | `{ from, to, total }`, counted over member rows, published by the grouping stage on every pass (only when it changed) | **additive**, hence minor. The key is observable; the constant `GROUPING_RECORDS_META_KEY` is internal and not exported, so the string is the only handle a consumer has. Treat it as read-only |
| `pageRangeOf(state)` under `grouping()` | counted rows, headers included: "1-100 of 5,005" for 5,000 people | counts records: "1-98 of 5,000" | behaviour fix to a public helper, no signature change. A consumer who built their own pager from `state.totalRows` is unaffected and still counts headers |
| the live-region sentence "Showing x to y of z" | rows, headers included | records | follows `pageRangeOf`, so the two agree |

Unchanged on purpose, because AC-03 holds: `state.totalRows`, `state.pageCount`, `state.hasNextPage`
and `aria-rowcount` still count the group headers, since headers are rows the table renders and the
pipeline pages over. A consumer reading those sees the same numbers as before.

No export added or removed, no default changed, no event payload changed.
