# API surface contract: React-only surface, accessible grid state

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.
>
> **Amended after stage 6, by returning to stage 3.** `GridStaleNotice`, two labels, two message
> keys and one class-name override were added once a failed refresh over surviving rows was found
> to render nothing at all. Still a minor: everything here is additive.

## Semver classification

**minor**

Reasoning. Eight message keys, five label entries, one class-name override and one component are
added, and `messages.ts` records that adding a key is a minor. No exported name is removed, no
signature changes, and no entry point moves, so nothing a consumer imports stops resolving. The rendered ARIA output changes, which is
not in the repository's major-change table (a signature, a default, or an emitted event payload)
and is classified as a fix, but it is called out below because a consumer asserting on the old
attribute values will see those assertions fail.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `GridStaleNotice` | `./react` | `() => JSX.Element | null`. The banner shown when a refresh failed and rows remain. Also attached as `Gridwright.StaleNotice`, and rendered by the component, so it is exported for a layout composed by hand rather than because it has to be wired up. |

The modules under `src/react/a11y/` stay internal, reached through `Gridwright.Root`.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridwrightLabels` | 21 members | 26 members: adds `sortAnnouncement`, `rowsShown`, `rowsTotal`, `staleTitle`, `staleMessage` | minor. The prop is `Partial<GridwrightLabels>`, so no consumer object becomes invalid. A consumer who built a complete `GridwrightLabels` by hand, rather than spreading `defaultLabels`, has five members to add. |
| `MessageKey` | 22 keys | 30 keys | minor, as recorded in `messages.ts`. A catalogue missing the new keys falls back to English rather than breaking. |
| `defaultLabels` | `GridwrightLabels` | unchanged type, five more members | minor |
| `GridwrightClassNames` | 15 members | 16 members: adds `stale` | minor |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

Nothing is removed. The core entry `apsw-gridwright` keeps every export it has today; what changes
is that the documentation describes it as the engine behind the React component rather than as a
way to build a grid.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| — | — | — |

No option's default changes. The behaviour changes below are corrections to rendered output, not
defaults a consumer selected.

## Rendered output changes

Not an API change, and listed because it is the part a consumer can observe in a test.

| Surface | Before | After |
| :--- | :--- | :--- |
| `aria-rowcount` on the table | `totalRows`, or `-1` when inexact | `totalRows + 1`, or `-1` when inexact. The header row counts. |
| `aria-rowindex` on a paginated row | absent | the row's absolute position, header-inclusive: `pageIndex * pageSize + offset + 2` |
| `aria-rowindex` on a virtualized row | `absolute + 1` | `absolute + 2` |
| `aria-rowindex` on the header row | absent | `1` |
| `aria-multiselectable` on the table | absent | `"true"` when the selection mode is `multiple` |
| `role` on the table | always `grid` | `treegrid` for a tree grid, `grid` otherwise |
| `aria-level`, `aria-posinset`, `aria-setsize` on a row | absent | set on every row of a tree grid |
| `aria-expanded` on a tree row | absent | set on a tree row that has children |
| `aria-expanded` on the tree toggle button | present | removed; the row carries it |
| the `role="status"` region | the loading label, else empty | one derived sentence: loading, the sort that changed, or the result summary. Silent on error. |
| a failed refresh with rows still on screen | nothing rendered | `GridStaleNotice`, a `role="alert"` banner above the table |

## New message keys

| Key | English | Plural |
| :--- | :--- | :--- |
| `a11y.sortedAscending` | `{column}, sorted ascending` | no |
| `a11y.sortedDescending` | `{column}, sorted descending` | no |
| `a11y.sortCleared` | `{column}, not sorted` | no |
| `a11y.rowsShown` | `Showing {from} to {to} of {total}` | no |
| `a11y.rowsShownUnknown` | `Showing {from} to {to} of many` | no |
| `a11y.rowsTotal` | `{count} rows` | yes |
| `error.stale` | `The rows could not be updated` | no |
| `error.staleDetail` | `Showing what was last loaded` | no |

All eight are required in `de`, `es`, `fr` and `pl` as well as `en`.

## New label members

```ts
export interface GridwrightLabels {
    // ...existing members unchanged...

    /** Announced after a sort control is activated. The column's header text, and the new state. */
    readonly sortAnnouncement: (column: string, direction: SortDirection | null) => string;

    /** Announced when a paginated result settles. Honours `exact`, exactly as `pageRange` does. */
    readonly rowsShown: (from: number, to: number, total: number, exact: boolean) => string;

    /** Announced when a virtualized result settles, where a from-to range means nothing. */
    readonly rowsTotal: (count: number) => string;

    /** Heading of the banner shown when a refresh failed and the previous rows are still shown. */
    readonly staleTitle: string;

    /** Its second line, saying which rows these are. */
    readonly staleMessage: string;
}
```

`SortDirection` is already exported from the core entry and re-exported from the React entry, so
no type in a new signature is unexported.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
