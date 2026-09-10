# API surface contract: Tree data

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Semver classification

**minor — 0.3.0.** Everything is additive. A flat grid behaves exactly as before, and the one
engine addition is a new method.

## Core exports added

| Name | Signature |
| :--- | :--- |
| `buildTreeIndex` | `<TRow>(rows, shape: TreeShapeOptions<TRow>) => TreeIndex<TRow>` |
| `createTreeController` | `<TRow>(options: TreeControllerOptions<TRow>) => TreeController<TRow>` |
| `createTreeDataSource` | `<TRow>(source, controller) => DataSource<TreeNode<TRow>>` |
| `treePlugin`, `treePlugins` | `<TRow>(options: TreePluginOptions<TRow>) => GridPlugin<TreeNode<TRow>>[]` |
| `treeColumn`, `treeColumns` | rewrite a row column to read a node |
| `isAncestor`, `isSelfOrAncestor`, `descendantCount`, `isLeaf` | interval predicates |
| `descendantsOf`, `ancestorsOf` | index queries |
| `joinNodeId`, `encodeSegment`, `orderIndex`, `rowIdsOf` | helpers |
| `TREE_STAGE_ID` | `'core:tree'` |

Types: `NodeId`, `TreeNode`, `TreeIndex`, `TreeShapeOptions`, `TreeLoadState`, `TreeController`,
`TreeControllerOptions`, `TreeNodeState`, `TreeChange`, `TreeTarget`, `TreeDropPosition`,
`LoadChildrenContext`, `TreePluginOptions`.

## React exports added

| Name | Signature |
| :--- | :--- |
| `TreeGridwright` | `<TRow>(props: TreeGridwrightProps<TRow>) => JSX.Element` |
| `useTreeGridwright` | `<TRow>(options) => TreeGridwrightInstance<TRow>` |
| `TreeProvider`, `useTreeContext`, `useOptionalTreeContext`, `useNodeState` | context |
| `TreeCell`, `reactTreeColumns` | the indented cell and the column rewrite |
| `BubbleMenu`, `rowElement` | floating row actions |
| `InlineEditProvider`, `editableColumns`, `useInlineEdit`, `useInlineEditContext` | editing |

Types: `TreeGridwrightProps`, `TreeGridwrightInstance`, `UseTreeGridwrightOptions`,
`TreeContextValue`, `TreeProviderProps`, `TreeCellProps`, `BubbleMenuItem`, `BubbleMenuProps`,
`BubbleMenuTrigger`, `ColumnEditOptions`, `CommitEdit`, `EditorContext`, `InlineEditController`.

## Exports changed

| Name | Change | Impact |
| :--- | :--- | :--- |
| `GridApi` | gains `invalidatePipeline()` | additive for callers; **breaking for anyone implementing `GridApi` by hand**, which is not a supported thing to do |
| `UseGridwrightOptions` | gains optional `plugins` | additive |
| `GridwrightColumn` | gains optional `edit` | additive |
| `GridwrightLabels` | gains five tree labels | additive for consumers passing a partial `labels` |
| `MessageKey` | gains five `tree.*` keys | additive; a catalog without them falls back to English |

## Defaults introduced

| Option | Default | Consequence |
| :--- | :--- | :--- |
| `defaultExpandedDepth` | `0` | roots only |
| `maxDepth` | `64` | a guard, not a normal limit |
| `keepAncestorsOfMatches` | `true` | a match is shown with its folders |
| `treeColumnId` | first visible column | that column gets the indentation and toggle |
| `removeNode` scope | `'row'` | removes everywhere, not one edge |
| `BubbleMenu` trigger | `'both'` | hover and context menu |
| `edit.editable` | `true` when `edit` is present | but `edit` itself is opt-in per column |

## Verification

- [x] Every type in a new signature is exported
- [x] All three entry points resolve types for both module systems
- [x] `npm run check:exports` passes, and now asserts the tree names resolve from `dist`
- [x] The core bundle still contains no `react` import
- [x] `dependencies` is still empty
