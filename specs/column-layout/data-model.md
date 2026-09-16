# Data model: column layout (resizing, pinning and visibility)

## Types added

Every type here lives in `src/react/layout/types.ts` and is exported from `apsw-gridwright/react`.
None of them reaches `src/core`: a width in pixels and a sticky side are presentation, and the
engine has no opinion about either.

```ts
export type ColumnPin = 'left' | 'right';

/** The persisted layout. Three flat records keyed by column id, so a `JSON.parse` round-trips it. */
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
}

/** One column as the sticky arithmetic sees it: an id, a width, and a side or nothing. */
export interface LayoutColumn {
    readonly id: string;
    readonly width: number;
    readonly pinned: ColumnPin | null;
}

/** Where each pinned column sits, and which two are the boundaries that carry the shadow. */
export interface StickyOffsets {
    readonly left: ReadonlyMap<string, number>;
    readonly right: ReadonlyMap<string, number>;
    readonly lastLeft: string | null;
    readonly firstRight: string | null;
}

export interface ColumnLayoutColumnOptions {
    readonly resizable?: boolean;
    readonly pinned?: ColumnPin;
    readonly hideable?: boolean;
    readonly maxWidth?: number;
}
```

## Types changed

**Before**

```ts
interface GridwrightColumn<TRow, TValue = ColumnValue> extends ColumnDef<TRow, TValue> {
    readonly cell?: (context: CellContext<TRow, TValue>) => ReactNode;
    readonly headerCell?: (context: HeaderContext<TRow, TValue>) => ReactNode;
    readonly icon?: (context: CellContext<TRow, TValue>) => ReactNode;
    // `edit` from inline editing and `filter` from column filters arrive by augmentation.
}
```

**After**

```ts
// Unchanged in src/react/types.ts. The field is added from the add-on's own module:
declare module 'apsw-gridwright/react' {
    interface GridwrightColumn<TRow, TValue> {
        readonly layout?: ColumnLayoutColumnOptions;
    }
}
```

Optional, so nothing that compiles today stops compiling: a **minor**, classified in
`api-surface.md`.

`ColumnDef` in `src/core/types.ts` is untouched. It already carries `width`, `minWidth` and
`hidden`, which is all the engine needs; `pinned` would be engine vocabulary for a decision only a
renderer can act on.

## State shape

Nothing is added to `GridState` or `GridQuery`. The layout lives in the add-on's own React state,
created in `setup` and published to the components it renders through a context.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| `widths[columnId]` | `number` | absent; the column renders at `resolvedWidth` below | the resize handle on release, on a keyboard step, on auto-fit; `controller.setWidth` |
| `pinned[columnId]` | `ColumnPin \| null` | absent; the column's own `layout.pinned` decides | `controller.setPinned` |
| `hidden[columnId]` | `boolean` | absent; the column's own `hidden` decides | the picker; `controller.setHidden`, `showAll`, `reset` |
| `ColumnDef.hidden` | `boolean` | the consumer's value | the add-on's `configure`, from `hidden` above |

**Resolved width**, the number every other calculation uses, in order: `widths[id]`, then
`column.width` when it is a number, then the pixel count when `column.width` is a string of the
form `"180px"`, then `defaultWidth`. A width expressed any other way — `"20%"`, `"auto"` — cannot
be added up into a sticky offset, so the add-on uses `defaultWidth` for it and the documentation
says so. Clamped to `[max(minWidth, column.minWidth ?? 0), column.layout?.maxWidth ?? Infinity]`.

**Extra columns.** An add-on's extra column (the `selection()` checkbox) has no column definition,
so its resolved width is `widths[id] ?? extraColumnWidth`. It takes part in the sticky arithmetic
at the end its `placement` puts it. A `start` extra column is pinned left whenever any data column
is pinned left, unless `pinned[id]` says otherwise: a checkbox that scrolls out from under the name
it belongs to is worse than no pinning at all.

## Serialisation

`ColumnLayoutState` is what `onChange` hands out and what `initial` takes back, and it is expected
to go through `localStorage` or a user-preferences endpoint. It survives `JSON.stringify` followed
by `JSON.parse` unchanged:

```json
{
  "widths": { "name": 240, "salary": 120 },
  "pinned": { "name": "left", "department": null },
  "hidden": { "city": true }
}
```

Three consequences that shaped the type:

- **"Pinned nowhere" is `null`, never `undefined`.** `JSON.stringify` drops a key whose value is
  `undefined`, so a state that unpinned a column would come back from storage having said nothing
  about it, and the column's own `layout.pinned` would pin it again. `null` is the difference
  between "no opinion" and "explicitly not pinned", and it is the one of the two that survives.
- **Flat records, not arrays of objects.** The layout is a lookup on every render; a record is
  already the shape the lookup wants, and it merges with `initial` by key without ordering rules.
- **Nothing derived is stored.** Sticky offsets, the boundary columns and the CSS custom property
  names are computed from the state and the columns on every render. Storing an offset would
  persist a number that is wrong the moment a column is hidden.

Nothing here travels to a data source. The layout never enters `GridQuery`, so no
`DataSource` sees it and no `capabilities` facet is involved.
