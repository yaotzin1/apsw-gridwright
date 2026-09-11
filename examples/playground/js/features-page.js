import { loadPackage } from './shared/load-package.js';

const root = document.getElementById('root');
const { React, createRoot, gridwright, core, locales } = await loadPackage(root);

const { Gridwright } = gridwright;
const { createWindowedDataSource } = core;
const { createElement: h, useCallback, useEffect, useMemo, useState } = React;

// --- the data -----------------------------------------------------------------------------------

const nestedSeed = [
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

// The flat shape is the only one that can express a row with two parents. Shared.pdf is one row
// placed under both folders: edit it in one place and both change, expand one and only that opens.
const graphSeed = [
    { id: 'docs', name: 'Documents', kind: 'folder', owner: 'Ada', size: 0 },
    { id: 'photos', name: 'Photos', kind: 'folder', owner: 'Mary', size: 0 },
    { id: 'shared', name: 'Shared.pdf', kind: 'file', owner: 'Ada', size: 88_000, parentIds: ['docs', 'photos'] },
    { id: 'signature', name: 'Signature.png', kind: 'file', owner: 'Ada', size: 9_400, parentIds: ['shared'] },
    { id: 'cv', name: 'CV.pdf', kind: 'file', owner: 'Ada', size: 220_400, parentIds: ['docs'] },
    { id: 'beach', name: 'Beach.jpg', kind: 'file', owner: 'Mary', size: 3_400_000, parentIds: ['photos'] },
];

const lazySeed = [
    { id: 'root-a', name: 'Team A', kind: 'folder', owner: 'Ada', size: 0 },
    { id: 'root-b', name: 'Team B', kind: 'folder', owner: 'Grace', size: 0 },
];

// A flat array long enough that rendering every row is visibly the wrong idea, but still an
// ordinary array. This is virtualization on its own, with no windowed source underneath.
const manySeed = Array.from({ length: 20_000 }, (_, index) => ({
    id: `local-${index}`,
    name: `Local row ${index + 1}`,
    kind: index % 5 === 0 ? 'folder' : 'file',
    owner: ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy'][index % 5],
    size: (index * 7919) % 4_000_000,
}));

/**
 * The tree the server holds.
 *
 * An adjacency list: one row per node naming its parent and its position among siblings, which is
 * what a table can store. The nested set intervals the grid works with are derived from this on the
 * client and never stored, because they are a property of the whole tree and every insert would
 * rewrite half of them.
 */
async function loadStoredTree() {
    const response = await fetch('/api/files');
    const body = await response.json();
    return body.data;
}

/**
 * One change, sent to the server.
 *
 * The grid has already applied it; this either confirms it or, by throwing, reverts it exactly.
 * That is the whole persistence contract: four change types, one request each.
 */
async function saveStoredChange(change) {
    const response = await fetch('/api/files?latency=200', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? `The server answered ${response.status}.`);
    return body.data;
}

const seedFor = (shape) =>
    shape === 'nested' ? nestedSeed
    : shape === 'graph' ? graphSeed
    : shape === 'lazy' ? lazySeed
    : manySeed;

const bytes = new Intl.NumberFormat('en-US', { notation: 'compact', style: 'unit', unit: 'byte', unitDisplay: 'narrow' });
const count = new Intl.NumberFormat('en-US');

let created = 0;
const blankRow = (kind) => ({
    id: `new-${(created += 1)}`,
    name: kind === 'folder' ? 'New folder' : 'Untitled.md',
    kind,
    owner: 'You',
    size: 0,
});

// --- icons --------------------------------------------------------------------------------------
//
// A column's `icon` is a renderer like `cell` is, so it is decided per row. On the tree column the
// tree cell places it between the toggle and the label rather than before the indentation.

const FolderIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' },
        h('path', { d: 'M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.4 1.7H13A1.5 1.5 0 0 1 14.5 5.7v5.8A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4Z' }));

const FileIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 },
        h('path', { d: 'M4.2 1.9h4.6l3 3v9.2H4.2z' }),
        h('path', { d: 'M8.8 1.9v3h3' }));

const iconFor = ({ row }) => h(row.kind === 'folder' ? FolderIcon : FileIcon);

// --- ten million rows, served a block at a time ---------------------------------------------------
//
// Nothing on this page holds ten million anything. The source is asked for a range, answers it, and
// keeps a handful of blocks. Replace `fetchRange` with a fetch call and it is a real endpoint.

const HUGE_TOTAL = 10_000_000;
const OWNERS = ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy'];

// An edit over a windowed source cannot live in the row, because the row is thrown away when its
// block is evicted. It lives here, where the server's table would be, and is applied as blocks
// are built.
const overrides = new Map();
let blockRequests = 0;

const hugeSource = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 8,
    fetchRange: async ({ offset, limit, signal }) => {
        blockRequests += 1;
        // A real delay, so the skeleton rows are something you can see rather than read about.
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

// --- columns ---------------------------------------------------------------------------------------

function useColumns(editing, icons) {
    return useMemo(
        () => [
            {
                id: 'name',
                header: 'Name',
                // Editing is decided per column. A grid where every cell turns into a text box on
                // click is a grid nobody can read.
                ...(editing ? { edit: { editable: true } } : {}),
                ...(icons ? { icon: iconFor } : {}),
            },
            {
                id: 'kind',
                header: 'Kind',
                cell: ({ value }) => h('span', { className: 'kind' }, value),
                ...(editing
                    ? {
                          edit: {
                              inputType: 'select',
                              choices: [
                                  { value: 'folder', label: 'folder' },
                                  { value: 'file', label: 'file' },
                              ],
                          },
                      }
                    : {}),
            },
            { id: 'owner', header: 'Owner', ...(editing ? { edit: { editable: true } } : {}) },
            {
                id: 'size',
                header: 'Size',
                align: 'end',
                formatValue: (value) => (value ? bytes.format(value) : ''),
                // `editable` is asked per row, so a folder's size stays read-only.
                ...(editing ? { edit: { editable: (row) => row.kind === 'file', inputType: 'number' } } : {}),
            },
        ],
        [editing, icons],
    );
}

// --- the demo the switches drive ---------------------------------------------------------------------

function ShapeDemo({ shape, tree, virtual, actions, editing, icons, locale, strict, log, onStats }) {
    const columns = useColumns(editing, icons);
    const stored = shape === 'stored';
    const [rows, setRows] = useState(() => (stored ? [] : seedFor(shape)));

    // The stored shape is the only one whose rows are not in this file. It is fetched once and then
    // replaced by whatever the server answers with after each change.
    useEffect(() => {
        if (!stored) return;
        let live = true;
        void loadStoredTree().then((data) => {
            if (live) setRows(data);
        });
        return () => {
            live = false;
        };
    }, [stored]);
    // Only a tree has a controller, and only the row actions and the stats panel need it. It is
    // handed back by `controllerRef` because the component owns the tree when you enable it by prop.
    const [controller, setController] = useState(null);

    const treeOptions = useMemo(() => {
        if (!tree) return undefined;

        const options = {
            getRowId: (row) => row.id,
            controllerRef: setController,
            defaultExpandedDepth: shape === 'lazy' ? 0 : 1,
            onExpandedChange: (ids) => log('expanded', `${ids.length} open`),
            onCommit: async (change) => {
                log(change.type, String(change.rowId));

                if (shape === 'stored') {
                    // A real round trip. Reload the page and the change is still there, because it
                    // is on the server rather than in this tab.
                    setRows(await saveStoredChange(change));
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 250));
                if (strict && change.type !== 'remove') throw new Error('The server refused that change.');
            },
        };

        if (shape === 'nested') options.getChildren = (row) => row.children;
        if (shape === 'graph') options.getParentIds = (row) => row.parentIds;
        if (shape === 'stored') options.getParentIds = (row) => row.parentId;
        if (shape === 'lazy') {
            options.hasChildren = (row) => row.kind === 'folder';
            options.loadChildren = async ({ rowId }) => {
                log('loadChildren', String(rowId));
                await new Promise((resolve) => setTimeout(resolve, 700));
                if (String(rowId).endsWith('-b')) throw new Error('That team is not reachable right now.');
                return [
                    { id: `${rowId}/one`, name: 'Report.md', kind: 'file', owner: 'Ada', size: 3_200 },
                    { id: `${rowId}/two`, name: 'Archive', kind: 'folder', owner: 'Ada', size: 0 },
                ];
            };
        }

        return options;
    }, [tree, shape, strict, log]);

    const rowActions = useMemo(() => {
        if (!actions) return undefined;
        // A grid row carries a tree node when the tree is on and the row itself when it is off, so
        // one menu covers both.
        const rowOf = (gridRow) => (tree ? gridRow.data.row : gridRow.data);

        return [
            {
                id: 'add-child',
                label: 'Add child',
                hidden: (gridRow) => !tree || rowOf(gridRow).kind !== 'folder',
                onSelect: (gridRow) =>
                    void (controller && controller.insertRow(blankRow('file'), {
                        referenceNodeId: String(gridRow.id),
                        position: 'child',
                    })),
            },
            {
                id: 'add-sibling',
                label: 'Add sibling',
                hidden: () => !tree,
                onSelect: (gridRow) =>
                    void (controller && controller.insertRow(blankRow('file'), {
                        referenceNodeId: String(gridRow.id),
                        position: 'after',
                    })),
            },
            {
                id: 'inspect',
                label: 'Inspect',
                separatorBefore: true,
                onSelect: (gridRow) => log('inspect', rowOf(gridRow).name),
            },
            {
                id: 'delete',
                label: 'Delete',
                destructive: true,
                hidden: () => !tree,
                onSelect: (gridRow) => void (controller && controller.removeNode(String(gridRow.id))),
            },
        ];
    }, [actions, tree, controller, log]);

    // Committing an edit. A tree applies it optimistically and rolls it back if `onCommit` rejects;
    // a plain array is the page's own state, so the page writes it.
    const onCellEdit = useCallback(
        (rowId, columnId, value) => {
            log('edit', `${rowId}.${columnId}`);
            if (controller) return controller.updateRow(rowId, { [columnId]: value });
            setRows((current) =>
                current.map((row) => (row.id === rowId ? { ...row, [columnId]: value } : row)),
            );
        },
        [controller, log],
    );

    const index = controller ? controller.getIndex() : null;
    const stats = useMemo(
        () =>
            index
                ? [
                      ['nodes in index', index.nodes.length],
                      ['distinct rows', index.placementsByRowId.size],
                      ['max depth', index.maxDepth],
                      ['several parents', String(index.hasMultipleParents)],
                  ]
                : [
                      ['rows', count.format(rows.length)],
                      ['tree', 'off'],
                      ['windowed', String(virtual)],
                      ['editable columns', editing ? 4 : 0],
                  ],
        [index, rows.length, virtual, editing],
    );
    onStats(stats);

    return h(Gridwright, {
        columns,
        data: rows,
        getRowId: (row) => row.id,
        pageSize: virtual ? 500 : 50,
        searchable: true,
        selectionMode: 'multiple',
        locale: locales[locale],
        'aria-label': 'Files',
        ...(treeOptions ? { tree: treeOptions } : {}),
        ...(virtual ? { virtual: { rowHeight: 40, height: 420 } } : {}),
        ...(rowActions ? { rowActions } : {}),
        ...(editing ? { onCellEdit } : {}),
    });
}

// --- ten million rows -----------------------------------------------------------------------------
//
// The same component again. The only difference from the demo above is what is behind it: a source
// that holds a window of blocks instead of an array, and a commit that writes to the mock table
// rather than to React state.

function HugeDemo({ actions, editing, icons, locale, log, onStats }) {
    const columns = useColumns(editing, icons);
    const [version, setVersion] = useState(0);

    const onCellEdit = useCallback(
        (rowId, columnId, value) => {
            log('edit', `${rowId}.${columnId}`);
            overrides.set(rowId, { ...overrides.get(rowId), [columnId]: value });
            // Every cached block was built from the table this edit just changed, so the cache goes
            // rather than the one row. The source notifies the grid, which asks again by itself.
            hugeSource.invalidate();
            setVersion((current) => current + 1);
        },
        [log],
    );

    const rowActions = useMemo(
        () =>
            actions
                ? [{ id: 'inspect', label: 'Inspect', onSelect: (gridRow) => log('inspect', gridRow.data.name) }]
                : undefined,
        [actions, log],
    );

    const stats = useMemo(
        () => [
            ['rows in the table', count.format(HUGE_TOTAL)],
            ['blocks cached', hugeSource.cachedBlockCount],
            ['rows resident', count.format(hugeSource.cachedBlockCount * 200)],
            ['block requests', blockRequests],
        ],
        // Recounted on every edit and on a timer below, so the numbers can be watched moving.
        [version],
    );
    onStats(stats);

    // The panel is a diagnostic, not grid state, so it polls rather than making the grid publish a
    // render for every block that lands.
    useEffect(() => {
        const timer = setInterval(() => setVersion((current) => current + 1), 500);
        return () => clearInterval(timer);
    }, []);

    return h(Gridwright, {
        columns,
        dataSource: hugeSource,
        getRowId: (row) => row.id,
        pageSize: 200,
        selectionMode: 'multiple',
        locale: locales[locale],
        'aria-label': 'Records',
        virtual: { rowHeight: 40, height: 420 },
        ...(rowActions ? { rowActions } : {}),
        ...(editing ? { onCellEdit } : {}),
    });
}

// --- the page ------------------------------------------------------------------------------------

function App() {
    const [shape, setShape] = useState('nested');
    const [tree, setTree] = useState(true);
    const [virtual, setVirtual] = useState(false);
    const [actions, setActions] = useState(true);
    const [editing, setEditing] = useState(true);
    const [icons, setIcons] = useState(true);
    const [locale, setLocale] = useState('en');
    const [strict, setStrict] = useState(false);
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState([]);

    const log = useCallback((name, detail) => {
        setEvents((current) => [{ id: Math.random(), name, detail }, ...current].slice(0, 24));
    }, []);

    // The demo reports what it is holding and the page draws it. Deferred, so a child never sets
    // parent state during the parent's own render.
    const onStats = useCallback((next) => {
        queueMicrotask(() => setStats(next));
    }, []);

    const huge = shape === 'huge';
    const treeable = shape !== 'many' && !huge;
    const treeOn = tree && treeable;
    const virtualOn = virtual || huge;

    const hint = huge
        ? 'Ten million rows. The source is asked for a block of two hundred, the cache keeps eight of them, and the body renders about forty. Scroll fast and the rows you outrun are skeletons waiting for their block. Edit a name and the cache is dropped and asked again.'
        : shape === 'stored'
          ? 'This tree lives on the server, stored as an adjacency list: one row per node naming its parent and its position. Add, rename or delete something and reload the page, and it is still there. Each change is one POST, and a refusal reverts the row the grid had already moved.'
          : shape === 'graph'
          ? 'Shared.pdf is one row under two parents. Rename it in one place and both change, because there is one row. Expand it in one place and only that one opens, because there are two placements.'
          : shape === 'lazy'
            ? 'Children arrive on first expand. Team B always fails, and the node stays open with the message so it can be retried. Expanding a folder a second time does not fetch again.'
            : shape === 'many'
              ? 'Twenty thousand rows in a plain array. Windowing is the switch that matters here, and it is the same switch the ten million rows use. Only the source underneath differs.'
              : 'Every switch above is a prop on one component. Turn the tree off and the menu and the editors keep working. Turn windowing on and the tree keeps working, indentation and all.';

    return h('div', null,
        h('section', { className: 'panel', style: { marginBottom: '20px' } },
            h('h2', null, 'Switches'),
            h('div', { className: 'row' },
                h('label', { className: 'inline' }, 'Data',
                    h('select', {
                        value: shape,
                        onChange: (event) => {
                            const next = event.target.value;
                            setShape(next);
                            if (next === 'huge') setVirtual(true);
                        },
                    },
                        h('option', { value: 'nested' }, 'Nested children'),
                        h('option', { value: 'graph' }, 'Flat, with two parents'),
                        h('option', { value: 'stored' }, 'Stored on the server'),
                        h('option', { value: 'lazy' }, 'Lazy children'),
                        h('option', { value: 'many' }, '20,000 rows in memory'),
                        h('option', { value: 'huge' }, '10,000,000 rows, windowed'))),
                toggle('tree', treeOn, setTree, !treeable),
                toggle('virtual', virtualOn, setVirtual, huge),
                toggle('row actions', actions, setActions, false),
                toggle('inline edit', editing, setEditing, false),
                toggle('icons', icons, setIcons, false)),

            h('div', { className: 'row', style: { marginTop: '10px' } },
                h('label', { className: 'inline' }, 'Language',
                    h('select', { value: locale, onChange: (event) => setLocale(event.target.value) },
                        h('option', { value: 'en' }, 'English'),
                        h('option', { value: 'de' }, 'Deutsch'),
                        h('option', { value: 'es' }, 'Español'),
                        h('option', { value: 'fr' }, 'Français'),
                        h('option', { value: 'pl' }, 'Polski'))),
                huge ? null : toggle('refuse every edit', strict, setStrict, false)),

            h('p', { className: 'hint' }, hint)),

        h('section', { className: 'panel', style: { marginBottom: '20px' } },
            h('h2', null, 'The grid'),
            huge
                ? h(HugeDemo, { key: 'huge', actions, editing, icons, locale, log, onStats })
                : h(ShapeDemo, {
                      // A tree and a flat list are different grids, so switching between them
                      // remounts. Every other switch changes in place.
                      key: `${shape}:${treeOn}:${virtualOn}`,
                      shape,
                      tree: treeOn,
                      virtual: virtualOn,
                      actions,
                      editing,
                      icons,
                      locale,
                      strict,
                      log,
                      onStats,
                  })),

        h('section', { className: 'panel', style: { marginBottom: '20px' } },
            h('h2', null, huge ? 'What the browser is holding' : 'What the grid is holding'),
            h('dl', { className: 'stats' }, stats.map(([label, value]) => stat(label, value))),
            h('p', { className: 'hint' },
                huge
                    ? 'Memory is a function of the cache, not of the table. Eight blocks of two hundred rows is the same whether the result set has ten thousand rows or ten million.'
                    : treeOn
                      ? 'Nodes outnumber rows exactly when a row is placed more than once. Subtree size is arithmetic on the nested-set interval, never a walk.'
                      : 'The same component, with the tree switched off. Nothing else was rearranged to get here.')),

        h('section', { className: 'panel' },
            h('h2', null, 'Events'),
            h('div', { className: 'log' },
                events.length === 0
                    ? h('div', null, 'Expand a node, edit a cell, or open a row menu.')
                    : events.map((entry) =>
                          h('div', { key: entry.id }, h('b', null, entry.name), ' ', entry.detail)))));
}

const toggle = (label, checked, set, disabled) =>
    h('label', { className: 'inline', key: label, style: disabled ? { opacity: 0.45 } : null },
        h('input', {
            type: 'checkbox',
            checked,
            disabled,
            onChange: (event) => set(event.target.checked),
        }),
        label);

const stat = (label, value) =>
    h('div', { className: 'stat', key: label }, h('dt', null, label), h('dd', null, String(value)));

createRoot(root).render(h(React.StrictMode, null, h(App)));
