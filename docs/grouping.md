# Grouping and aggregation

Collapsible group headers over rows that share a value, with a built-in or custom aggregate per
column, computed for each group and, with `summaryRow`, once more for the whole result.

```tsx
import { Gridwright, grouping } from 'apsw-gridwright/react';

const columns = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', aggregate: 'sum', formatValue: (value) => money.format(value) },
];

<Gridwright
    columns={columns}
    data={employees}
    aria-label="Employees"
    addons={[grouping({ groupBy: ['department'], summaryRow: true })]}
/>;
```

That groups by department, shows how many rows and the total salary beside each department's title,
and a grand total across every department in the table's footer.

## Options

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `groupBy` | `string[]` | required | Column ids, in nesting order. The first groups the whole set; the next groups within it, one level deeper. |
| `summaryRow` | `boolean` | `false` | A grand-total row in the table footer, aggregating across every matching row. |
| `defaultExpanded` | `boolean` | `true` | Whether a group starts expanded. |
| `serverGrouped` | `boolean` | `false` | The data source already returns group headers and member rows itself; the local grouping stage is skipped. See [Server-side grouping](#server-side-grouping). |

## The `aggregate` column option

```ts
{ id: 'salary', header: 'Salary', aggregate: 'sum' }
{ id: 'salary', header: 'Salary', aggregate: 'avg' }
{ id: 'salary', header: 'Salary', aggregate: (values, rows) => Math.max(...values) - Math.min(...values) }
```

A column with no `aggregate` reports nothing. The built-ins are `sum`, `avg`, `min`, `max` and
`count`; `sum` and `avg` skip a value that is not a finite number rather than producing `NaN`, and
`min`/`max` compare the same way the engine sorts, so they work on dates and strings too. A custom
function receives every group's values for that column and the rows they came from, and returns
whatever the group's cell should show — a range, a distinct count, a formatted summary.

`count` ignores the column's values and returns how many rows are in the group; put it on whichever
column reads best, `{ id: 'name', aggregate: 'count' }` for "12 employees" rather than a number with
no label.

## Nesting

```tsx
grouping({ groupBy: ['department', 'region'] });
```

Groups by department, and within each department, by region. A group's aggregate covers every row
under it, at whatever depth: a department's total is not the sum of its regions recomputed, it is
the same reduction run over the department's whole membership.

## Collapsing

A group starts expanded unless `defaultExpanded: false`. The toggle is a real `<button>` inside the
group's row, named after the group — *Collapse Engineering group* — because a column of identically
named toggles tells a screen reader nothing about which group each one is. Collapsing calls
`api.invalidatePipeline()` under the hood: the grid already has every row it needs, so nothing is
refetched.

## Accessibility

The table is `role="treegrid"` while `grouping()` is listed: a group header carries `aria-level` and
`aria-expanded`, which `role="grid"` has no place for. A member row carries `aria-level` one past its
group's, so a screen reader can tell a row nested two groups deep from one nested one. Every string —
the toggle's name, the item count, the summary row's labels — is in the add-on's
`gridwright:grouping` messages, translated in all five packs.

## Server-side grouping

```tsx
grouping({ groupBy: ['department'], serverGrouped: true });
```

With `serverGrouped: true` the local stage is skipped, and the data source is expected to answer the
discriminated shape itself — a mix of group headers and member rows, in the same order a local
grouping stage would have produced. This is for a server that already returns pre-grouped pages;
there is no `capabilities.group` flag, because nothing above the pipeline is meant to know where the
grouping happened.

Without `serverGrouped`, grouping needs every matching row in memory, the same as a plain array. A
source whose `capabilities.paginate` is `true` is refused rather than grouped one page at a time —
that would show a total for a department that is silently missing the rows still on the server. The
refusal reaches `plugin:error` the same way any other plugin failure does; the rows stay ungrouped
rather than the grid going empty.

## Exporting a grouped grid

`api.getMatchingRows()` on a grouped grid answers the same discriminated rows the table renders —
group headers included — because grouping is one of the stages `getMatchingRows()` runs, the same as
it is for `exportMenu()`. A column's `formatValue` and `exportValue` answer `''` for a group header
rather than throwing, so a default export of a grouped grid does not crash; it shows a mostly blank
row where each group header was. For a flat export instead, unwrap first:

```ts
import { ungroupedRows } from 'apsw-gridwright';

const rows = ungroupedRows(api.getMatchingRows().rows);
```

## With the other add-ons

| Add-on | Together |
| :--- | :--- |
| `treeData()` | Refused, by name. Both transform rows at the same pipeline stage and both change the row type; there is no combined design yet. |
| `virtualRows()` | Both. Group headers render through `renderRow` in both bodies, so they work under a fixed row height like any other row. |
| `columnFilters()`, `search()` | Both. Filtering, search and sorting run before grouping, on flat rows, so a group reflects what the reader is looking at. |
| `columnLayout()` | Both. A group header spans the visible columns; pinning and reordering apply to the columns underneath it. |

## Writing your own

The plugin, the controller and the aggregate math are exported from `apsw-gridwright` as well as
the add-on from `apsw-gridwright/react`, for building a grouped view of your own: `groupingPlugin`,
`createGroupingController`, `createGroupingDataSource`, `groupColumns`, `computeAggregate` and the
`GroupedRow<TRow>` type. `grouping()` in `src/react/grouping/addon.tsx` is built from exactly these
and nothing else, so a third-party grouping view has the same reach.
