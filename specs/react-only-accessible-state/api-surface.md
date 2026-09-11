# API surface contract: React-only surface, accessible grid state

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning. Six message keys and three label entries are added, and `messages.ts` records that
adding a key is a minor. No exported name is removed, no signature changes, and no entry point
moves, so nothing a consumer imports stops resolving. The rendered ARIA output changes, which is
not in the repository's major-change table (a signature, a default, or an emitted event payload)
and is classified as a fix, but it is called out below because a consumer asserting on the old
attribute values will see those assertions fail.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| — | — | No new exported name. The new modules under `src/react/a11y/` are internal and reached through `Gridwright.Root`, which is already exported. |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridwrightLabels` | 21 members | 24 members: adds `sortAnnouncement`, `rowsShown`, `rowsTotal` | minor. The prop is `Partial<GridwrightLabels>`, so no consumer object becomes invalid. A consumer who built a complete `GridwrightLabels` by hand, rather than spreading `defaultLabels`, has three members to add. |
| `MessageKey` | 22 keys | 28 keys | minor, as recorded in `messages.ts`. A catalogue missing the new keys falls back to English rather than breaking. |
| `defaultLabels` | `GridwrightLabels` | unchanged type, three more members | minor |

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
| the `role="status"` region | the loading label, else empty | one derived sentence: loading, error, the sort that changed, or the result summary |

## New message keys

| Key | English | Plural |
| :--- | :--- | :--- |
| `a11y.sortedAscending` | `{column}, sorted ascending` | no |
| `a11y.sortedDescending` | `{column}, sorted descending` | no |
| `a11y.sortCleared` | `{column}, not sorted` | no |
| `a11y.rowsShown` | `Showing {from} to {to} of {total}` | no |
| `a11y.rowsShownUnknown` | `Showing {from} to {to} of many` | no |
| `a11y.rowsTotal` | `{count} rows` | yes |

All six are required in `de`, `es`, `fr` and `pl` as well as `en`.

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
}
```

`SortDirection` is already exported from the core entry and re-exported from the React entry, so
no type in a new signature is unexported.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
