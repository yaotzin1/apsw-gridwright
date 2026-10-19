# API surface contract: Refresh and expand indicators

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: three optional fields on `LoadingIndicatorOptions`. The defaults reproduce today's behaviour, so a grid that sets none renders as before.

## Exports added

None.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `LoadingIndicatorOptions` | no `refreshVariant`, `expandVariant`, `expandRows` | gains optional `refreshVariant?: 'dim' \| 'spinner' \| 'skeleton'`, `expandVariant?: 'none' \| 'spinner' \| 'skeleton'`, `expandRows?: number` | additive |

## Exports removed or deprecated

None.

## Defaults introduced or changed

`refreshVariant` defaults to `'dim'`, `expandVariant` to `'none'`, `expandRows` to `3`. `indicateRefresh` keeps its meaning and its default. Markup added only when the options are set: `.gw-refresh--centre`, `.gw-expand-loading`, and skeleton rows under a node.

## Type entry points

- [x] Every type appearing in a new signature is itself exported (the unions are inline)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
