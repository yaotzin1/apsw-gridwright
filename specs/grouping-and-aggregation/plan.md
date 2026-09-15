# Plan: row grouping and aggregation

## 1. Modules touched

| File | Change |
| :--- | :--- |
| `src/plugins/grouping.ts` | New. `groupingPlugin(options)`: stage `gridwright:group` at `STAGE_ORDER.TRANSFORM`, `skip` for server grouping, `setMeta` for grand totals |
| `src/plugins/aggregates.ts` | New. Built-in aggregate calculators (`sum`, `avg`, `min`, `max`, `count`) |
| `src/plugins/index.ts`, `src/index.ts` | Exports (not added to `corePlugins()`) |
| `src/react/grouping/addon.tsx` | New. `grouping(options)`: `plugins`, `configure`, `columnSignature`, `renderRow`, `rowAttributes`, `tableFooter` |
| `src/react/grouping/GroupRow.tsx`, `SummaryRow.tsx` | New. The group header row and the `<tfoot>` row |
| `src/react/grouping/types.ts` | New. Options, the discriminated row type, the `aggregate` column augmentation through `'apsw-gridwright/react'` |
| `src/react/grouping/messages.ts` | New. `gridwright:grouping` messages |
| `src/locales/{de,es,fr,pl}.ts` | `addons['gridwright:grouping']` |
| `src/styles/styles.css` | Group toggle, count, summary row |

Not touched: `src/core/types.ts` (no `groupBy` in `GridQuery`, no `group` capability),
`src/react/Gridwright.tsx`, `src/react/parts/GridBody.tsx` (it already renders `renderRow` and
`tableFooter` contributions).

## 2. Architecture and Data Flow

```mermaid
sequenceDiagram
    participant App as React App
    participant Addon as grouping() add-on
    participant Engine as GridEngine
    participant GroupStage as gridwright:group (TRANSFORM, 500)
    participant Paginate as core:paginate (PAGINATE, 900)
    participant Body as GridBody / GridVirtualBody

    App->>Addon: addons={[grouping({ groupBy: ['department'], summaryRow: true })]}
    Addon->>Engine: plugins: [groupingPlugin(...)], configure: getRowId for group rows
    Engine->>GroupStage: run(sortedRows, context)
    Note over GroupStage: buckets rows by key, computes aggregates, emits group and member rows
    GroupStage->>Paginate: { rows, totalRows }
    Paginate-->>Engine: the page
    Engine-->>Body: rows
    Body->>Addon: renderRow(row) for group rows; undefined for member rows
    Addon-->>Body: tableFooter: grand totals from state.meta
    App->>Addon: reader collapses "Sales"
    Addon->>Engine: invalidatePipeline() (no fetch)
```

## 3. Where the behaviour lives

- **Grouping calculation**: `src/plugins/grouping.ts`, at `STAGE_ORDER.TRANSFORM`.
- **Grouping options**: on the plugin and the add-on, never in `GridQuery`.
- **Expanded state**: in the add-on, shared with the plugin; changes call `api.invalidatePipeline()`.
- **Rendering**: group rows through the `renderRow` slot, grand totals through `tableFooter`.

## 4. Trade-offs taken

- **In-memory grouping requires all matching rows**: it cannot run over a paginated slice. A server that
  groups sets `serverGrouped`, which drives the stage's `skip`, and returns the discriminated shape.
- **Rows carry a discriminator** (`kind: 'group' | 'row'`), keeping virtual scrolling and row positions
  linear, at the cost of the engine's row type changing while grouping is listed (the grid remounts).

## 5. Risks & Mitigation

| Risk | Mitigation |
| :--- | :--- |
| Performance on large in-memory sets (e.g. 50k rows) | Single-pass bucketing with incremental aggregates; measured and recorded in research.md before optimising. |
| Windowed body with a changing row count on expand/collapse | Fixed row height arithmetic already handles a changed `totalRows`; the window follows `scrollToIndex` of the toggled group. |
| Group rows leaking into exports | Open question C-3 in spec.md, decided before stage 6. |
