# Plan: row grouping and aggregation

## 1. Modules touched

> **Corrected during stage 6** (2026-09-29): moved from `src/plugins/grouping.ts` to a top-level
> `src/grouping/` directory. `src/plugins/` turned out to hold exactly the four built-in,
> capability-driven stages (`filtering.ts`, `pagination.ts`, `search.ts`, `sorting.ts`) — every stage
> that reshapes the row type instead (the tree) lives in its own top-level directory, mirrored by
> `src/react/<name>/`. Grouping follows that stronger, more specific precedent instead of the
> original guess. plan.md is not locked the way api-surface.md is; this row records the deviation
> rather than leaving the file wrong.

| File | Change |
| :--- | :--- |
| `src/grouping/types.ts` | New. The discriminated row type (`GroupedRow`, `GroupHeaderRow`, `GroupMemberRow`), the aggregate function types |
| `src/grouping/aggregate.ts` | New. `computeAggregate`: `sum`, `avg`, `min`, `max`, `count`, and a custom accumulator |
| `src/grouping/controller.ts` | New. `createGroupingController`: expansion state, independent of React |
| `src/grouping/columns.ts` | New. `groupColumn(s)`: unwraps a column written for your row so it reads a `GroupedRow<TRow>` |
| `src/grouping/data-source.ts` | New. `createGroupingDataSource`: wraps a source so every fetched row starts as a member row |
| `src/grouping/plugin.ts` | New. `groupingPlugin(options)`: stage `gridwright:group` at `STAGE_ORDER.TRANSFORM`, `skip` for server grouping, the `capabilities.paginate` refusal, `setMeta` for grand totals |
| `src/grouping/rows.ts` | New. `ungroupedRows`: drops group headers for an export that wants a flat list |
| `src/grouping/index.ts`, `src/index.ts` | Exports (not added to `corePlugins()`) |
| `src/react/grouping/addon.tsx` | New. `grouping(options)`: `plugins`, `configure`, `columnSignature`, `renderRow`, `rowAttributes`, `tableAttributes`, `tableFooter` |
| `src/react/grouping/GroupRow.tsx`, `SummaryRow.tsx` | New. The group header row and the `<tfoot>` row |
| `src/react/grouping/types.ts` | New. The `aggregate` column augmentation through `'apsw-gridwright/react'` |
| `src/react/grouping/columns.tsx` | New. `reactGroupColumns`: rewrites `cell` and `icon` to receive your row rather than the group wrapper, the React half of `groupColumn` — added during stage 6 after the first version left them unwrapped (see review.md) |
| `src/react/grouping/messages.ts` | New. `gridwright:grouping` messages |
| `src/react/grouping/index.ts`, `src/react/index.ts` | Exports |
| `src/locales/{de,es,fr,pl}.ts` | `addons['gridwright:grouping']` (not `en.ts`: English has no `addons` section — see `src/locales/en.ts`, it re-exports `englishCatalog` verbatim, and every add-on's own `messages.en` is the English fallback) |
| `src/styles/styles.css` | Group toggle, count, aggregates, summary row |
| `scripts/check-exports.mjs` | `groupingPlugin` and `grouping` added to the packaging audit's allowlists |

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

- **Grouping calculation**: `src/grouping/plugin.ts`, at `STAGE_ORDER.TRANSFORM`.
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
| Performance on large in-memory sets (e.g. 50k rows) | One bucketing pass per `groupBy` level (a `Map`, not a nested scan), and aggregates are computed once per group from the members already bucketed into it — not recomputed against the whole set. **Not measured against a large set**; see research.md, "Open questions". |
| Windowed body with a changing row count on expand/collapse | Fixed row height arithmetic already handles a changed `totalRows`. **Not mitigated**: nothing scrolls the toggled group into view or otherwise compensates for the jump; a reader who collapses a group above the viewport sees the window shift under them. Left as a known gap — see review.md. |
| Group rows leaking into exports | Decided in spec.md §8, C-3: a plain export gets group headers as near-blank rows (their `formatValue`/`exportValue` answer `''` rather than throwing) rather than a custom export format; `ungroupedRows()` is the documented unwrapping helper for a flat export instead. |
