# API surface contract: a row menu that leaves the click to selection

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: a new member of a union that is only ever an input (`rowActions({ trigger })`,
`useBubbleMenu(trigger)`, `<BubbleMenu trigger>`). Every value a consumer passes today means what it
meant. Nothing the package returns has this type, so no consumer's exhaustive `switch` meets the new
member unless they wrote one over their own values.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| — | | |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `BubbleMenuTrigger` | `'hover' \| 'click' \| 'contextmenu' \| 'both'` | `'hover' \| 'click' \| 'contextmenu' \| 'hover-contextmenu' \| 'both'` | minor |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | | |

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| — | | |

## Type entry points

- [x] Every type appearing in a new signature is itself exported (`BubbleMenuTrigger` already is)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
