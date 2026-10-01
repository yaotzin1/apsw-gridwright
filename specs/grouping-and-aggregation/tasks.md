# Tasks: row grouping and aggregation

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [x] **T-01** `src/grouping/types.ts`, `aggregate.ts`, `controller.ts`: the discriminated row types,
      `computeAggregate` (sum/avg/min/max/count/custom), `createGroupingController`
- [x] **T-02** `src/grouping/columns.ts`, `data-source.ts`, `plugin.ts`, `rows.ts`: `groupColumn(s)`,
      `createGroupingDataSource`, `groupingPlugin` (bucketing, nesting, aggregates, the
      capabilities.paginate refusal, `serverGrouped` skip), `ungroupedRows`

## Data sources

- [x] **T-03** `createGroupingDataSource` wraps `fetch` and `fetchAll` alike, so an export of every
      matching row gets the same `GroupMemberRow` shape a fetched page does

## Adapter

- [x] **T-04** `src/react/grouping/`: `addon.tsx` (`grouping()`, the C-1 refusal beside `treeData()`,
      wiring the plugin, the controller and the data source into the engine), `GroupRow.tsx`,
      `SummaryRow.tsx`, `messages.ts`, the `aggregate` column augmentation in `types.ts`

## Tests

- [x] **T-05** `tests/unit/grouping.test.ts`: bucketing and ordering, nesting, every aggregate,
      custom accumulators, the summary meta key, collapsing without a refetch, the paginate refusal,
      `serverGrouped` skipping the stage, `ungroupedRows`
- [x] **T-06** `tests/react/grouping.test.tsx`: group headers and counts, aggregate display,
      expand/collapse by role, `defaultExpanded`, `aria-expanded`/`aria-level`, `role="treegrid"`,
      the summary row, the `treeData()` refusal — every assertion queried by role or text, not by
      class name where a role exists
- [x] **T-07** Smoke coverage: `groupingPlugin` and `grouping` added to `scripts/check-exports.mjs`'s
      allowlists; `npm run test:smoke` passes

## Documentation

- [x] **T-08** README (a `## Grouping and aggregation` section, the add-on table, the mindmap, the
      "Not in this release" list, the exports list, the `role="treegrid"` sentence)
- [x] **T-09** CHANGELOG entry under Unreleased, classified minor
- [x] **T-10** `specs/DEPENDENCY_MAP.md`, `docs/api.md`, `docs/addons.md`, `docs/grouping.md` (new),
      a pointer from `docs/plugins.md`'s worked example to the real implementation

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
