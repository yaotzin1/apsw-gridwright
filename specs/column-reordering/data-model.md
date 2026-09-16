# Data model: column reordering

## Types added

No new type. The feature adds one field to a type that exists and two members to an interface that
exists; both are in `src/react/layout/types.ts` beside the rest of the layout's vocabulary.

## Types changed

**Before**

```ts
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
}
```

**After**

```ts
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
    readonly order: readonly string[];
}
```

A required field on a type consumers receive and hand back partially. Classified, with the one thing
it breaks, in `api-surface.md`.

`ColumnLayoutColumnOptions` gains `movable?: boolean` and `ColumnLayoutOptions` gains
`reorderable?: boolean`; both optional, so nothing that compiles today stops compiling.

`ColumnDef` in `src/core/types.ts` is untouched. The declared array is the declared order, and an
`order` field on a column would be a second way to say the same thing — the kind of second source of
truth that is right until the day it disagrees.

## State shape

Nothing is added to `GridState` or `GridQuery`.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| `order` | `readonly string[]` | `[]`, meaning "the declared order" | a drop, `Ctrl`+arrow, `controller.moveColumn`; cleared by `reset()` |

**The resolved order**, which everything else is computed from:

```
orderedColumns(columns, order) =
    [ ...ids in `order` that exist in `columns`, in that order,
      ...the remaining columns, in their declared order ]
```

Three consequences, all deliberate:

- **An empty `order` means "as declared".** It is not a special case in the code: with nothing
  named, every column falls into the second group and keeps its declared position.
- **An id that no longer exists is skipped.** A developer who removes a column does not break every
  reader who has a saved layout.
- **A column the order does not name goes last.** A developer who adds a column finds it at the end
  for anyone with a saved layout, and at its declared position for everyone else. This is the one
  surprising consequence and it is documented rather than engineered around: the alternatives are
  guessing where the reader would have put it, or discarding their whole arrangement because one
  column changed.

`order` holds **data column ids only**. Another add-on's extra column has no entry in the consumer's
`columns` array, is not reorderable, and keeps the end its `placement` puts it at.

**Interaction with pinning.** `order` and `pinned` are stored independently and resolved together:
`orderedColumns` decides the painting order, then `stickyOffsets` runs over it exactly as it does
today. `moveColumn` is the one place they are coupled — it adjusts `pinned` for the moved column
based on where it landed (spec C-4), so the two records never disagree about a column that sits
between two frozen ones.

## Serialisation

`order` is an array of strings, which is the most JSON-transparent shape available, and it joins a
state that already round-trips:

```json
{
  "widths": { "name": 240 },
  "pinned": { "name": "left" },
  "hidden": { "city": true },
  "order": ["name", "salary", "startedOn", "department", "email", "title"]
}
```

Read back in through `initial`, it is validated the way the other three records are: the value must
be an array, and every entry must be a string. Anything else is dropped and the layout keeps its
declared order, so a corrupted entry costs the reader their arrangement rather than their grid. Ids
are not checked against the columns at this point, because `initial` is read before the columns are
known; unknown ids fall out of `orderedColumns` instead.

Nothing here travels to a data source. `order` never enters `GridQuery`, so no source sees it and no
`capabilities` facet is involved — though a source that reads `DataSourceRequest.columns` to build
its own projection will receive them in the reader's order, which `docs/column-layout.md` says out
loud.
