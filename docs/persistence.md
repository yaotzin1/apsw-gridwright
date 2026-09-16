# Storing what the reader changes

Editing in place and mutating a tree are optimistic: the grid applies the change immediately, calls
you, and reverts exactly if you reject it. This page is about the middle part, where the change
reaches a database.

Three callbacks, each passed to an add-on, and they are the whole surface:

| Callback | Fires for | Gets |
| :--- | :--- | :--- |
| `inlineEditing({ commit })` | one edited cell, on any grid | the row's own id, the column, the new value |
| `treeData({ onCommit })` | edits, inserts, moves and removals in a tree | a discriminated union describing the change |
| `columnLayout({ onChange })` | a column resized, pinned or hidden | the whole layout, as JSON |

All three are add-ons, listed in `addons`; see [add-ons](addons.md). The first two carry the
reader's data and belong in your database; the third carries their preferences, and usually belongs
in `localStorage` or a per-user settings row.

## One edited cell

```tsx
import { Gridwright, inlineEditing } from 'apsw-gridwright/react';

<Gridwright
    columns={columns}
    dataSource={people}
    addons={[
        inlineEditing({
            commit: async (rowId, columnId, value) => {
                const response = await fetch(`/api/people/${encodeURIComponent(String(rowId))}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [columnId]: value }),
                });
                if (!response.ok) throw new Error((await response.json()).message);

                people.invalidate();   // the rows the grid holds are now stale
            },
        }),
    ]}
/>
```

Which cells open an editor is decided per column, by `edit`; the add-on only switches editing on and
says where a committed value goes.

`rowId` is the row's own id, the one `getRowId` returns. In a tree it is shared by every placement
of that row, so editing a row under one parent edits it under all of them, because it is one row.

**Throw to refuse.** In a tree, `commit` is usually `controller.updateRow(rowId, { [columnId]: value })`,
and the controller then does the optimistic part: it applies the edit, calls the tree's `onCommit`,
and on a rejection reverts the row and shows the message on it. On a flat grid nothing is applied
optimistically in the first place, so the value the source next returns is
what the reader sees, which is why the source is invalidated rather than patched locally: a local
patch and a later refetch disagreeing is how a grid starts lying.

## A tree

`onCommit` receives one of four shapes, each already carrying what a statement needs:

```ts
{ type: 'update', rowId, row, previous }
{ type: 'insert', rowId, row, parentRowId, index }
{ type: 'move',   rowId, fromParentRowId, toParentRowId, index }
{ type: 'remove', rowId, row, parentRowId, scope: 'row' | 'placement' }
```

```tsx
treeData({
    getRowId: (row) => row.id,
    getParentIds: (row) => row.parentId,
    onCommit: async (change) => {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change),
        });
        if (!response.ok) throw new Error((await response.json()).message);
    },
})
```

With inline editing on a tree, route the cell's `commit` through the controller so that an edited
cell and an inserted row arrive at the same `onCommit`:

```tsx
const [tree, setTree] = useState<TreeController<File> | null>(null);

addons={[
    treeData({ getRowId, getParentIds, onCommit, controllerRef: setTree }),
    inlineEditing({ commit: (rowId, columnId, value) => tree?.updateRow(rowId, { [columnId]: value }) }),
]}
```

The playground does exactly this. Its "Stored on the server" shape posts every change to the mock
API, which keeps the tree in memory; add something and reload the page and it is still there.

### What to store

**Store the adjacency list.** One row per node, naming its parent and its position among its
siblings:

```sql
create table files (
    id        text primary key,
    parent_id text references files(id) on delete cascade,
    position  integer not null,
    name      text not null
);
create index on files (parent_id, position);
```

Every change is then one statement, and the payload above is already shaped for it:

| Change | Statement |
| :--- | :--- |
| `update` | `update files set name = ... where id = ...` |
| `insert` | `insert into files ...`, then shift later siblings by one |
| `move` | `update files set parent_id = ..., position = ...`, then renumber both parents |
| `remove` | `delete from files where id = ...`, cascading or by subtree, then renumber |

**Do not store the nested set.** The `left` and `right` intervals the grid works with are derived:
they are a property of the whole tree, and every insert rewrites half of them. The client rebuilds
them from the adjacency list in one pass, which is what `buildTreeIndex` does. Nested set columns in
a table buy fast subtree queries at the cost of rewriting the table on every write; if you need
those queries, a closure table costs less to maintain. Either way the grid does not care: it wants
rows with parents.

**A row with several parents needs an edge table**, since a `parent_id` column cannot hold two. The
grid's flat shape maps onto it directly: `getParentIds` returns the edges for that row, and
`remove` with `scope: 'placement'` deletes one edge rather than the row.

```sql
create table file_parents (
    child_id  text references files(id) on delete cascade,
    parent_id text references files(id) on delete cascade,
    position  integer not null,
    primary key (child_id, parent_id)
);
```

### Refuse what you cannot store

A refusal is a first-class outcome, not an error path to be tidied away later. Two worth writing
down:

- **A move into a node's own subtree** detaches that subtree from the tree entirely. The grid
  refuses it before calling you, but a server that trusts its clients loses rows, so refuse it there
  too.
- **A stale parent.** The reader's tree can be older than the table. Answer `409`, and the grid puts
  the row back where it was.

## Sending the whole tree

There is no "serialise the grid" call, deliberately. The rows are yours: you passed them in, and the
tree the grid holds is an index over them, not a copy with extra state. If you want the current
shape as data, ask the controller `controllerRef` handed you:

```ts
const index = controller.getIndex();
const rows = index.nodes.map((node) => ({
    id: node.rowId,
    parentId: node.parentNodeId ? index.byNodeId.get(node.parentNodeId)?.rowId ?? null : null,
    ...node.row,
}));
```

That is the adjacency list again, which is the point: the shape you would store is the shape you
already had. Sending the whole tree on every change is worth avoiding anyway, since it turns a
one-row update into a full rewrite and makes two people editing at once impossible to reconcile.

## The reader's own layout

Column widths, pinning and visibility are not data, so they are not optimistic and there is nothing
to revert. `onChange` hands you a plain object and `initial` takes it back:

```tsx
import { Gridwright, columnLayout } from 'apsw-gridwright/react';

const [saved] = useState(() => {
    try {
        const stored = localStorage.getItem('people-grid-layout');
        return stored ? JSON.parse(stored) : undefined;
    } catch {
        // Private browsing, or site data switched off. A grid with default columns is fine.
        return undefined;
    }
});

<Gridwright
    columns={columns}
    dataSource={source}
    addons={[
        columnLayout({
            initial: saved,
            onChange: (layout) => localStorage.setItem('people-grid-layout', JSON.stringify(layout)),
        }),
    ]}
/>;
```

`onChange` is not called on mount, so the handler above cannot overwrite a saved layout with the
default one on every page load, and not during a drag, so one gesture is one write. `initial` is read
field by field and anything of the wrong type is dropped, which is what makes it safe to hand it
whatever `JSON.parse` returned. See [column layout](column-layout.md#saving-the-layout).

Against a settings endpoint rather than `localStorage`, debounce it: a reader dragging four column
edges produces four calls, and four requests where one would do.

## What is not handled for you

- **Conflicts between two readers.** The grid has one client's view. Version columns, `If-Match` or
  a last-write-wins policy are decisions about your data, not about a table component.
- **Batching.** Each change is one call. If a reader can move twenty rows at once, collect the
  changes yourself and send them together; the grid will not do it behind your back, because it
  cannot know which of them belong in one transaction.
- **Undo.** `update` carries `previous` and `remove` carries the row, so the information is there,
  but the stack is yours.
