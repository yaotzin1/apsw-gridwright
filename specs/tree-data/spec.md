# Specification: Tree data

> **Status**: Implemented
> **Stage entry**: 1
> **Semver impact**: minor (0.3.0). Additive; every flat grid behaves exactly as before.

---

## 1. The consumer problem

Hierarchies are the commonest shape of business data that a flat grid cannot show: folders,
org charts, categories, bills of materials, account trees. Building one on top of a flat grid means
flattening by hand on every render, tracking expansion outside the grid, and reimplementing what
filtering and sorting mean once nesting exists.

The requested model was a nested set, with the additional requirement that a row be able to sit
under several parents. Those two are mutually exclusive as literally stated, which §7 resolves.

## 2. User stories

- **US-01.** As a developer with nested rows, I pass `getChildren` and get an expandable grid.
- **US-02.** As a developer with flat rows naming their parents, I pass `getParentIds` instead.
- **US-03.** As a developer whose data is a graph, a row under two parents appears under both, and
  editing it once updates both.
- **US-04.** As a developer with 200,000 nodes, children arrive when a node is first expanded.
- **US-05.** As a person reading a grid, searching shows matches with the folders they live in.
- **US-06.** As a person reading a grid, sorting orders siblings and does not shuffle the nesting.
- **US-07.** As a person editing, a cell opens in place, Enter saves, Escape cancels, and a refused
  save puts the old value back and tells me why.
- **US-08.** As a person editing, I add a child, add a sibling and move a row, all from a menu on
  the row.
- **US-09.** As a keyboard user, every one of the above is reachable without a mouse.

## 3. Acceptance criteria

- [x] AC-01 Ancestry is two comparisons on the interval, with no walk.
- [x] AC-02 Subtree size is `(right - left - 1) / 2`.
- [x] AC-03 The node array is in ascending `left`, which is render order.
- [x] AC-04 A row under N parents produces N nodes sharing one row object.
- [x] AC-05 Expanding one placement does not expand another.
- [x] AC-06 Editing a row reaches every placement.
- [x] AC-07 A cyclic path is placed once, marked, and not descended into.
- [x] AC-08 A graph that is entirely a cycle still renders every row.
- [x] AC-09 A row whose named parent is absent becomes a root.
- [x] AC-10 Lazy children load on first expand, keyed on the row.
- [x] AC-11 A failed load shows on the node and leaves it expanded.
- [x] AC-12 Filtering keeps and opens the ancestors of a match; clearing restores expansion.
- [x] AC-13 Sorting orders siblings within each parent only.
- [x] AC-14 The reported total counts visible nodes.
- [x] AC-15 Toggling expansion recomputes without refetching.
- [x] AC-16 Every mutation is optimistic and reverts completely on rejection.
- [x] AC-17 A move into a node's own subtree is refused.
- [x] AC-18 The bubble menu is a `role="menu"` of buttons, reachable by keyboard.
- [x] AC-19 An editable cell is a real button; Enter commits, Escape cancels, blur commits.
- [x] AC-20 An in-memory tree renders synchronously, with no loading state.

## 4. Non-goals

- **No virtualization.** A fully expanded tree is still a long list. Lazy children or server paging
  is the answer, and neither is made easier by windowing the DOM.
- **No drag and drop.** `moveNode` is the operation. Wiring a drag source to it is a choice of
  library and pointer semantics that belongs in an application.
- **No cascading selection.** Selecting a parent does not select its subtree. Both behaviours are
  defensible, so the grid picks neither; `descendantsOf` plus `setSelectedIds` is three lines.
- **No server-side flattening.** A server that returns a pre-flattened tree with a depth column is
  a shape this does not read. The client always builds the index.
- **No closure table.** Considered and rejected; see research.md.

## 5. Behaviour across the capability seam

| Source resolves | Tree behaviour |
| :--- | :--- |
| nothing (local array) | The stage filters, searches, sorts and flattens. Synchronous, so no loading state. |
| filter and sort | The stage skips both and only flattens. |
| everything | The stage only flattens, because no server does that. |
| pagination | The page of rows becomes the tree. A page of roots is a legitimate mode. |

Flattening is never skipped: it is display logic, not a query facet.

## 6. Accessibility and interface copy

The toggle is a real `<button>` with `aria-expanded` and a label that names the action. Indentation
is padding on a spacer, not nested markup, so the table stays one cell per column and a screen
reader still reads a grid. Expanded nodes announce their child count through a visually hidden
element. The bubble menu opens on focus as well as hover. An editable cell is a button. Five new
message keys, translated in all five bundled locales.

## 7. Clarifications

- **Nested set with several parents?** Resolved as *placements*. Nested set encodes a strict tree,
  so a row placed twice becomes two nodes with two intervals, sharing one row object. Confirmed
  with the requester before implementation.
- **Where does expansion live?** In the controller, outside React and outside grid state, because
  it is neither a query facet nor something a server needs.
- **What identifies a grid row in a tree?** The node id, not the row id. Two placements otherwise
  share a React key and a selection.
- **Does the tree join the flat stages or replace them?** Replaces. Filtering, searching and sorting
  all mean something different once nesting exists.
- **Where do edits persist?** Optimistic locally, then `onCommit`, reverting completely on
  rejection. Confirmed with the requester.
