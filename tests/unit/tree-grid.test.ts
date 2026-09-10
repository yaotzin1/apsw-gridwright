import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import { createTreeController } from '../../src/tree/controller';
import { createTreeDataSource, treePlugins } from '../../src/tree/plugin';
import { treeColumns } from '../../src/tree/columns';
import type { GridApi } from '../../src/core/types';
import type { TreeController } from '../../src/tree/controller';
import type { TreeNode } from '../../src/tree/types';

interface Item {
    id: string;
    name: string;
    size: number;
    children?: Item[];
}

const tree: Item[] = [
    {
        id: 'docs',
        name: 'Documents',
        size: 0,
        children: [
            { id: 'cv', name: 'CV.pdf', size: 220 },
            {
                id: 'work',
                name: 'Work',
                size: 0,
                children: [
                    { id: 'plan', name: 'Plan.md', size: 12 },
                    { id: 'notes', name: 'Notes.md', size: 4 },
                ],
            },
        ],
    },
    { id: 'photos', name: 'Photos', size: 0, children: [{ id: 'beach', name: 'Beach.jpg', size: 3400 }] },
];

const columns = treeColumns<Item>([
    { id: 'name', header: 'Name' },
    { id: 'size', header: 'Size' },
]);

function makeTreeGrid(
    rows: readonly Item[] = tree,
    controllerOptions: Partial<Parameters<typeof createTreeController<Item>>[0]> = {},
): { api: GridApi<TreeNode<Item>>; controller: TreeController<Item> } {
    const controller = createTreeController<Item>({
        getRowId: (row) => row.id,
        getChildren: (row) => row.children,
        ...controllerOptions,
    });

    const api = createGridEngine<TreeNode<Item>>({
        columns,
        dataSource: createTreeDataSource(createLocalDataSource(rows), controller),
        getRowId: (node) => node.nodeId,
        initialQuery: { pagination: { pageIndex: 0, pageSize: 100 } },
        plugins: treePlugins({ controller }),
    });

    return { api, controller };
}

const visible = (api: GridApi<TreeNode<Item>>): (string | number)[] =>
    api.getState().rows.map((row) => row.data.rowId);

describe('rendering a tree', () => {
    it('shows only the roots until something is expanded', () => {
        const { api } = makeTreeGrid();
        expect(visible(api)).toEqual(['docs', 'photos']);
        expect(api.getState().totalRows).toBe(2);
        api.destroy();
    });

    it('reveals children on expand and hides them again on collapse', () => {
        const { api, controller } = makeTreeGrid();

        controller.expand('docs');
        expect(visible(api)).toEqual(['docs', 'cv', 'work', 'photos']);

        controller.expand('docs/work');
        expect(visible(api)).toEqual(['docs', 'cv', 'work', 'plan', 'notes', 'photos']);

        controller.collapse('docs');
        expect(visible(api)).toEqual(['docs', 'photos']);
        api.destroy();
    });

    it('counts only visible nodes as the total, because that is what the page controls describe', () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('does not refetch when expansion changes', () => {
        const source = createLocalDataSource<Item>(tree);
        const fetchSpy = vi.spyOn(source, 'fetch');
        const controller = createTreeController<Item>({
            getRowId: (row) => row.id,
            getChildren: (row) => row.children,
        });
        const api = createGridEngine<TreeNode<Item>>({
            columns,
            dataSource: createTreeDataSource(source, controller),
            getRowId: (node) => node.nodeId,
            plugins: treePlugins({ controller }),
        });

        fetchSpy.mockClear();
        controller.expand('docs');
        // Expanding changes what is shown, not what was fetched. Asking the server again would be
        // a network round trip to answer a question the client already has the data for.
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(visible(api)).toContain('cv');
        api.destroy();
    });

    it('carries depth and interval on each rendered row', () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();

        const rows = api.getState().rows;
        expect(rows.map((row) => row.data.depth)).toEqual([0, 1, 1, 2, 2, 0, 1]);
        expect(rows[0]!.data.hasChildren).toBe(true);
        expect(rows[1]!.data.hasChildren).toBe(false);
        api.destroy();
    });

    it('expands to a starting depth', () => {
        const { api } = makeTreeGrid(tree, { defaultExpandedDepth: 1 });
        expect(visible(api)).toEqual(['docs', 'cv', 'work', 'photos', 'beach']);
        api.destroy();
    });

    it('gives each rendered row the node id, not the row id', () => {
        const { api, controller } = makeTreeGrid();
        controller.expand('docs');
        expect(api.getState().rows.map((row) => row.id)).toEqual(['docs', 'docs/cv', 'docs/work', 'photos']);
        api.destroy();
    });
});

describe('sorting a tree', () => {
    it('orders siblings within each parent and leaves the nesting alone', () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();

        api.toggleSort('name');
        expect(visible(api)).toEqual(['docs', 'cv', 'work', 'notes', 'plan', 'photos', 'beach']);

        api.toggleSort('name');
        expect(visible(api)).toEqual(['photos', 'beach', 'docs', 'work', 'plan', 'notes', 'cv']);
        api.destroy();
    });

    it('keeps every child under its own parent', () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();
        api.toggleSort('size');

        const rows = api.getState().rows;
        for (const row of rows) {
            if (row.data.parentNodeId === null) continue;
            const parentPosition = rows.findIndex((entry) => entry.data.nodeId === row.data.parentNodeId);
            expect(parentPosition).toBeGreaterThanOrEqual(0);
            expect(parentPosition).toBeLessThan(rows.indexOf(row));
        }
        api.destroy();
    });
});

describe('filtering and searching a tree', () => {
    it('keeps the ancestors of a match, so a match has context', () => {
        const { api } = makeTreeGrid();
        api.setSearch('plan');

        // Without the ancestors this is a file with no folder above it, and the reader cannot tell
        // where it lives.
        expect(visible(api)).toEqual(['docs', 'work', 'plan']);
        api.destroy();
    });

    it('opens the ancestors it kept, whether or not the reader had expanded them', () => {
        const { api, controller } = makeTreeGrid();
        controller.collapseAll();
        api.setSearch('beach');
        expect(visible(api)).toEqual(['photos', 'beach']);
        api.destroy();
    });

    it('restores the reader expansion when the search is cleared', () => {
        const { api, controller } = makeTreeGrid();
        controller.expand('docs');

        api.setSearch('beach');
        expect(visible(api)).toEqual(['photos', 'beach']);

        api.setSearch('');
        expect(visible(api)).toEqual(['docs', 'cv', 'work', 'photos']);
        api.destroy();
    });

    it('applies a column filter across the whole tree', () => {
        const { api } = makeTreeGrid();
        api.setFilter('size', { operator: 'gt', value: 1000 });
        expect(visible(api)).toEqual(['photos', 'beach']);
        api.destroy();
    });

    it('reports the visible count as the total while narrowing', () => {
        const { api } = makeTreeGrid();
        api.setSearch('plan');
        expect(api.getState().totalRows).toBe(3);
        api.destroy();
    });
});

describe('a row under several parents', () => {
    interface Member {
        id: string;
        name: string;
        parentIds?: string[];
    }

    const members: Member[] = [
        { id: 'eng', name: 'Engineering' },
        { id: 'design', name: 'Design' },
        { id: 'ada', name: 'Ada', parentIds: ['eng', 'design'] },
        { id: 'tool', name: 'Toolchain', parentIds: ['ada'] },
    ];

    function makeGraphGrid() {
        const controller = createTreeController<Member>({
            getRowId: (row) => row.id,
            getParentIds: (row) => row.parentIds,
        });
        const api = createGridEngine<TreeNode<Member>>({
            columns: treeColumns<Member>([{ id: 'name', header: 'Name' }]),
            dataSource: createTreeDataSource(createLocalDataSource(members), controller),
            getRowId: (node) => node.nodeId,
            initialQuery: { pagination: { pageIndex: 0, pageSize: 100 } },
            plugins: treePlugins({ controller }),
        });
        return { api, controller };
    }

    it('renders the row once under each parent', () => {
        const { api, controller } = makeGraphGrid();
        controller.expandAll();

        expect(api.getState().rows.map((row) => row.id)).toEqual([
            'eng', 'eng/ada', 'eng/ada/tool',
            'design', 'design/ada', 'design/ada/tool',
        ]);
        api.destroy();
    });

    it('expands one placement without expanding the other', () => {
        const { api, controller } = makeGraphGrid();
        controller.expand('eng');
        controller.expand('design');
        controller.expand('eng/ada');

        expect(api.getState().rows.map((row) => row.id)).toEqual([
            'eng', 'eng/ada', 'eng/ada/tool', 'design', 'design/ada',
        ]);
        api.destroy();
    });

    it('selects one placement at a time, since the ids are per placement', () => {
        const { api, controller } = makeGraphGrid();
        controller.expandAll();
        api.setSelectionMode('multiple');

        api.toggleRowSelection('eng/ada');
        expect(api.getState().selectedIds).toEqual(['eng/ada']);
        expect(api.getState().rows.find((row) => row.id === 'design/ada')?.selected).toBe(false);
        api.destroy();
    });
});

describe('lazy children', () => {
    interface Node {
        id: string;
        name: string;
        folder?: boolean;
    }

    it('fetches on first expand and caches for the second placement', async () => {
        const loadChildren = vi.fn(async ({ rowId }: { rowId: string | number }) => [
            { id: `${rowId}-1`, name: 'One' },
            { id: `${rowId}-2`, name: 'Two' },
        ]);

        const controller = createTreeController<Node>({
            getRowId: (row) => row.id,
            hasChildren: (row) => row.folder === true,
            loadChildren: loadChildren as never,
        });

        const api = createGridEngine<TreeNode<Node>>({
            columns: treeColumns<Node>([{ id: 'name', header: 'Name' }]),
            dataSource: createTreeDataSource(
                createLocalDataSource<Node>([{ id: 'root', name: 'Root', folder: true }]),
                controller,
            ),
            getRowId: (node) => node.nodeId,
            initialQuery: { pagination: { pageIndex: 0, pageSize: 100 } },
            plugins: treePlugins({ controller }),
        });

        expect(api.getState().rows).toHaveLength(1);
        expect(api.getState().rows[0]!.data.hasChildren).toBe(true);
        expect(controller.getNodeState('root').loadState).toBe('unloaded');

        controller.expand('root');
        expect(controller.getNodeState('root').loadState).toBe('loading');

        await vi.waitFor(() => expect(api.getState().rows).toHaveLength(3));
        expect(controller.getNodeState('root').loadState).toBe('loaded');
        expect(loadChildren).toHaveBeenCalledOnce();

        controller.collapse('root');
        controller.expand('root');
        // Loading is keyed on the row, so re-expanding does not fetch again.
        expect(loadChildren).toHaveBeenCalledOnce();
        api.destroy();
    });

    it('surfaces a failure on the node and keeps it expanded', async () => {
        const controller = createTreeController<Node>({
            getRowId: (row) => row.id,
            hasChildren: () => true,
            loadChildren: async () => {
                throw new Error('The folder is unavailable.');
            },
        });

        const api = createGridEngine<TreeNode<Node>>({
            columns: treeColumns<Node>([{ id: 'name', header: 'Name' }]),
            dataSource: createTreeDataSource(
                createLocalDataSource<Node>([{ id: 'root', name: 'Root', folder: true }]),
                controller,
            ),
            getRowId: (node) => node.nodeId,
            plugins: treePlugins({ controller }),
        });

        controller.expand('root');
        await vi.waitFor(() => expect(controller.getNodeState('root').loadState).toBe('error'));

        expect(controller.getNodeState('root').error?.message).toBe('The folder is unavailable.');
        expect(controller.isExpanded('root')).toBe(true);
        api.destroy();
    });
});

describe('editing and building the tree', () => {
    it('updates a row in place', async () => {
        const { api, controller } = makeTreeGrid();
        controller.expand('docs');

        await controller.updateRow('cv', { name: 'Resume.pdf' });
        expect(api.getState().rows.find((row) => row.id === 'docs/cv')?.data.row.name).toBe('Resume.pdf');
        api.destroy();
    });

    it('inserts a child and opens the parent so the new row is visible', async () => {
        const { api, controller } = makeTreeGrid();

        await controller.insertRow(
            { id: 'new', name: 'Untitled.md', size: 0 },
            { referenceNodeId: 'docs', position: 'child' },
        );

        expect(visible(api)).toContain('new');
        expect(controller.isExpanded('docs')).toBe(true);
        api.destroy();
    });

    it('inserts a sibling after a reference node', async () => {
        const { api, controller } = makeTreeGrid();
        controller.expand('docs');

        await controller.insertRow(
            { id: 'new', name: 'After CV', size: 1 },
            { referenceNodeId: 'docs/cv', position: 'after' },
        );

        expect(visible(api)).toEqual(['docs', 'cv', 'new', 'work', 'photos']);
        api.destroy();
    });

    it('moves a node to a new parent, which is how the tree gets built', async () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();

        await controller.moveNode('docs/cv', { referenceNodeId: 'photos', position: 'child' });

        expect(visible(api)).toEqual(['docs', 'work', 'plan', 'notes', 'photos', 'beach', 'cv']);
        api.destroy();
    });

    it('refuses to move a node inside its own subtree', async () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();
        const before = visible(api);

        // Allowing this detaches the subtree from the tree entirely, and the rows do not move,
        // they vanish.
        await controller.moveNode('docs', { referenceNodeId: 'docs/work', position: 'child' });

        expect(visible(api)).toEqual(before);
        api.destroy();
    });

    it('removes a row everywhere by default', async () => {
        const { api, controller } = makeTreeGrid();
        controller.expandAll();

        await controller.removeNode('docs/work');
        expect(visible(api)).toEqual(['docs', 'cv', 'photos', 'beach']);
        api.destroy();
    });

    it('calls the commit handler and keeps the change when it resolves', async () => {
        const onCommit = vi.fn(async () => undefined);
        const { api, controller } = makeTreeGrid(tree, { onCommit });

        await controller.updateRow('cv', { name: 'Resume.pdf' });

        expect(onCommit).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'update', rowId: 'cv' }),
        );
        controller.expand('docs');
        expect(api.getState().rows.find((row) => row.id === 'docs/cv')?.data.row.name).toBe('Resume.pdf');
        api.destroy();
    });

    it('reverts the change and reports the error when the commit rejects', async () => {
        const { api, controller } = makeTreeGrid(tree, {
            onCommit: async () => {
                throw new Error('Read-only folder.');
            },
        });
        controller.expand('docs');

        await controller.updateRow('cv', { name: 'Resume.pdf' });

        // A half-applied edit is worse than a refused one: the reader cannot tell which half
        // survived.
        expect(api.getState().rows.find((row) => row.id === 'docs/cv')?.data.row.name).toBe('CV.pdf');
        expect(controller.getNodeState('docs/cv').error?.message).toBe('Read-only folder.');
        api.destroy();
    });

    it('reverts a rejected move completely', async () => {
        const { api, controller } = makeTreeGrid(tree, {
            onCommit: async () => {
                throw new Error('nope');
            },
        });
        controller.expandAll();
        const before = visible(api);

        await controller.moveNode('docs/cv', { referenceNodeId: 'photos', position: 'child' });

        expect(visible(api)).toEqual(before);
        api.destroy();
    });

    it('marks a row pending while its commit is in flight', async () => {
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        const { api, controller } = makeTreeGrid(tree, { onCommit: () => gate });
        controller.expand('docs');

        const pending = controller.updateRow('cv', { name: 'Resume.pdf' });
        expect(controller.getNodeState('docs/cv').pending).toBe(true);

        release!();
        await pending;
        expect(controller.getNodeState('docs/cv').pending).toBe(false);
        api.destroy();
    });
});
