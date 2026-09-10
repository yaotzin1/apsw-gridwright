import { describe, expect, it } from 'vitest';
import {
    ancestorsOf,
    buildTreeIndex,
    descendantCount,
    descendantsOf,
    isAncestor,
    isLeaf,
    joinNodeId,
} from '../../src/tree/nested-set';

interface Item {
    id: string;
    name: string;
    children?: Item[];
}

interface FlatItem {
    id: string;
    name: string;
    parentIds?: string[];
}

const nested: Item[] = [
    {
        id: 'a',
        name: 'A',
        children: [
            { id: 'b', name: 'B', children: [{ id: 'd', name: 'D' }] },
            { id: 'c', name: 'C' },
        ],
    },
    { id: 'e', name: 'E' },
];

const shape = { getRowId: (row: Item) => row.id, getChildren: (row: Item) => row.children };

describe('building from nested rows', () => {
    const index = buildTreeIndex(nested, shape);

    it('produces one node per row', () => {
        expect(index.nodes).toHaveLength(5);
        expect(index.rootNodeIds).toEqual(['a', 'e']);
    });

    it('walks in depth-first order, which is display order', () => {
        // The array is the render order. Intervals are assigned post-order because a node's
        // interval cannot close until its children are visited, and the array is sorted after.
        expect(index.nodes.map((node) => node.rowId)).toEqual(['a', 'b', 'd', 'c', 'e']);
        expect(index.nodes.map((node) => node.left)).toEqual([...index.nodes.map((node) => node.left)].sort((x, y) => x - y));
    });

    it('nests the intervals', () => {
        const a = index.byNodeId.get('a')!;
        const b = index.byNodeId.get('a/b')!;
        const d = index.byNodeId.get('a/b/d')!;

        expect(a.left).toBeLessThan(b.left);
        expect(b.right).toBeLessThan(a.right);
        expect(b.left).toBeLessThan(d.left);
        expect(d.right).toBeLessThan(b.right);
    });

    it('answers ancestry in two comparisons', () => {
        const a = index.byNodeId.get('a')!;
        const d = index.byNodeId.get('a/b/d')!;
        const e = index.byNodeId.get('e')!;

        expect(isAncestor(a, d)).toBe(true);
        expect(isAncestor(d, a)).toBe(false);
        expect(isAncestor(a, e)).toBe(false);
        expect(isAncestor(a, a)).toBe(false);
    });

    it('reports subtree size without walking', () => {
        expect(descendantCount(index.byNodeId.get('a')!)).toBe(3);
        expect(descendantCount(index.byNodeId.get('a/b')!)).toBe(1);
        expect(descendantCount(index.byNodeId.get('e')!)).toBe(0);
        expect(isLeaf(index.byNodeId.get('e')!)).toBe(true);
    });

    it('records depth and the row path', () => {
        const d = index.byNodeId.get('a/b/d')!;
        expect(d.depth).toBe(2);
        expect(d.rowPath).toEqual(['a', 'b', 'd']);
        expect(index.maxDepth).toBe(2);
    });

    it('returns a subtree as a contiguous slice', () => {
        expect(descendantsOf(index, 'a').map((node) => node.rowId)).toEqual(['b', 'd', 'c']);
        expect(descendantsOf(index, 'a/b').map((node) => node.rowId)).toEqual(['d']);
        expect(descendantsOf(index, 'e')).toEqual([]);
        expect(descendantsOf(index, 'missing')).toEqual([]);
    });

    it('returns ancestors from the root down', () => {
        expect(ancestorsOf(index, 'a/b/d').map((node) => node.rowId)).toEqual(['a', 'b']);
        expect(ancestorsOf(index, 'a')).toEqual([]);
    });
});

describe('building from flat rows with parent references', () => {
    const flat: FlatItem[] = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', parentIds: ['a'] },
        { id: 'c', name: 'C', parentIds: ['a'] },
        { id: 'd', name: 'D', parentIds: ['b'] },
    ];

    const index = buildTreeIndex(flat, {
        getRowId: (row) => row.id,
        getParentIds: (row) => row.parentIds,
    });

    it('finds the roots and rebuilds the nesting', () => {
        expect(index.rootNodeIds).toEqual(['a']);
        expect(index.byNodeId.get('a/b/d')?.depth).toBe(2);
        expect(descendantCount(index.byNodeId.get('a')!)).toBe(3);
    });

    it('accepts a single parent id as well as an array', () => {
        const single = buildTreeIndex(
            [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y', parentIds: undefined }],
            { getRowId: (row: FlatItem) => row.id, getParentIds: (row) => row.parentIds?.[0] ?? null },
        );
        expect(single.rootNodeIds).toEqual(['x', 'y']);
    });

    it('treats a row whose parent is absent as a root', () => {
        // A filtered or paginated slice of a tree routinely arrives without its parents. Dropping
        // those rows would show an empty grid for data that is present.
        const orphaned = buildTreeIndex(
            [{ id: 'child', name: 'Child', parentIds: ['not-in-this-page'] }],
            { getRowId: (row: FlatItem) => row.id, getParentIds: (row) => row.parentIds },
        );
        expect(orphaned.rootNodeIds).toEqual(['child']);
    });
});

describe('a row with several parents', () => {
    const flat: FlatItem[] = [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
        { id: 'x', name: 'X', parentIds: ['p1', 'p2'] },
        { id: 'c', name: 'C', parentIds: ['x'] },
    ];

    const index = buildTreeIndex(flat, {
        getRowId: (row) => row.id,
        getParentIds: (row) => row.parentIds,
    });

    it('places it once per parent, each with its own node', () => {
        expect(index.hasMultipleParents).toBe(true);
        expect(index.placementsByRowId.get('x')).toEqual(['p1/x', 'p2/x']);
        expect(index.byNodeId.has('p1/x')).toBe(true);
        expect(index.byNodeId.has('p2/x')).toBe(true);
    });

    it('gives each placement its own interval, so ancestry stays exact', () => {
        const underP1 = index.byNodeId.get('p1/x')!;
        const underP2 = index.byNodeId.get('p2/x')!;
        const p1 = index.byNodeId.get('p1')!;

        expect(isAncestor(p1, underP1)).toBe(true);
        expect(isAncestor(p1, underP2)).toBe(false);
    });

    it('duplicates the subtree beneath each placement', () => {
        expect(index.placementsByRowId.get('c')).toEqual(['p1/x/c', 'p2/x/c']);
        expect(descendantCount(index.byNodeId.get('p1/x')!)).toBe(1);
    });

    it('shares one row object between placements, so an edit reaches both', () => {
        expect(index.byNodeId.get('p1/x')!.row).toBe(index.byNodeId.get('p2/x')!.row);
        expect(index.byNodeId.get('p1/x')!.rowId).toBe(index.byNodeId.get('p2/x')!.rowId);
    });
});

describe('cycles', () => {
    it('places a repeated row once and refuses to descend', () => {
        // A "reports to" field pointing in a circle is not malformed input, it is Tuesday. Left
        // alone this recurses until the stack gives out.
        const cyclic: FlatItem[] = [
            { id: 'a', name: 'A', parentIds: ['c'] },
            { id: 'b', name: 'B', parentIds: ['a'] },
            { id: 'c', name: 'C', parentIds: ['b'] },
        ];

        const index = buildTreeIndex(cyclic, {
            getRowId: (row) => row.id,
            getParentIds: (row) => row.parentIds,
        });

        // No root exists, so every row would have vanished without the unreached-row pass.
        // `a` is promoted to a root, and appears a second time as the node that closes the loop:
        // a -> b -> c -> a, where the last one is marked cyclic and never descended into.
        expect(index.nodes.map((node) => node.rowId)).toEqual(['a', 'b', 'c', 'a']);
        expect(index.cyclicNodeIds).toEqual(['a/b/c/a']);

        for (const nodeId of index.cyclicNodeIds) {
            const node = index.byNodeId.get(nodeId)!;
            expect(node.cyclic).toBe(true);
            expect(node.childNodeIds).toEqual([]);
            expect(node.hasChildren).toBe(false);
        }
    });

    it('stops at the depth limit', () => {
        const deep: Item = { id: 'l0', name: 'L0' };
        let current = deep;
        for (let level = 1; level <= 20; level += 1) {
            const child: Item = { id: `l${level}`, name: `L${level}` };
            current.children = [child];
            current = child;
        }

        const index = buildTreeIndex([deep], { ...shape, maxDepth: 5 });
        expect(index.maxDepth).toBe(5);
    });
});

describe('lazy nodes', () => {
    it('marks a childless row that claims children as unloaded', () => {
        const index = buildTreeIndex(
            [{ id: 'folder', name: 'Folder' }],
            { getRowId: (row: Item) => row.id, hasChildren: () => true },
        );

        const node = index.byNodeId.get('folder')!;
        expect(node.hasChildren).toBe(true);
        expect(node.loadState).toBe('unloaded');
        expect(isLeaf(node)).toBe(true);
    });

    it('marks a row with children present as loaded', () => {
        const index = buildTreeIndex(nested, { ...shape, hasChildren: () => true });
        expect(index.byNodeId.get('a')!.loadState).toBe('loaded');
        expect(index.byNodeId.get('e')!.loadState).toBe('unloaded');
    });
});

describe('node ids', () => {
    it('escapes the separator so a row id containing a slash cannot collide', () => {
        expect(joinNodeId(null, 'a/b')).toBe('a%2Fb');
        expect(joinNodeId('a%2Fb', 'c')).toBe('a%2Fb/c');
        expect(joinNodeId('a', 'b/c')).not.toBe(joinNodeId('a/b', 'c'));
    });

    it('escapes the escape character', () => {
        expect(joinNodeId(null, 'a%2Fb')).toBe('a%252Fb');
        expect(joinNodeId(null, 'a%2Fb')).not.toBe(joinNodeId(null, 'a/b'));
    });

    it('accepts numeric row ids', () => {
        interface Numbered {
            id: number;
            children?: Numbered[];
        }

        const index = buildTreeIndex<Numbered>([{ id: 1, children: [{ id: 2 }] }], {
            getRowId: (row) => row.id,
            getChildren: (row) => row.children,
        });

        expect(index.rootNodeIds).toEqual(['1']);
        expect(index.byNodeId.has('1/2')).toBe(true);
    });
});
