# API surface contract: an inline editor follows its record

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional field on `InlineEditProviderProps`, which is exported. No required field, no changed
signature, no renamed export. The observable behaviour change removes an editor that opened unasked and
cannot be something a consumer depends on.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| _(none)_ | | |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `InlineEditProviderProps` | `commit`, `children` | adds `readonly isPresent?: ((rowId: RowId) => boolean) \| null` | minor: optional |
| `useInlineEdit` | `(commit)` | `(commit, isPresent?)` | minor: optional second parameter |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| _(none)_ | | |

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| editor whose record left the settled result | stays in the state and reopens when the record returns | closes, writes nothing |

Not an option default but the one behavioural default that changes. Nothing a consumer's build, rows, events
or markup depends on is touched.

## Type entry points

- [x] Every type appearing in a new signature is itself exported (`RowId` from the core entry)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
