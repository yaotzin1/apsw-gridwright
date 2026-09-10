# Plan: Gridwright core

## Modules

| File | Responsibility |
| :--- | :--- |
| `src/core/types.ts` | The whole public type surface. No logic. |
| `src/core/engine.ts` | State, fetch sequencing, query and selection commands, plugin registry. |
| `src/core/pipeline.ts` | Stage ordering and the capability skip rule. |
| `src/core/columns.ts` | Column resolution: defaults and closed-over accessors. |
| `src/core/query.ts` | Query construction, normalisation, equality, page-reset policy. |
| `src/core/values.ts` | Comparison, text rendering, the filter operator vocabulary. |
| `src/core/errors.ts` | `GridwrightError`, retryability, normalisation of anything thrown. |
| `src/core/emitter.ts` | Typed events, with a throwing listener isolated. |
| `src/data/local.ts` | An array as a source. Declares nothing, answers synchronously. |
| `src/data/remote.ts` | Any async function as a source. Backoff, abort handling, invalidation. |
| `src/data/rest.ts` | Parameter encoding and envelope tolerance for REST endpoints. |
| `src/plugins/*.ts` | Filter, search, sort, paginate as ordinary plugins. |
| `src/react/*` | `useGridwright`, context, parts, the assembled `Gridwright`. |
| `src/styles/styles.css` | Structural CSS over `--gw-*` tokens. |

## Where the behaviour lives

- **Row transformations** are pipeline stages, so all four built-ins are plugins with no privileged
  access. A third-party plugin that cannot do what a built-in does means the plugin API is
  incomplete.
- **Query state** is `GridQuery` and travels to the source verbatim.
- **Grid state** is `GridState`: status, rows, totals, selection, error.
- **Rendering** is `src/react`, which is why `ColumnDef` carries no `ReactNode`.

## The fetch path

1. `commitQuery` normalises, applies the page-reset policy, compares, and returns early if nothing
   moved.
2. `performFetch` aborts the previous request, takes a sequence number, and calls the source.
3. A non-thenable result is applied immediately, so no loading state is published.
4. A thenable publishes `loading`, or `refreshing` when rows are already on screen.
5. `applyResult` drops stale sequences, runs the pipeline, computes totals and page bounds, and
   publishes once.
6. An out-of-range page is corrected after the total is known, which is the only place that can do
   it for a remote source.

## Trade-offs taken

- **`engine.ts` is long.** Fetch sequencing, query commands and selection all need the same closure
  state. Splitting it would replace private variables with a wider internal API and make the
  invariants harder to see.
- **`ColumnValue` is `any`.** Documented in one place, with the reason. The alternative is rejecting
  every typed column.
- **Retry is on by default.** Two attempts with backoff, on retryable statuses only. A grid fetch is
  idempotent; a consumer who disagrees passes `attempts: 0`.
- **No virtualization.** Named as a non-goal rather than half-built.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A source overstates its capabilities and the query is silently unapplied | Documented in the `data_source` skill with the advice to understate; the capability set is small enough to state exactly |
| Both entries ship separate copies of the engine | `splitting: true` plus a packaging audit that compares module identity across entries |
| A React effect keyed on an inline column array loops forever | `columnSignature` reduces the array to what the engine reads |
| Strict Mode leaves a destroyed engine | `useGridwright` rebuilds on a destroyed engine; covered by a test |
