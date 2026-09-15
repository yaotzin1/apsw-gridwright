# API surface contract: column filtering

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: everything is added and optional. `columnFilters` defaults to false, so no existing grid
renders anything new. `GridwrightColumn.filter` and two class name slots are optional fields.
`GridwrightLabels` gains members, which a consumer receives and may partially override through
`Partial<GridwrightLabels>`; a consumer who built a complete `GridwrightLabels` object by hand would
need to add them, which is the same classification every previous label addition was given. Message
keys are additions, and a catalog without them falls back to English. No core type, default, event
payload or signature changes.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `ColumnFilterProvider` | `./react` | `(props: ColumnFilterProviderProps) => ReactElement` |
| `ColumnFilterTrigger` | `./react` | `(props: ColumnFilterTriggerProps) => ReactElement \| null` |
| `GridFilterClear` | `./react` | `(props: GridFilterClearProps) => ReactElement \| null` |
| `COLUMN_FILTER_OPERATORS` | `./react` | `Readonly<Record<ColumnFilterType, readonly FilterOperator[]>>` |
| `Gridwright.FilterProvider`, `Gridwright.FilterTrigger`, `Gridwright.FilterClear` | `./react` | attached parts |

Types added alongside them: `ColumnFilterType`, `ColumnFilterChoice`, `ColumnFilterOptions`,
`ColumnFilterProviderProps`, `ColumnFilterTriggerProps`, `GridFilterClearProps`.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridwrightColumn` | `cell`, `headerCell`, `icon`, `edit` | adds optional `filter` | minor |
| `GridwrightProps` | — | adds optional `columnFilters` | minor |
| `GridwrightLabels` | — | adds 11 labels, listed in `data-model.md` | minor |
| `GridwrightClassNames` | 16 slots | adds optional `filterTrigger`, `filterDialog` | minor |
| `MessageCatalog` / `MessageKey` | — | adds 30 keys, listed in `spec.md` §6 | minor; a catalog without them falls back to English |
| `GridHeader` | sort buttons | also renders a filter trigger per filterable column when inside a `ColumnFilterProvider` | minor; nothing renders without the provider |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `GridwrightProps.columnFilters` | — | `false` |
| `ColumnFilterOptions.type` | — | `text` |
| `ColumnFilterOptions.operators` | — | `COLUMN_FILTER_OPERATORS[type]` |

## Class names and data attributes introduced

Additive; no existing class is renamed.

`gw-filter-trigger`, `gw-filter-dialog`, `gw-filter-form`, `gw-filter-field`, `gw-filter-choices`,
`gw-filter-actions`, `gw-filter-clear-all`, and `data-filtered="true"` on a filtered
`gw-header-cell`.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
