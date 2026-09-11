# Tree data

A grid where rows have children, children have children, and a row may sit under more than one
parent.

```tsx
import { Gridwright } from 'apsw-gridwright/react';

<Gridwright
    columns={columns}
    data={folders}
    tree={{
        getRowId: (row) => row.id,
        getChildren: (row) => row.children,
        defaultExpandedDepth: 1,
    }}
/>
```

The tree is an option on the grid, not a different component. Everything the flat grid does still
works: search, filter, sort, select, page, translate, theme. So does everything else that is an
option, including `virtual`, `rowActions` and `onCellEdit`. What changes is what those words mean on
a tree, and each difference is deliberate.

`TreeGridwright` is still exported and takes the tree options as top-level props. It is exactly
`<Gridwright tree={...} />` with no second implementation behind it.

## The model

The structure is a **nested set**. Every node carries an interval, `left` and `right`, and every
descendant's interval sits inside its ancestor's.

```
Documents        (1 ────────────────────────── 8)
  CV.pdf           (2 ── 3)
  Work             (4 ──────────────── 7)
    Plan.md          (5 ── 6)
Photos           (9 ── 12)
  Beach.jpg        (10 ── 11)
```

Three things follow, and they are why the model is worth the bookkeeping:

- **Ancestry is two comparisons.** `a.left < b.left && b.right < a.right`. No walk, no visited set.
- **Subtree size is arithmetic.** `(right - left - 1) / 2`, without touching a single child.
- **The order is already the render order.** Ascending `left` is a depth-first traversal, which is
  exactly the flat list a table draws.

Sorting siblings reorders the walk without touching the intervals, so a sort never invalidates an
ancestry check.

## Nodes and rows are different things

This is the one idea to carry into everything below.

A **row** is your data, identified by `getRowId`. A **node** is one *placement* of a row in the
tree, identified by a path-shaped `nodeId`. A row placed under two parents produces two nodes.

```
row 'ada' appears twice:

Engineering            nodeId 'eng'
  Ada                  nodeId 'eng/ada'      rowId 'ada'
    Toolchain          nodeId 'eng/ada/tool'
Design                 nodeId 'design'
  Ada                  nodeId 'design/ada'   rowId 'ada'
    Toolchain          nodeId 'design/ada/tool'
```

Both nodes hold the *same row object*, so:

| Acting on | Reaches |
| :--- | :--- |
| Editing the row | every placement, because there is one row |
| Expanding a node | that placement only |
| Selecting a row | that placement only, because grid row ids are node ids |
| Loading children | the row, so the second placement reuses the first one's fetch |

The grid's row type is therefore `TreeNode<TRow>`. Your columns and renderers keep receiving your
row: the unwrapping happens inside `useTreeGridwright`, so the decision does not leak into every
column definition.

Node ids escape the separator, so a row id containing a slash cannot collide with a path.

## Two input shapes

**Nested**, with children on the row:

```ts
{ id: 'docs', name: 'Documents', children: [{ id: 'cv', name: 'CV.pdf' }] }
```

```tsx
tree={{ getRowId: (row) => row.id, getChildren: (row) => row.children }}
```

**Flat**, with parents named on the row. This is the shape that can express several parents:

```ts
{ id: 'ada', name: 'Ada', parentIds: ['eng', 'design'] }
```

```tsx
tree={{ getRowId: (row) => row.id, getParentIds: (row) => row.parentIds }}
```

`getParentIds` also accepts a single id or `null`. A row naming a parent that is not in the data
becomes a root rather than disappearing, because a filtered or paginated slice of a tree routinely
arrives without its parents.

## Cycles

A "reports to" field pointing in a circle is not malformed input; it is Tuesday.

A row that already appears on its own path is placed once, marked `cyclic`, and not descended into.
The cell says so rather than silently rendering a leaf where the reader expects a subtree. A graph
that is *entirely* a cycle has no root at all, so unreached rows are promoted to roots: no row
vanishes because the data was circular.

## Lazy children

```tsx
<Gridwright
    columns={columns}
    data={roots}
    tree={{
        getRowId: (row) => row.id,
        hasChildren: (row) => row.type === 'folder',
        loadChildren: async ({ row, signal }) => api.children(row.id, { signal }),
    }}
/>
```

`hasChildren` is what draws a toggle on a node whose children have not arrived. `loadChildren` runs
on first expand.

- Loading is keyed on the **row**, so expanding a second placement reuses the first fetch.
- A failure shows on that node, in a `role="alert"`, and the node stays open so collapsing and
  re-expanding retries.
- The request carries an abort signal, and destroying the grid aborts what is in flight.

Eager and lazy are the same grid. Give it `getChildren` and it indexes what is there; give it
`loadChildren` and it fetches on demand; give it both and nested children are used where present.

## What the ordinary operations mean here

The tree replaces the filter, search and sort stages rather than joining them, because all three
mean something different on a tree.

**Filtering keeps the ancestors of a match.** A file with no folder above it tells the reader
nothing about where it lives. Ancestors are kept and shown, not counted as matches, and they are
opened whether or not the reader had opened them. Clearing the search restores the reader's own
expansion. Pass `keepAncestorsOfMatches={false}` for a flat result.

**Sorting orders siblings inside each parent.** Ordering the whole flat list would break the
nesting it is drawn from.

**The total counts visible nodes**, because that is the number the page controls have to describe.

**Capabilities still apply.** A facet the server resolved is not redone on the client. Flattening is
always local, because no server does it.

## Reaching the controller

Expansion, insertion, movement and removal all live on the tree controller. The grid owns it when
you enable the tree by prop, and hands it back:

```tsx
const [tree, setTree] = useState<TreeController<Folder> | null>(null);

<Gridwright columns={columns} data={folders} tree={{ getRowId, getChildren, controllerRef: setTree }} />;
```

It is called once with the controller and once with `null` when the grid unmounts, because the
controller's identity is stable for the life of the grid.

The other route is to own the instance yourself, which is the same grid:

```tsx
const grid = useTreeGridwright({ columns, data, getRowId, getChildren });

<Gridwright columns={columns} instance={grid} />;   // grid.tree is the controller
```

`<Gridwright instance={...} />` recognises a tree instance and supplies the tree context itself.
Owning the instance means owning the column wrapping: if you want inline editing there, wrap the
columns with `editableColumns` before handing them to the hook.

## Expansion

```tsx
grid.tree.toggle('docs/work');
grid.tree.expandAll(2);
grid.tree.collapseAll();
grid.tree.getExpandedNodeIds();          // persist these
grid.tree.setExpandedNodeIds(saved);     // and restore them
```

Toggling recomputes the pipeline and does **not** refetch. Expanding changes what is shown, not
what was fetched, and a network round trip to answer a question the client can already answer is
one the reader waits for.

## Editing and building the tree

Every mutation is optimistic with rollback. It applies to the local tree immediately, calls the
`onCommit` you supply, and if that rejects it restores the tree exactly as it was and records the
error on the row. A half-applied move is worse than a refused one, because the reader cannot tell
which half survived.

```tsx
tree={{
    ...,
    onCommit: async (change) => {
        switch (change.type) {
            case 'update': return api.save(change.rowId, change.row);
            case 'insert': return api.create(change.row, change.parentRowId, change.index);
            case 'move':   return api.reparent(change.rowId, change.toParentRowId, change.index);
            case 'remove': return api.delete(change.rowId);
        }
    },
}}
```

Omit `onCommit` and edits stay in memory, which is the right default for an array. What to store,
and why the nested set is not part of it, is in [persistence](persistence.md).

```ts
await grid.tree.updateRow('cv', { name: 'Resume.pdf' });

await grid.tree.insertRow(newRow, { referenceNodeId: 'docs', position: 'child' });
await grid.tree.insertRow(newRow, { referenceNodeId: 'docs/cv', position: 'after' });
await grid.tree.insertRow(newRow, { position: 'child' });          // a new root

await grid.tree.moveNode('docs/cv', { referenceNodeId: 'photos', position: 'child' });

await grid.tree.removeNode('docs/cv');                              // the row, everywhere
await grid.tree.removeNode('eng/ada', { scope: 'placement' });      // one edge only
```

Two behaviours worth knowing. Inserting as a child opens the parent, because a new row hidden
inside a collapsed folder reads as a failed insert. And a move into a node's own subtree is
refused, because it detaches that subtree from the tree entirely and the rows do not move, they
vanish.

`scope: 'placement'` is the difference between taking a file out of one folder and deleting it.
It only matters when a row has several parents.

## Inline editing

Editing is opt-in per column. A grid where every cell turns into a text box on click is a grid
nobody can read.

```tsx
const columns = [
    { id: 'name', header: 'Name', edit: { editable: true } },
    { id: 'size', header: 'Size', edit: { editable: true, inputType: 'number' } },
    { id: 'owner', header: 'Owner', edit: { editable: (row) => row.mine, inputType: 'select',
        choices: [{ value: 'ada', label: 'Ada' }] } },
    { id: 'createdAt', header: 'Created' },     // no `edit`: read-only
];

<Gridwright
    columns={columns}
    data={folders}
    tree={{ getRowId, getChildren, controllerRef: setTree }}
    onCellEdit={(rowId, columnId, value) => tree?.updateRow(rowId, { [columnId]: value })}
/>;
```

One prop switches editing on; `edit` on a column decides which cells it applies to. The `rowId` the
commit receives is the row's own id, shared by every placement of it, not the placement's node id,
so editing a row under one parent edits it under all of them. That is the same row.

`editableColumns` and `InlineEditProvider` are still exported for a layout composed by hand, and
`onCellEdit` is that pair already wired.

The provider owns which cell is open and what is in flight. It owns no row data: applying and
reverting is the controller's job, which already does optimistic updates with rollback. Two
implementations of that would be two behaviours to keep in step.

- **Enter** commits, **Escape** cancels, **blur commits**. Losing text because you clicked away is
  the single most complained-about behaviour in an editable grid.
- The trigger is a real `<button>`, so an editable cell is reachable by Tab and announced as
  activatable.
- A rejected edit reverts and the message appears on the row in a `role="alert"`.
- `editor` replaces the input entirely for a custom control.

## Bubble menu

A floating menu of row actions.

```tsx
<Gridwright
    ...
    rowActionsTrigger="both"
    rowActions={[
        { id: 'add', label: 'Add child', onSelect: (row) =>
            tree?.insertRow(blank(), { referenceNodeId: String(row.id), position: 'child' }) },
        { id: 'sibling', label: 'Add sibling', onSelect: (row) =>
            tree?.insertRow(blank(), { referenceNodeId: String(row.id), position: 'after' }) },
        { id: 'delete', label: 'Delete', destructive: true, separatorBefore: true,
          hidden: (row) => row.data.depth === 0,
          onSelect: (row) => tree?.removeNode(String(row.id)) },
    ]}
/>
```

`rowActions` works on any grid, tree or not. On a tree the `row` an item receives is the grid row
whose `data` is the node, so `row.id` is the placement's node id, which is what the controller's
operations take. For the row inside it, `rowDataOf` handles both shapes, so one menu keeps working
when the tree is switched off:

```tsx
import { rowDataOf } from 'apsw-gridwright/react';

{ id: 'open', label: 'Open', onSelect: (row) => open(rowDataOf<File>(row).path) }
```

`rowActionsTrigger` decides what opens it: `both` by default, which is a hover to preview it, a left
click to pin it, and a right-click or the context-menu key to pin it as well. A click that lands on
a button, a link or a field is left alone, because that click belongs to the control it landed on.
A pinned menu closes on Escape, on a click elsewhere, or when an item is chosen.

The menu is the exported `BubbleMenu`, rendered inside the grid's providers. It appears beside the
pointer, on the row the pointer is over, clamped to stay inside the grid; reached by keyboard it
goes to the row's trailing edge instead, since there is no pointer to be near. It is placed once per
row rather than following the pointer continuously, because a menu that slides while you approach it
is a menu you cannot click. One measurement of its own width is the whole of its positioning: no
portal and no measurement library.

Every item is a real button inside a `role="menu"`, and the menu opens on focus as well as hover,
so it is reachable without a mouse. A hover-only menu is decoration that some people cannot use.
`trigger` accepts `hover`, `contextmenu` or `both`; the context-menu trigger pins the menu open and
moves focus into it, and arrow keys move between items.

This is where "build the tree" comes together: the menu supplies the actions, the controller
performs them, and `onCommit` persists them.

## Composing it yourself

```tsx
const grid = useTreeGridwright({ columns, data, getRowId, getChildren });

<TreeProvider controller={grid.tree} treeColumnId={grid.treeColumnId}>
    <GridwrightProvider instance={grid}>
        <BubbleMenu items={actions} />
        <GridTable aria-label="Files">
            <GridHeader />
            <GridBody />
        </GridTable>
        <GridPagination />
    </GridwrightProvider>
</TreeProvider>
```

`<Gridwright tree={...} />` is exactly this arrangement, with `GridVirtualBody` in place of
`GridBody` when `virtual` is on.

## A tree with everything else on

Nothing here is exclusive with the rest of the grid:

```tsx
<Gridwright
    columns={columns}
    data={folders}
    tree={{ getRowId, getChildren, controllerRef: setTree }}
    virtual={{ rowHeight: 40, height: 480 }}
    rowActions={actions}
    onCellEdit={commit}
    searchable
    selectionMode="multiple"
/>
```

Virtualization over a tree windows the *visible* nodes, which is what the tree stage already
produces: collapse a node and the count drops, along with the scrollbar. See
[virtualization](virtualization.md).

## Without React

The nested set, the controller and the flattening stage are core, so a tree grid is an ordinary grid
whose rows are nodes. Nothing about it needs an adapter:

```ts
const controller = createTreeController({ getRowId: (row) => row.id, getChildren: (row) => row.children });

const api = createGridEngine({
    // Rewrites a column written against your row so it reads a node instead.
    columns: treeColumns(myColumns),
    dataSource: createTreeDataSource(createLocalDataSource(rows), controller),
    plugins: treePlugins({ controller }),
    getRowId: (node) => node.nodeId,
});

controller.subscribe(() => api.invalidatePipeline());
```

`state.rows` then carries `TreeNode`s: `depth` for indentation, `nodeId` for the toggle,
`row` for your own data. `invalidatePipeline` rather than `refresh` because expanding a node changes
what is shown, not what was fetched, and a network round trip to answer a question the client can
already answer is one the reader waits for.

None of this is React: the nested set, the controller and the flattening stage are all core, and
what the adapter adds is the markup, not the hierarchy.

## Working with the index directly

The nested set is exported, with no React and no grid attached:

```ts
import { buildTreeIndex, descendantsOf, ancestorsOf, isAncestor, descendantCount } from 'apsw-gridwright';

const index = buildTreeIndex(rows, { getRowId: (row) => row.id, getChildren: (row) => row.children });

index.nodes;                        // depth-first order
index.placementsByRowId.get('ada'); // ['eng/ada', 'design/ada']
index.hasMultipleParents;
index.cyclicNodeIds;

descendantsOf(index, 'docs');       // a contiguous slice, found by binary search
ancestorsOf(index, 'docs/work/plan');
descendantCount(index.byNodeId.get('docs')!);
```

## Not included

- **No variable row heights under `virtual`.** Virtualization is fixed-height arithmetic, so a tree
  row that wraps onto two lines overflows its slot. Lazy children keep the list short; a measuring
  virtualizer is a different piece of work.
- **No drag and drop.** `moveNode` is the operation; wiring a drag source to it is an application's
  choice of library and pointer semantics.
- **No checkbox cascade.** Selecting a parent does not select its descendants. Both behaviours are
  defensible, so the grid does not pick: `descendantsOf` plus `setSelectedIds` is three lines.
- **No server-side flattening.** The client flattens, always. A server that returns a
  pre-flattened tree with depth columns is a shape this does not read yet.
