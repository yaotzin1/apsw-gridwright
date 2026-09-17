# Lifecycle contract: expandable rows (row detail panels)

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

**No engine event.** The engine emits `query:change`, `selection:change` and `fetch:*`. None of them
is what happened when a reader opened a panel: no query changed, no row moved, no selection changed,
nothing was fetched. Adding `row:expand` to the emitter would put a React rendering concern on an
object documented as framework-agnostic, and every consumer of it would be a React consumer — the
same reasoning `specs/column-layout/events.md` applied to a column drag, and for the same reason.

What a consumer is told, they are told through options on the add-on:

| Callback | Payload | Called when |
| :--- | :--- | :--- |
| `rowDetail({ onExpandedChange })` | `readonly RowId[]` — every expanded id | after an expansion change has been committed to state and rendered |
| `rowDetail({ canToggle })` | `(rowId, expanded) => boolean` | before every change the add-on commits, including one made through the controller |
| `rowDetail({ controllerRef })` | `RowDetailController \| null` | once when the controller exists, once with `null` on unmount |

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

No existing payload changes, so nothing here is a major.

## Pipeline stages added

None. `STAGE_ORDER` is unchanged and no plugin is registered. A panel is not a row, is not produced
by a query, and is not something the pipeline could compute.

## Ordering guarantees

By the time `onExpandedChange` runs:

- the new set is in React state and the grid has rendered with it, so a handler reading the DOM sees
  the panel;
- `canToggle` has already allowed the change — a refused change fires nothing;
- `single: true` has already collapsed the previously expanded row, so the array holds one id rather
  than arriving twice.

It does **not** run for `initialExpanded`. A handler that writes to storage must not overwrite a
saved set on the first paint, which is the same guarantee `columnLayout({ onChange })` gives.

`controllerRef` fires once for the life of the grid, not on every expansion: the ref callback is
called from an effect keyed on the callback and the controller, and expansion changes neither
identity in a way that re-fires it.

## The live region

Expansion is announced through `grid.announce(sentence)`, not through an `announce` contributor.

A contributor's `key` and `describe` are handed `GridState`, and expansion is deliberately not in
`GridState` (see spec.md §4), so a contributor could not see the change however it were written.
`docs/addons.md` already names `grid.announce` as the route for something that is not grid state,
and an export finishing is the precedent.

Two sentences, both naming the row: `{row} details shown` and `{row} details hidden`.

## Teardown

Nothing to tear down. The add-on's entire model is a `Set<RowId>` in React state, so unmounting
disposes of it and React Strict Mode's double mount costs one empty set. There is no controller to
destroy, no subscription to drop and no timer to clear — which is why this add-on needs none of the
Strict Mode care `treeData()`'s controller requires.

A collapsed panel is unmounted rather than hidden, so the consumer's own component runs its own
cleanup: a nested `<Gridwright />` inside a panel destroys its engine when the panel closes, exactly
as it would anywhere else in a React tree.
