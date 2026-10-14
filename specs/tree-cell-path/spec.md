# Specification: Tree path in the cell context

> **Status**: Draft
> **Stage entry**: 1
> **Semver impact**: minor (provisional; confirmed in api-surface.md)

---

## 1. The consumer problem

In a tree grid, a column renderer receives `CellContext` with `row` and `rowId` only. `reactTreeColumns`
unwraps the `TreeNode` before calling the consumer, so the placement the cell stands in is lost.

That matters because one row may sit under several parents. A cell that needs "where am I" (a
breadcrumb, a "part of: ..." marker, an indented label of its own) cannot ask the tree, since
`rowId` is shared by every placement. Today the only workaround is to scan the visible rows for the
nearest higher row one level up, which is fragile: it depends on what is visible (filtering,
paging, windowing) and not on the tree.

## 2. User stories

- **US-01.** As a developer rendering a tree column, I get the tree node of the placement in the cell
  context, so I do not reconstruct its path from the visible rows.
- **US-02.** As a developer whose row appears under several parents, I can tell which placement a
  cell belongs to.
- **US-03.** As a developer with a flat grid, nothing changes.

## 3. Acceptance criteria

- [ ] AC-01 `cell` and `icon` of a column in a tree grid receive `context.node`, the `TreeNode` of the placement.
- [ ] AC-02 Two placements of one row get different nodes (`nodeId`, `rowPath`) in the same render.
- [ ] AC-03 `node.rowPath` is the path from the root to the cell's row, unchanged by filter, page or windowing.
- [ ] AC-04 `context.node` is `undefined` in a grid without `treeData()`.
- [ ] AC-05 `context.row` and `context.rowId` still hold the consumer's row and row id.

## 4. Non-goals

- A backend-supplied parent name for roots that are also someone's child. That is data the
  package does not have; it stays a business and backend question.
- Changing how ancestry is computed inside the engine.
- Derived fields such as an ancestors array. The node carries `rowPath`, `parentNodeId` and `depth`;
  anything further is the consumer's to compute.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | the path comes from the tree index; unchanged by sort and filter |
| everything (server) | same; the index is built from the rows the source returned |
| pagination only | `rowPath` lists the ids of the path as the index knows it |

## 6. Accessibility and interface copy

No new control, no new string.

## 7. Delivery as a plugin

React add-on only: `treeData()` supplies the value through `reactTreeColumns`. The engine already
holds everything needed (`TreeNode`), so no core change.

## 8. Clarifications

- `node` is declared on `CellContext` by the tree add-on through module augmentation, the way `edit` and `filter` reach a column, so `CellContext` itself stays free of tree types. It is optional so that flat grids and every existing implementation of the
  type keep compiling. It is the existing `TreeNode`, already a public type.

## Artifacts not written

- `data-model.md`: no new state.
- `events.md`: no event and no pipeline stage.
- `research.md`: the design follows from reading `TreeNode` and `reactTreeColumns`.
- `plan.md`: one optional field set in one existing function; the plan is the api-surface table.
- `tasks.md`: three edits (type, `reactTreeColumns`, tests) with docs; nothing to sequence.
