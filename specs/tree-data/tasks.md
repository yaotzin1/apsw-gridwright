# Tasks: Tree data

Ordered by dependency. All complete.

## Core

- [x] **T-01** `tree/types.ts`: `TreeNode` with the interval, `TreeIndex`, `TreeShapeOptions`.
- [x] **T-02** `tree/nested-set.ts`: post-order interval assignment, both input shapes, escaped
      node ids, cycle detection on the path, unreached rows promoted to roots, interval predicates,
      binary-searched subtree slices.
- [x] **T-03** `tree/controller.ts`: normalised store, expansion, lazy children keyed on the row,
      optimistic mutations with a full-store snapshot for rollback.
- [x] **T-04** `tree/plugin.ts`: the source wrapper preserving synchronous fetches, and the stage
      that filters, searches, sorts and flattens while honouring capabilities.
- [x] **T-05** `tree/columns.ts`: rewriting a row column to read a node.
- [x] **T-06** Engine: `invalidatePipeline()`.

## Adapter

- [x] **T-07** `react/tree/context.tsx`: the provider, a revision counter, `useNodeState`.
- [x] **T-08** `react/tree/TreeCell.tsx`: indentation, the toggle, load and cycle notes, and the
      React half of the column rewrite.
- [x] **T-09** `react/tree/useTreeGridwright.ts` and `TreeGridwright.tsx`.
- [x] **T-10** `useGridwright` accepts a `plugins` set.
- [x] **T-11** `react/plugins/BubbleMenu.tsx`.
- [x] **T-12** `react/plugins/InlineEdit.tsx`, delegating persistence to the controller.
- [x] **T-13** Tree, menu and editor styles, using logical properties so RTL mirrors.

## i18n

- [x] **T-14** Five `tree.*` keys, five labels, four translated packs.

## Tests

- [x] **T-15** Unit: the nested set, both shapes, several parents, cycles, lazy marking, node id
      escaping (22 tests).
- [x] **T-16** Unit: the tree grid end to end, sorting, filtering, several parents, lazy loading,
      every mutation and every rollback (29 tests).
- [x] **T-17** React: expansion, keyboard reach, indentation, translation, search, lazy loading,
      several parents, the bubble menu, inline editing, building the tree (22 tests).
- [x] **T-18** Smoke: a tree from the built bundles, the interval helpers, the bubble menu.

## Documentation

- [x] **T-19** `docs/tree.md`.
- [x] **T-20** README, docs index, extensibility, plugins, DEPENDENCY_MAP, CHANGELOG.

## Stage 7 — Verification

- [x] `npm run verify` green end to end. Output in review.md.
