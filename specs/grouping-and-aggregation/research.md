# Research: row grouping and aggregation

## Options considered

### Option A — a `groupBy` facet on `GridQuery`

**How it works.** Add `groupBy: readonly string[]` to `GridQuery`, alongside `sort` and `filters`,
with a `group: boolean` `DataSourceCapabilities` flag so a server can resolve it.

**Rejected because.** It widens the query and the capability set for one plugin's feature, which
spec.md §4 rules out: "the query and the capability set are the contract with every data source; one
plugin does not widen them." A consumer with no grouping installed would still carry an unused
`groupBy` field on every query object and every data source's capability check. Kept as plugin
options instead (`groupingPlugin`'s `groupBy`, not `GridQuery`'s).

### Option B — wrap the data source, mirroring `createTreeDataSource`

**How it works.** `createGroupingDataSource` wraps a plain `DataSource<TRow>` so every fetched row
starts as a `GroupMemberRow<TRow>` (`{ kind: 'row', row, rowId, depth: 0 }`) before any pipeline stage
runs. Filtering, search and sorting then operate on this uniform shape through `groupColumn`'s
unwrap, and the `TRANSFORM` stage turns some of those member rows into group headers. This is the
same trick `createTreeDataSource` uses for `TreeNode<TRow>`.

**Chosen because.** It keeps the engine's row type consistent for the whole pipeline (every
`PipelineStage<TRow>` shares one `TRow`), which the type system already requires — there is no
supported way for a stage's row type to differ before and after it runs. The alternative (special-
casing "the transform stage may receive a different row type than the ones before it") would need
core engine changes; wrapping needs none.

## Prior art

Every mainstream data grid with grouping (ag-Grid, MUI X, Tanstack Table) computes aggregates
top-down per group from the rows already bucketed into it, not by re-scanning the full row set per
group — the same choice made here. Where this package differs: grouping is a plugin over the same
`TRANSFORM` slot the tree uses, rather than a built-in engine concept, so a third party can write a
competing one with no less reach (see [Writing your own](../../docs/grouping.md#writing-your-own)).

## Measurements

Not measured. No performance claim is made beyond "one bucketing pass per `groupBy` level" (an
algorithmic property, not a benchmark); see plan.md §5. A measurement against a large in-memory set
(50k+ rows, multi-level `groupBy`, several aggregates) is listed as a known gap in review.md rather
than assumed to be fine.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |

## Open questions

None outstanding at implementation time. C-2 (treegrid role) and C-3 (export interop) were open at
stage 2 and are resolved in spec.md §8, decided during stage 6 rather than stage 2 — the trade-off
recorded in plan.md's stage-6 correction note applies here too: the spec named them open rather than
guessing, and implementation closed them against the actual add-on contract instead of a paper design.
