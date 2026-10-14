# API surface contract: Tree path in the cell context

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional field on `CellContext`, declared from the tree add-on rather than in the base type, so the base type does not know about trees. A consumer that ignores it sees no difference.

## Exports added

None. `TreeNode` is already exported.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `CellContext` | `value, row, rowId, rowIndex, column, api` | gains optional `node?: TreeNode<TRow>`, declared by the tree add-on's module augmentation (as `edit` and `filter` are on a column), set by `treeData()` | additive |

## Exports removed or deprecated

None.

## Defaults introduced or changed

None.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
