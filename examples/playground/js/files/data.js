/**
 * The data behind the features page, one export per "Data" choice.
 *
 *   nested   rows carry their children                     → tree: { getChildren }
 *   graph    rows name their parents, one has two           → tree: { getParentIds }
 *   stored   the tree lives on the mock server              → loadStoredTree / saveStoredChange
 *   lazy     children arrive on first expand                → tree: { hasChildren, loadChildren }
 *   many     20,000 rows in a plain array                   → virtual
 *   huge     10,000,000 rows, fetched a block at a time     → a windowed data source
 */
import { core } from '../shared/package.js';

const { createWindowedDataSource } = core;

export const nestedSeed = [
    {
        id: 'docs', name: 'Documents', kind: 'folder', owner: 'Ada', size: 0,
        children: [
            { id: 'cv', name: 'CV.pdf', kind: 'file', owner: 'Ada', size: 220_400 },
            {
                id: 'work', name: 'Work', kind: 'folder', owner: 'Grace', size: 0,
                children: [
                    { id: 'plan', name: 'Plan.md', kind: 'file', owner: 'Grace', size: 12_800 },
                    { id: 'notes', name: 'Notes.md', kind: 'file', owner: 'Grace', size: 4_100 },
                ],
            },
        ],
    },
    {
        id: 'photos', name: 'Photos', kind: 'folder', owner: 'Mary', size: 0,
        children: [
            { id: 'beach', name: 'Beach.jpg', kind: 'file', owner: 'Mary', size: 3_400_000 },
            { id: 'city', name: 'City.jpg', kind: 'file', owner: 'Mary', size: 2_100_000 },
        ],
    },
];

/**
 * The flat shape is the only one that can express a row with two parents. Shared.pdf is one row
 * placed under both folders: edit it in one place and both change, expand one and only that opens.
 */
export const graphSeed = [
    { id: 'docs', name: 'Documents', kind: 'folder', owner: 'Ada', size: 0 },
    { id: 'photos', name: 'Photos', kind: 'folder', owner: 'Mary', size: 0 },
    { id: 'shared', name: 'Shared.pdf', kind: 'file', owner: 'Ada', size: 88_000, parentIds: ['docs', 'photos'] },
    { id: 'signature', name: 'Signature.png', kind: 'file', owner: 'Ada', size: 9_400, parentIds: ['shared'] },
    { id: 'cv', name: 'CV.pdf', kind: 'file', owner: 'Ada', size: 220_400, parentIds: ['docs'] },
    { id: 'beach', name: 'Beach.jpg', kind: 'file', owner: 'Mary', size: 3_400_000, parentIds: ['photos'] },
];

export const lazySeed = [
    { id: 'root-a', name: 'Team A', kind: 'folder', owner: 'Ada', size: 0 },
    { id: 'root-b', name: 'Team B', kind: 'folder', owner: 'Grace', size: 0 },
];

/** Children for a lazy folder. Team B always fails, so the retry path can be seen. */
export async function loadLazyChildren(rowId) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (String(rowId).endsWith('-b')) throw new Error('That team is not reachable right now.');
    return [
        { id: `${rowId}/one`, name: 'Report.md', kind: 'file', owner: 'Ada', size: 3_200 },
        { id: `${rowId}/two`, name: 'Archive', kind: 'folder', owner: 'Ada', size: 0 },
    ];
}

/** An ordinary array long enough that rendering every row is visibly the wrong idea. */
export const manySeed = Array.from({ length: 20_000 }, (_, index) => ({
    id: `local-${index}`,
    name: `Local row ${index + 1}`,
    kind: index % 5 === 0 ? 'folder' : 'file',
    owner: ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy'][index % 5],
    size: (index * 7919) % 4_000_000,
}));

export const seedFor = (shape) =>
    shape === 'nested' ? nestedSeed : shape === 'graph' ? graphSeed : shape === 'lazy' ? lazySeed : manySeed;

// --- the tree stored on the server ------------------------------------------------------------------

/**
 * The tree as the server holds it: an adjacency list, one row per node naming its parent and its
 * position. The intervals the grid works with are derived on the client and never stored.
 */
export async function loadStoredTree() {
    const response = await fetch('/api/files');
    return (await response.json()).data;
}

/**
 * One change, sent to the server. The grid has already applied it; returning confirms it, throwing
 * reverts it. Four change types, one request each: that is the whole persistence contract.
 */
export async function saveStoredChange(change) {
    const response = await fetch('/api/files?latency=200', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? `The server answered ${response.status}.`);
    return body.data;
}

// --- ten million rows ---------------------------------------------------------------------------------

export const HUGE_TOTAL = 10_000_000;
const OWNERS = ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy'];
const count = new Intl.NumberFormat('en-US');

/**
 * Edits over a windowed source. A row is thrown away when its block is evicted, so an edit lives
 * here, where the server's table would be, and is applied as blocks are built.
 */
export const overrides = new Map();

export const diagnostics = { blockRequests: 0 };

/**
 * Nothing holds ten million anything. The source is asked for a range, answers it, and keeps eight
 * blocks. Replace the body of `fetchRange` with a `fetch` and it is a real endpoint.
 */
export const hugeSource = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 8,
    fetchRange: async ({ offset, limit, signal }) => {
        diagnostics.blockRequests += 1;
        // A real delay, so the skeleton rows are something you can see.
        await new Promise((resolve) => setTimeout(resolve, 140));
        if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

        const rows = [];
        for (let index = offset; index < Math.min(offset + limit, HUGE_TOTAL); index += 1) {
            const id = `row-${index}`;
            rows.push({
                id,
                name: `Record ${count.format(index + 1)}`,
                kind: index % 7 === 0 ? 'folder' : 'file',
                owner: OWNERS[index % OWNERS.length],
                size: (index * 977) % 4_000_000,
                ...overrides.get(id),
            });
        }
        return { rows, totalRows: HUGE_TOTAL };
    },
});
