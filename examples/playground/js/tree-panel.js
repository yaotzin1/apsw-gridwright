/**
 * A tree grid, with no framework at all.
 *
 * A tree grid is an ordinary grid whose rows are nodes: `createTreeDataSource` wraps any source so
 * it answers with placements, `treePlugins` flattens the visible ones, and `createTreeController`
 * owns expansion and mutation. None of that knows what a DOM is, which is why this file can draw it
 * with string concatenation. What the React adapter adds is the markup, not the hierarchy.
 *
 * The tree itself lives on the server as an adjacency list: one row per node naming its parent and
 * its position among siblings, which is what a table can hold. The nested set intervals the grid
 * works with are derived from that on the client and never stored, because they are a property of
 * the whole tree and every insert would rewrite half of them.
 */

import {
    createGridEngine,
    createLocalDataSource,
    createTreeController,
    createTreeDataSource,
    descendantCount,
    treeColumns,
    treePlugins,
} from '../../../dist/index.js';

import { escapeHtml } from './shared/html.js';
import { fileIcon, folderIcon } from './shared/icons.js';
import { menuFromClick, openRowMenu } from './shared/row-menu.js';

const COLUMNS = [
    { id: 'name', header: 'Name' },
    { id: 'kind', header: 'Kind' },
    { id: 'owner', header: 'Owner' },
];

/**
 * Builds the panel and wires it up.
 *
 * `latency` is a function rather than a number because the page's own control owns it, and the
 * panel should read it when it sends rather than when it was built.
 */
export async function initTreePanel({ panel, grid, stats, search, keepAncestors, logEvent, latency }) {
    let api = null;
    let created = 0;

    const controller = createTreeController({
        getRowId: (row) => row.id,
        // The stored shape names parents rather than nesting children, which is the shape a table
        // can hold and the only one that can express a row under two parents.
        getParentIds: (row) => row.parentId,
        defaultExpandedDepth: 1,
        onCommit: (change) => save(change),
    });

    const source = createLocalDataSource(await load());

    async function load() {
        const response = await fetch('/api/files');
        const body = await response.json();
        return body.data;
    }

    /**
     * One change, sent to the server.
     *
     * The grid has already applied it, so this either confirms it or, by throwing, reverts it
     * exactly. That is the whole persistence contract: four change types, one request each.
     */
    async function save(change) {
        logEvent(`tree:${change.type}`, String(change.rowId));

        const response = await fetch(`/api/files?latency=${latency()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            logEvent('tree:refused', body.message ?? `The server answered ${response.status}.`);
            throw new Error(body.message ?? 'The server refused that change.');
        }

        // The server answers with the whole tree it now holds, so the rows come from what was
        // stored rather than from what the client hoped was stored.
        source.setRows(body.data);
    }

    function build(keepAncestorsOfMatches) {
        api = createGridEngine({
            // `treeColumns` rewrites a column written against your row so it reads a node instead,
            // which is the one thing a tree grid's columns need that a flat grid's do not.
            columns: treeColumns(COLUMNS),
            dataSource: createTreeDataSource(source, controller),
            plugins: treePlugins({ controller, keepAncestorsOfMatches }),
            getRowId: (node) => node.nodeId,
            initialQuery: { pagination: { pageIndex: 0, pageSize: 200 } },
        });

        api.subscribe(render);
        render(api.getState());
    }

    function render(state) {
        const columns = api.getColumns().filter((column) => !column.hidden);

        const rows = state.rows
            .map((row) => {
                const node = row.data;
                const expandable = node.hasChildren || node.childNodeIds.length > 0;
                const nodeState = controller.getNodeState(node.nodeId);

                const toggle = expandable
                    ? `<button type="button" class="gw-tree-toggle" data-toggle="${escapeHtml(node.nodeId)}"
                               aria-expanded="${nodeState.expanded}" aria-label="${nodeState.expanded ? 'Collapse' : 'Expand'}">
                           ${nodeState.expanded ? '▾' : '▸'}
                       </button>`
                    : '<span class="gw-tree-toggle gw-tree-toggle--leaf" aria-hidden="true"></span>';

                const cells = columns
                    .map((column, index) => {
                        const text = escapeHtml(column.getText(node));
                        if (index > 0) return `<td class="gw-cell">${text}</td>`;

                        // Indentation is padding on one element rather than nested markup, so the
                        // table keeps one cell per column and a screen reader still reads a grid.
                        return `<td class="gw-cell">
                            <span class="gw-tree-cell" style="padding-inline-start:${node.depth * 18}px">
                                ${toggle}${node.row.kind === 'folder' ? folderIcon : fileIcon}
                                <span class="gw-tree-label">${text}</span>
                            </span>
                        </td>`;
                    })
                    .join('');

                return `<tr class="gw-row" data-row-id="${escapeHtml(node.nodeId)}"
                            aria-level="${node.depth + 1}" ${expandable ? `aria-expanded="${nodeState.expanded}"` : ''}>
                        ${cells}
                    </tr>`;
            })
            .join('');

        grid.innerHTML = `
            <div class="gw-table-wrapper">
                <table class="gw-table" role="grid" aria-label="Files" aria-rowcount="${state.totalRows}">
                    <thead><tr>${columns
                        .map(
                            (column) =>
                                `<th class="gw-header-cell"><span class="gw-header-label">${escapeHtml(column.header ?? column.id)}</span></th>`,
                        )
                        .join('')}</tr></thead>
                    <tbody class="gw-tbody">${rows || '<tr><td class="gw-status" colspan="3">No rows match</td></tr>'}</tbody>
                </table>
            </div>`;

        const index = controller.getIndex();
        const first = state.rows[0]?.data;
        stats.innerHTML = [
            ['visible nodes', state.rows.length],
            ['nodes in index', index.nodes.length],
            ['distinct rows', index.placementsByRowId.size],
            ['max depth', index.maxDepth],
            ['descendants of the first', first ? descendantCount(first) : 0],
        ]
            .map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
            .join('');
    }

    function menuFor(nodeId) {
        const node = controller.getIndex().byNodeId.get(nodeId);
        if (!node) return [];

        const blank = () => ({ id: `new-${(created += 1)}`, name: 'Untitled.md', kind: 'file', owner: 'You' });

        return [
            node.row.kind === 'folder'
                ? { label: 'Add file', run: () => controller.insertRow(blank(), { referenceNodeId: nodeId, position: 'child' }) }
                : null,
            { label: 'Add sibling', run: () => controller.insertRow(blank(), { referenceNodeId: nodeId, position: 'after' }) },
            { label: 'Delete', destructive: true, run: () => controller.removeNode(nodeId) },
        ].filter(Boolean);
    }

    // --- wiring ---------------------------------------------------------------------------------

    panel.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-toggle]');
        if (toggle) {
            controller.toggle(toggle.dataset.toggle);
            return;
        }

        const action = event.target.closest('[data-tree-action]');
        if (action) {
            if (action.dataset.treeAction === 'expand') controller.expandAll();
            else controller.collapseAll();
            return;
        }

        menuFromClick(event, grid, menuFor);
    });

    panel.addEventListener('contextmenu', (event) => {
        const row = event.target.closest('.gw-row[data-row-id]');
        if (!row) return;
        event.preventDefault();
        openRowMenu(menuFor(row.dataset.rowId), event.clientX, event.clientY, grid);
    });

    search.addEventListener('input', () => api.setSearch(search.value));

    keepAncestors.addEventListener('change', () => {
        // The stage reads its option at construction, so changing it means a new plugin set, which
        // is a new engine. Rebuilding one is cheap and the alternative is an option nobody can
        // change.
        const term = search.value;
        api.destroy();
        build(keepAncestors.checked);
        api.setSearch(term);
    });

    build(keepAncestors.checked);

    // The controller mutates outside the engine, so it says when it has, and the pipeline is
    // recomputed from rows already in hand rather than by asking the source again.
    controller.subscribe(() => api.invalidatePipeline());
}
