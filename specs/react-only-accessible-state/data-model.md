# Data model: React-only surface, accessible grid state

## Types added

All three are internal to `src/react/a11y/` and are not exported from either entry point. They are
written down here because the contract between the deriving function and the hook that renders it
is what keeps the announcement to one sentence.

```ts
/** What the announcement is derived from. Every field is already on GridState. */
export interface AnnouncementInput {
    readonly status: GridStatus;
    readonly error: GridError | null;
    readonly rowCount: number;
    readonly totalRows: number;
    readonly isTotalExact: boolean;
    readonly firstRowIndex: number;
    /** Absent for a virtualized grid, where a from-to range describes the window, not the result. */
    readonly paginated: boolean;
    /** The sort that changed since the last announcement, if one did. */
    readonly sortChange: SortAnnouncement | null;
    readonly labels: GridwrightLabels;
}

/** A sort the reader has just caused, and the header text to name it by. */
export interface SortAnnouncement {
    readonly columnHeader: string;
    readonly direction: SortDirection | null;
}

/** The ARIA row numbering for one body, computed once rather than per row. */
export interface RowNumbering {
    /** `aria-rowcount` for the table: header-inclusive, or -1 when the total is not exact. */
    readonly rowCount: number;
    /** Turns a zero-based absolute row position into its header-inclusive `aria-rowindex`. */
    readonly indexOf: (absolutePosition: number) => number;
}
```

## Types changed

**Before**

```ts
export interface GridwrightLabels {
    // ...
    readonly pageRange: (from: number, to: number, total: number, exact: boolean) => string;
    readonly treeExpand: string;
    // ...
}
```

**After**

```ts
export interface GridwrightLabels {
    // ...
    readonly pageRange: (from: number, to: number, total: number, exact: boolean) => string;
    readonly sortAnnouncement: (column: string, direction: SortDirection | null) => string;
    readonly rowsShown: (from: number, to: number, total: number, exact: boolean) => string;
    readonly rowsTotal: (count: number) => string;
    readonly treeExpand: string;
    // ...
}
```

`MessageKey` gains six members. Both changes are classified in `api-surface.md` as minor.

## State shape

No field is added to `GridState` or to `GridQuery`, and the engine is not modified. This is the
load-bearing part of the design: every input the announcement and the row numbering need is
already published.

| Field read | Type | Source | Used for |
| :--- | :--- | :--- | :--- |
| `state.status` | `GridStatus` | engine | loading and error priority, `aria-busy` |
| `state.error` | `GridError \| null` | engine | the error announcement |
| `state.rows.length` | `number` | engine | the upper bound of the range |
| `state.totalRows` | `number` | pipeline or source | `aria-rowcount`, the range total |
| `state.isTotalExact` | `boolean` | source capability | whether a total may be stated at all |
| `state.query.pagination` | `{ pageIndex, pageSize }` | query | the absolute position of the first row |
| `state.query.sort` | `readonly SortSpec[]` | query | detecting the sort that changed |
| `state.meta[WINDOW_OFFSET_META]` | `number \| undefined` | windowed source | the absolute position under virtualization |

The one piece of state the feature owns is in React, not in the engine: the previously announced
message, held in a ref so the region can be cleared and re-filled when an identical message
recurs. It is render-local and is destroyed with the component.

## Row numbering arithmetic

One rule, applied in both bodies, so they cannot drift:

```
aria-rowindex = absolutePosition + 2      // +1 for one-based, +1 for the header row
aria-rowcount = isTotalExact ? totalRows + 1 : -1
```

`absolutePosition` is zero-based across the whole result set. For a paginated body it is
`pageIndex * pageSize + offsetInPage`. For a virtualized body it is the loop's absolute index,
which a windowed source publishes through `WINDOW_OFFSET_META` and which otherwise comes from the
query. That second case is unchanged by this feature; only the `+2` is.

## Tree positions

Read from the nested-set index the controller already holds, through `controller.getIndex()`:

| Attribute | Derived from |
| :--- | :--- |
| `aria-level` | `node.depth + 1`, because ARIA levels are one-based and depth is zero at the roots |
| `aria-setsize` | the length of the parent's `childNodeIds`, or of `rootNodeIds` at depth zero |
| `aria-posinset` | the node's position in that same array, plus one |
| `aria-expanded` | `controller.isExpanded(node.nodeId)`, and only when `node.hasChildren` |

A cyclic node has `hasChildren` true but can never expand, so it carries no `aria-expanded`: it is
a leaf as far as a reader is concerned, which is what `TreeCell` already says in words.

## Serialisation

Nothing added here travels to a data source, so there is no wire form. The announcement is derived
and discarded; the row indices are attributes on elements that already exist.
