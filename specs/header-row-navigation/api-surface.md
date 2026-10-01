# API surface contract: the header row in the cell cursor

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional input option, one new hook and one new constant. `includesHeader` is an
optional member of an interface the package produces, so no consumer's object literal stops
compiling. Nothing a grid that does not pass `headerRow` renders or does changes.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `useHeaderCellTabIndex` | `apsw-gridwright/react` | `() => -1 \| undefined` |
| `HEADER_ROW_ID` | `apsw-gridwright/react` | `'__gridwright_header_row__'`, the `rowId` of a cursor on the header |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `CellNavigationOptions` | no `headerRow` | `headerRow?: boolean` | minor |
| `CellNavigationController` | no `includesHeader` | `includesHeader?: boolean` | minor |
| `rowDataOf` | unwraps a tree placement | also unwraps a `grouping()` member row | minor (see `specs/grouping-and-aggregation`) |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | | |

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `cellNavigation({ headerRow })` | (new) | `false` |

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
