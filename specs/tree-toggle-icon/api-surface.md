# API surface contract: Tree toggle icon

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional option and one exported type. The default keeps the triangle; the only visible change to a consumer who sets nothing is that an open row's triangle now points down, which is what the stylesheet already claimed to do.

## Exports added

| Name | Kind | Entry |
| :--- | :--- | :--- |
| `TreeToggleIcon` | type: `'chevron' \| 'angle' \| 'square' \| 'circle' \| 'plusminus' \| ((state: { expanded: boolean; loading: boolean }) => ReactNode)` | `apsw-gridwright/react` |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `TreeDataOptions` | no `toggleIcon` | gains optional `toggleIcon?: TreeToggleIcon` | additive |
| `TreeContextValue` | no `toggleIcon` | gains `toggleIcon: TreeToggleIcon` | additive for readers; a consumer who builds the value by hand must add it (the provider supplies it) |
| `TreeProviderProps` | no `toggleIcon` | gains optional `toggleIcon?: TreeToggleIcon` | additive |

## Exports removed or deprecated

None.

## Defaults introduced or changed

`toggleIcon` defaults to `'chevron'`. Markup: the toggle gains `data-expanded`; the drawn mark's class names `gw-tree-angle`, `gw-tree-box`, `gw-tree-box--circle`, `gw-tree-box--bare`, `gw-tree-custom` are added.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
