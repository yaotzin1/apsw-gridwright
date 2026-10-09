# Lifecycle contract: row grouping and aggregation

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

| Event | Payload | Emitted when |
| :--- | :--- | :--- |

None. No new `GridEventMap` entry. A refusal (grouping a paginating source without `serverGrouped`)
surfaces through the existing `plugin:error` event, `{ plugin: 'gridwright:group', error }`, the same
as any other stage that throws.

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |

None.

## Ordering guarantees

- The grouping stage runs after `core:filter`, `core:search` and `core:sort` (all lower `order` than
  `STAGE_ORDER.TRANSFORM`) and before `core:paginate` (`STAGE_ORDER.PAGINATE`, higher). A group
  header always reflects the active filter, search term and sort, and always counts toward the page.
- `controller.toggle()` synchronously updates the controller's own expansion state, then notifies its
  subscriber (`groupingPlugin`'s `setup`), which calls `context.api.invalidatePipeline()`. No stage
  reruns until `invalidatePipeline()` is called; there is no implicit recompute on every render.
- Toggling never issues a fetch: `invalidatePipeline()` recomputes from the last settled result.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| `gridwright:group` | `STAGE_ORDER.TRANSFORM` (500) | none (uses `skip`, not `capability`, since there is no `DataSourceCapabilities` flag for grouping) | Yes: group headers count as rows, so `totalRows` grows by the number of visible group headers. It also publishes the range counted in records on `state.meta` as `gridwright:grouping:records` (AC-11), which is what `pageRangeOf` shows; `totalRows` itself is unchanged. |

## Teardown

`groupingPlugin`'s `setup` returns a cleanup that removes the stage and unsubscribes from the
controller. The controller itself (`createGroupingController`) holds no timers, no subscriptions of
its own and no DOM handles; its only state is two closures (`expandedDefault`, `overrides`) and a
`Set` of listener functions, released when the add-on's `setup` hook unmounts and the last reference
to the controller goes away.
