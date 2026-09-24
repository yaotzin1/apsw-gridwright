# Data model: 2D cell navigation and clipboard copy

## Types added

```ts
/** Which cell the grid's single Tab stop is on. Ids, not indices -- see State shape. */
export interface ActiveCell {
    readonly rowId: RowId;
    readonly columnId: string;
}
```

`CellNavigationOptions` and `CellNavigationController` are in `api-surface.md`, where their
exportability is settled.

## Types changed

None. No existing type gains, loses or changes a member.

**Before**

```ts
// GridState, GridQuery, ColumnDef, AddonContribution: unchanged
```

**After**

```ts
// identical
```

## State shape

**Nothing is added to `GridState` or `GridQuery`.** The cursor is view state: it belongs to the
adapter, it never reaches the engine, and it never travels to a data source. Putting it on
`GridState` would publish it to every subscriber and make a cursor move a state change that the
pipeline and every plugin would see.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| `activeCell` (React state, inside the add-on's `setup`) | `ActiveCell \| null` | `null` until the first render with rows, then the first cell | `tableKeyDown`, the cells' `onFocus`, and `focusCell` on the controller |

**Why ids rather than indices.** A row index is a position in a result set that sorting, filtering
and paging all rewrite. Keyed by `rowId` and `columnId`, the cursor stays on the cell the reader was
looking at when it is still present, and falls back to the first cell when it is not -- which is
also what happens when a page turns and none of the ids survive.

## Serialisation

None. Nothing here is written to a query string, a request or storage by this package. A consumer
persisting a cursor does it themselves from `onActiveCellChange`, and `ActiveCell` is two strings,
so it survives JSON without help.
