# API surface contract: column reordering

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**, with one type-level break called out below rather than hidden.

Reasoning: no exported function changes signature, no default changes, and no rendered markup
changes for a grid that does not list `columnLayout()`. Everything is added to an add-on that
already exists.

The exception, stated plainly: **`ColumnLayoutState` gains a required `order` field.** For the
documented uses — receiving the state from `onChange`, and handing a `Partial<ColumnLayoutState>`
back through `initial` — nothing breaks, because one is a read and the other is already partial. It
breaks exactly one thing: code that builds a complete `ColumnLayoutState` object literal by hand,
which now fails to compile until it adds `order`. That is a compile error with an obvious fix and no
silent behaviour change, and the package is unpublished, so no released consumer can hit it.

The alternative was `order?: readonly string[]`. Rejected: the other three fields are required
because the state is "the whole layout", and an optional `order` would say that a layout sometimes
has no order, which is never true. A field that is always present should not be typed as though it
might not be.

## Exports added

All from `apsw-gridwright/react`. No new module entry, no new add-on.

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `orderedColumns` | `./react` | `<T extends { id: string }>(columns: readonly T[], order: readonly string[]) => readonly T[]` — pure |
| `moveInOrder` | `./react` | `(order: readonly string[], columnId: string, toIndex: number) => readonly string[]` — pure |

Both are the arithmetic behind the feature, exported for the same reason `stickyOffsets` is: they
are what a consumer needs to reproduce the grid's own ordering outside it, and they are testable
without a DOM.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `ColumnLayoutState` | `{ widths, pinned, hidden }` | `+ readonly order: readonly string[]` | A required field; see the classification above |
| `ColumnLayoutOptions` | — | `+ readonly reorderable?: boolean` | Additive, optional |
| `ColumnLayoutColumnOptions` | — | `+ readonly movable?: boolean` | Additive, optional |
| `ColumnLayoutController` | — | `+ order`, `indexOf`, `canMove`, `moveColumn` | Additive; an interface consumers receive, never implement |

```ts
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
    /**
     * The data columns in painting order, by id. Ids that no longer exist are ignored on the way
     * in; columns this does not name keep their declared order, after the ones it does.
     */
    readonly order: readonly string[];
}

export interface ColumnLayoutOptions {
    // ...existing...
    /** Dragging and Ctrl+arrow at all. Default true. A column opts out with `layout: { movable: false }`. */
    readonly reorderable?: boolean;
}

export interface ColumnLayoutColumnOptions {
    // ...existing...
    /** Default true. False keeps the column where it is, and nothing may be moved across it. */
    readonly movable?: boolean;
}

export interface ColumnLayoutController {
    // ...existing...
    /** The visible data columns in painting order. Extra columns are not in it. */
    readonly order: readonly string[];
    /** The column's position among the visible data columns, or -1. */
    indexOf(columnId: string): number;
    /** False for `layout: { movable: false }`, and when the add-on has reordering off. */
    canMove(columnId: string): boolean;
    /**
     * Moves the column to that position among the visible data columns. Out-of-range clamps.
     * A move into a run of columns pinned to an edge pins it to that edge; a move out unpins it.
     */
    moveColumn(columnId: string, toIndex: number): void;
}
```

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `columnLayout({ reorderable })` | — | `true` |
| `column.layout.movable` | — | `true` |

One behaviour a consumer inherits by listing `columnLayout()`, recorded because it changes rendered
markup without breaking a build: **every movable header cell becomes `draggable`.** A header is then
a drag source in every browser, which changes what a click-and-hold does on it. `reorderable: false`
restores exactly the previous markup.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported — `orderedColumns` and
      `moveInOrder` are generic over structural types and need none beyond what is already exported
- [ ] Both `import` and `require` conditions still resolve types — checked at stage 7
- [ ] `npm run check:exports` passes — checked at stage 7
