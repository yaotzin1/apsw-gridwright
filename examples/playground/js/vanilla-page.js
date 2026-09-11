import {
    STAGE_ORDER,
    computeVirtualWindow,
    createGridEngine,
    createLocalDataSource,
    createRemoteDataSource,
    createWindowedDataSource,
    WINDOW_OFFSET_META,
} from '../../../dist/index.js';

import { element, escapeHtml } from './shared/html.js';
import { personIcon } from './shared/icons.js';
import { dismissMenuOnOutsidePress, menuFromClick, openRowMenu } from './shared/row-menu.js';
import { initTreePanel } from './tree-panel.js';

// --- columns ----------------------------------------------------------------------------------

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

// A glyph beside the value. The core has no opinion about icons, because the core renders nothing:
// this page draws its own. The React component has `icon` on the column, which is the same idea
// with the markup written for you.
const columns = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'city', header: 'City' },
    // Search matches formatted text, so typing "$120,000" finds the row that renders it.
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(value) },
    { id: 'startedOn', header: 'Started', formatValue: (value) => date.format(new Date(value)) },
    { id: 'active', header: 'Status', sortable: true, formatValue: (value) => (value ? 'Active' : 'Inactive') },
];

// --- a plugin, written the way a consumer would write one -------------------------------------

const activeOnlyPlugin = () => ({
    name: 'playground:active-only',
    setup: (context) =>
        context.registerStage({
            id: 'playground:active-only',
            order: STAGE_ORDER.FILTER + 1,
            capability: 'filter',
            run: (rows) => {
                const kept = rows.filter((row) => row.active);
                return { rows: kept, totalRows: kept.length };
            },
        }),
});

// --- page state ---------------------------------------------------------------------------------



const ui = {
    optVirtual: element('opt-virtual'),
    optEdit: element('opt-edit'),
    optActions: element('opt-actions'),
    sourceKind: element('source-kind'),
    capabilitySet: element('capability-set'),
    latency: element('latency'),
    withTotal: element('with-total'),
    failNext: element('fail-next'),
    refresh: element('refresh'),
    pluginActive: element('plugin-active'),
    selection: element('selection'),
    badges: element('capability-badges'),
    seamNote: element('seam-note'),
    search: element('search'),
    department: element('filter-department'),
    salary: element('filter-salary'),
    clearFilters: element('clear-filters'),
    grid: element('grid'),
    stats: element('stats'),
    log: element('log'),
    theme: element('theme'),
    accent: element('accent'),
    rowHeight: element('row-height'),
};

let api = null;
let removePlugin = null;
let localRows = null;
let windowedSource = null;
let windowBlockRequests = 0;
const events = [];

const readCapabilities = () => {
    const capabilities = {};
    for (const input of ui.capabilitySet.querySelectorAll('[data-capability]')) {
        capabilities[input.dataset.capability] = input.checked;
    }
    return capabilities;
};

// --- data sources -------------------------------------------------------------------------------

async function loadLocalRows() {
    if (!localRows) {
        const response = await fetch('/api/people/all');
        localRows = await response.json();
    }
    return localRows;
}

/**
 * A remote source written by hand rather than with createRestDataSource, so the request the
 * server receives is visible in one place. The `serverDoes` parameter is what makes the mock API
 * honour exactly the capabilities declared here instead of quietly doing everything.
 */
function makeRemoteSource(capabilities) {
    return createRemoteDataSource({
        capabilities,
        retry: { attempts: 0 },
        fetcher: async ({ query, signal }) => {
            const params = new URLSearchParams({
                page: String(query.pagination.pageIndex + 1),
                pageSize: String(query.pagination.pageSize),
                latency: ui.latency.value,
                withTotal: String(ui.withTotal.checked),
                serverDoes: Object.entries(capabilities)
                    .filter(([, enabled]) => enabled)
                    .map(([name]) => name)
                    .join(','),
            });

            if (query.sort.length > 0) {
                params.set('sort', query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(','));
            }
            if (query.search.trim() !== '') params.set('search', query.search);
            if (query.filters.length > 0) params.set('filters', JSON.stringify(query.filters));

            const response = await fetch(`/api/people?${params}`, { signal });
            const body = await response.json();

            if (!response.ok) {
                // Surface the server's own sentence. "Request failed with status 503" tells the
                // reader nothing they can act on.
                const error = new Error(body.message ?? `The server answered ${response.status}.`);
                error.status = response.status;
                throw error;
            }

            return body.total === undefined
                ? { rows: body.data }
                : { rows: body.data, totalRows: body.total };
        },
    });
}

/**
 * A source that holds a window rather than a table.
 *
 * Ten million rows, and nothing on this page holds more than a few hundred of them. It asks the
 * mock API for a range, keeps the blocks covering the current page plus a few neighbours, and
 * evicts the rest. Memory is `blockSize * maxBlocks`, whatever the total is.
 *
 * It is core, not React: no framework is involved on this page at all. What React adds is a body
 * that moves the window as you scroll instead of when you turn a page.
 */
function makeWindowedSource() {
    windowBlockRequests = 0;

    return createWindowedDataSource({
        blockSize: 100,
        maxBlocks: 8,
        fetchRange: async ({ offset, limit, signal }) => {
            windowBlockRequests += 1;
            const params = new URLSearchParams({
                offset: String(offset),
                limit: String(limit),
                latency: ui.latency.value,
            });

            const response = await fetch(`/api/people/range?${params}`, { signal });
            const body = await response.json();
            if (!response.ok) throw new Error(body.message ?? `The server answered ${response.status}.`);
            return { rows: body.data, totalRows: body.total };
        },
    });
}

// --- rendering ------------------------------------------------------------------------------------

function renderGrid(state) {
    const resolved = api.getColumns().filter((column) => !column.hidden);
    const withSelection = ui.selection.checked;
    const columnCount = resolved.length + (withSelection ? 1 : 0);

    const pageIds = state.rows.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => state.selectedIds.includes(id));

    const head = `
        <thead class="gw-thead">
            <tr class="gw-header-row">
                ${withSelection ? `
                    <th class="gw-header-cell gw-cell--select" scope="col">
                        <input type="checkbox" class="gw-checkbox" data-select-page
                               aria-label="Select all rows on this page" ${allSelected ? 'checked' : ''}>
                    </th>` : ''}
                ${resolved.map((column) => {
                    const direction = api.getSort(column.id);
                    const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
                    return `
                        <th class="gw-header-cell" scope="col" aria-sort="${ariaSort}"
                            style="${column.align ? `text-align:${column.align}` : ''}">
                            <button type="button" class="gw-sort-button" data-sort="${column.id}">
                                <span class="gw-header-label">${escapeHtml(column.header)}</span>
                                <span class="gw-sort-indicator" aria-hidden="true"
                                      data-direction="${direction ?? 'none'}"></span>
                            </button>
                        </th>`;
                }).join('')}
            </tr>
        </thead>`;

    let body;
    if (state.status === 'error' && state.rows.length === 0) {
        body = `
            <tbody class="gw-tbody"><tr class="gw-status-row"><td class="gw-status" colspan="${columnCount}">
                <div class="gw-error" role="alert">
                    <p class="gw-error-title">The rows could not be loaded</p>
                    <p class="gw-error-message">${escapeHtml(state.error?.message ?? '')}</p>
                    ${state.error?.retryable ? '<button type="button" class="gw-button" data-retry>Try again</button>' : ''}
                </div>
            </td></tr></tbody>`;
    } else if (state.status === 'loading' && state.rows.length === 0) {
        body = `<tbody class="gw-tbody"><tr class="gw-status-row">
            <td class="gw-status" colspan="${columnCount}">Loading rows</td></tr></tbody>`;
    } else if (state.rows.length === 0) {
        body = `<tbody class="gw-tbody"><tr class="gw-status-row">
            <td class="gw-status" colspan="${columnCount}">No rows to show</td></tr></tbody>`;
    } else if (ui.optVirtual.checked) {
        // Filled in after the shell is in the document, because the window depends on how tall the
        // scroll container turned out to be.
        body = `<tbody class="gw-tbody"></tbody>`;
    } else {
        body = `
            <tbody class="gw-tbody" aria-busy="${state.status === 'refreshing'}">
                ${state.rows.map((row) => rowMarkup(row, resolved, withSelection, null)).join('')}
            </tbody>`;
    }

    const { pageIndex, pageSize } = state.query.pagination;
    const from = state.totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const to = Math.min(state.totalRows, pageIndex * pageSize + state.rows.length);
    const range = state.isTotalExact
        ? `${from.toLocaleString()}-${to.toLocaleString()} of ${state.totalRows.toLocaleString()}`
        : `${from.toLocaleString()}-${to.toLocaleString()} of many`;

    // keepPreviousData holds the last good page through a failed refresh, which is right: losing
    // the reader's place buys nothing. It does mean the failure has to be announced somewhere,
    // or the grid silently shows rows that are now out of date.
    const staleBanner = state.status === 'error' && state.rows.length > 0
        ? `<div class="stale-banner" role="alert">
               <span><b>Refresh failed.</b> ${escapeHtml(state.error?.message ?? '')} These rows are the last good page.</span>
               ${state.error?.retryable ? '<button type="button" class="gw-button" data-retry>Try again</button>' : ''}
           </div>`
        : '';

    const virtual = ui.optVirtual.checked;

    ui.grid.innerHTML = `
        <div class="gw-toolbar">
            ${state.selectedIds.length > 0
                ? `<span class="gw-selected-count">${state.selectedIds.length} selected</span>
                   <button type="button" class="gw-button" data-clear-selection>Clear</button>`
                : '<span class="gw-selected-count">&nbsp;</span>'}
        </div>
        ${staleBanner}
        <div class="gw-table-wrapper" ${virtual ? 'style="max-height:420px;overflow-y:auto"' : ''}>
            <table class="gw-table" role="grid" aria-label="Employees"
                   ${virtual ? `aria-rowcount="${state.totalRows}"` : ''}>${head}${body}</table>
        </div>
        <div class="gw-pagination" ${virtual ? 'hidden' : ''}>
            <label class="gw-page-size">
                <span class="gw-page-size-label">Rows per page</span>
                <select class="gw-select" data-page-size>
                    ${[10, 25, 50, 100].map((size) =>
                        `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`).join('')}
                </select>
            </label>
            <span class="gw-page-range" aria-live="polite">${range}</span>
            <div class="gw-page-controls">
                <button type="button" class="gw-button gw-button--icon" data-page="prev"
                        aria-label="Previous page" ${state.hasPreviousPage ? '' : 'disabled'}>&#8592;</button>
                <button type="button" class="gw-button gw-button--icon" data-page="next"
                        aria-label="Next page" ${state.hasNextPage ? '' : 'disabled'}>&#8594;</button>
            </div>
        </div>`;

    if (!virtual) return;

    // The scroll position lives in the DOM, and the DOM was just replaced, so it is put back before
    // the rows are drawn into it. A scrollbar that jumps to the top on every fetch is worse than no
    // scrollbar at all.
    const wrapper = ui.grid.querySelector('.gw-table-wrapper');

    // The rows first, then the scroll position. The spacers are what give the container its height,
    // so restoring the offset into an empty container clamps it to zero and the scrollbar and the
    // rows then disagree about where the reader is.
    renderVirtualRows(state);
    wrapper.scrollTop = virtualScrollTop;

    wrapper.addEventListener('scroll', () => {
        virtualScrollTop = wrapper.scrollTop;
        // Only the rows are redrawn on scroll, never the whole grid: rebuilding the container would
        // reset the very scroll position that caused the redraw.
        renderVirtualRows(api.getState());
    }, { passive: true });

    // An editor that was open before the fetch keeps the focus it had.
    ui.grid.querySelector('[data-editor]')?.focus();
}

// --- the three the adapter usually does for you ---------------------------------------------------
//
// Virtualization, editing in place and a row menu are all DOM work, which is why they live in the
// React adapter rather than in the core. None of them needs React: below is the same behaviour in
// plain functions, over the same engine, with the core supplying the one part that is not DOM work.

const ROW_HEIGHT = 40;
let virtualScrollTop = 0;
let editing = null;

/** The rows a scroll position is asking for, and where to put the two spacers. */
function virtualWindowFor(state, viewportHeight) {
    return computeVirtualWindow({
        count: state.totalRows,
        rowHeight: ROW_HEIGHT,
        scrollTop: virtualScrollTop,
        viewportHeight,
    });
}

/**
 * Where the rows the grid is holding start.
 *
 * The windowed source publishes it; every other source publishes nothing and the query is then the
 * only answer, which is only usable once the rows have settled.
 */
function windowOffsetOf(state) {
    const published = state.meta[WINDOW_OFFSET_META];
    if (typeof published === 'number') return published;
    return state.query.pagination.pageIndex * state.query.pagination.pageSize;
}

function renderVirtualRows(state, remeasured = false) {
    const wrapper = ui.grid.querySelector('.gw-table-wrapper');
    const tbody = ui.grid.querySelector('.gw-tbody');
    if (!wrapper || !tbody) return;

    const measured = wrapper.clientHeight;

    const columns = api.getColumns().filter((column) => !column.hidden);
    const withSelection = ui.selection.checked;
    const span = columns.length + (withSelection ? 1 : 0);

    const view = virtualWindowFor(state, wrapper.clientHeight);
    const offset = windowOffsetOf(state);
    const settled = state.status === 'ready' || state.status === 'error' || state.status === 'idle';

    const spacer = (height) =>
        height > 0 ? `<tr class="gw-spacer" aria-hidden="true"><td colspan="${span}" style="height:${height}px"></td></tr>` : '';

    const body = [];
    for (let absolute = view.startIndex; absolute < view.endIndex; absolute += 1) {
        const row = settled ? state.rows[absolute - offset] : undefined;

        if (!row) {
            body.push(`<tr class="gw-row gw-row--skeleton" aria-rowindex="${absolute + 1}" aria-busy="true"
                           style="height:${ROW_HEIGHT}px"><td class="gw-cell" colspan="${span}"><span class="gw-skeleton"></span></td></tr>`);
            continue;
        }

        body.push(rowMarkup(row, columns, withSelection, absolute + 1));
    }

    tbody.innerHTML = spacer(view.paddingTop) + body.join('') + spacer(view.paddingBottom);

    // The container's height depends on the rows just put into it, so the first pass measures an
    // empty box and asks for one screenful too few. One re-measure settles it; the second pass
    // cannot change the height again, because the spacers already carry it.
    if (!remeasured && wrapper.clientHeight !== measured) {
        renderVirtualRows(state, true);
        return;
    }

    // The data window follows the scroll, exactly as the React body does: one page change per page,
    // guarded so publishing state does not set the page again.
    const { pageSize, pageIndex } = state.query.pagination;
    const wanted = Math.floor(view.firstVisibleIndex / pageSize);
    if (state.totalRows > 0 && wanted !== pageIndex) api.setPage(wanted);
}

/** One row, shared by the ordinary body and the virtual one so the cells cannot drift apart. */
function rowMarkup(row, columns, withSelection, ariaRowIndex) {
    const cells = columns.map((column) => {
        const editable = ui.optEdit.checked && column.id === 'name';
        const isOpen = editing && String(editing.rowId) === String(row.id) && editing.columnId === column.id;

        const content = isOpen
            ? `<input class="gw-editor" data-editor value="${escapeHtml(column.getText(row.data))}" aria-label="${escapeHtml(column.header ?? column.id)}">`
            : column.id === 'active'
              ? `<span class="status-badge" data-active="${row.data.active}">${escapeHtml(column.getText(row.data))}</span>`
              : column.id === 'name'
                ? `<span class="gw-cell-content">${personIcon(row.data.active)}<span class="gw-cell-text">${escapeHtml(column.getText(row.data))}</span></span>`
                : escapeHtml(column.getText(row.data));

        const trigger = editable && !isOpen
            ? `<button type="button" class="gw-edit-trigger" data-edit="${escapeHtml(row.id)}" data-column="${column.id}">${content}</button>`
            : content;

        return `<td class="gw-cell" style="${column.align ? `text-align:${column.align}` : ''}">${trigger}</td>`;
    }).join('');

    return `<tr class="gw-row ${row.selected ? 'gw-row--selected' : ''}" data-row-id="${escapeHtml(row.id)}"
                ${ariaRowIndex ? `aria-rowindex="${ariaRowIndex}"` : ''}
                ${withSelection ? `aria-selected="${row.selected}"` : ''}>
            ${withSelection ? `
                <td class="gw-cell gw-cell--select">
                    <input type="checkbox" class="gw-checkbox" data-select-row="${escapeHtml(row.id)}"
                           aria-label="Select row" ${row.selected ? 'checked' : ''}>
                </td>` : ''}
            ${cells}
        </tr>`;
}

/** Commits an edit to the server, then asks the grid to fetch what the server now holds. */
async function commitEdit(rowId, columnId, value) {
    editing = null;
    logEvent('edit', `${columnId} on row ${rowId}`);

    const response = await fetch('/api/people/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: Number(rowId), columnId, value }),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        logEvent('edit:refused', body.message ?? `The server answered ${response.status}.`);
    }

    // The stored value is the one to show, so the rows are asked for again rather than patched
    // locally. A local patch and a later refetch disagreeing is how a grid starts lying.
    localRows = null;
    await api.refresh();
}

function mainRowMenu(rowId) {
    const row = api.getState().rows.find((entry) => String(entry.id) === String(rowId));
    if (!row) return [];

    return [
        { label: 'Inspect', run: () => logEvent('inspect', `${row.data.name}, ${row.data.city}`) },
        {
            label: row.data.active ? 'Deactivate' : 'Activate',
            run: () => commitEdit(row.id, 'active', !row.data.active),
        },
        { label: 'Clear the name', destructive: true, run: () => commitEdit(row.id, 'name', '') },
    ];
}

function renderStats(state) {
    const entries = [
        ['status', state.status],
        ['rows on page', state.rows.length],
        ['total rows', state.isTotalExact ? state.totalRows.toLocaleString() : `${state.totalRows.toLocaleString()}+`],
        ['total is exact', String(state.isTotalExact)],
        ['page', `${state.query.pagination.pageIndex + 1} / ${state.isTotalExact ? state.pageCount : '?'}`],
        ['selected', state.selectedIds.length],
        ['fetch version', state.version],
    ];

    // Memory is a function of the cache, not of the table. These two numbers are the claim.
    if (windowedSource) {
        entries.push(['blocks cached', windowedSource.cachedBlockCount]);
        entries.push(['rows resident', (windowedSource.cachedBlockCount * 100).toLocaleString()]);
        entries.push(['block requests', windowBlockRequests]);
    }

    ui.stats.innerHTML = entries
        .map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
        .join('');
}

function renderCapabilities() {
    const isLocal = ui.sourceKind.value === 'local';
    const capabilities = isLocal
        ? { sort: false, filter: false, search: false, paginate: false }
        : readCapabilities();

    ui.badges.innerHTML = Object.entries(capabilities)
        .map(([facet, byServer]) => {
            const who = isLocal ? 'client' : byServer ? 'server' : 'client';
            return `<span class="badge" data-who="${who}">${facet}<b>${who === 'server' ? 'server' : 'pipeline'}</b></span>`;
        })
        .join('');

    const clientSide = Object.entries(capabilities).filter(([, byServer]) => !byServer).map(([facet]) => facet);

    ui.seamNote.textContent = isLocal
        ? 'An array declares nothing, so the pipeline does all four. It also answers synchronously, which is why there is no loading state here.'
        : clientSide.length === 0
            ? 'The server resolves every facet, so the pipeline runs no stage at all. The grid renders exactly the page it was given.'
            : `The server left ${clientSide.join(', ')} undone, so the pipeline applies ${clientSide.length === 1 ? 'it' : 'them'} to the rows that arrived. Note what that means for a paged response: it can only work with the rows on this page.`;
}

function logEvent(name, detail) {
    events.unshift(`<div><b>${name}</b> ${detail ?? ''}</div>`);
    events.length = Math.min(events.length, 40);
    ui.log.innerHTML = events.join('');
}

// --- wiring -----------------------------------------------------------------------------------

ui.grid.addEventListener('click', (event) => {
    const sort = event.target.closest('[data-sort]');
    if (sort) return api.toggleSort(sort.dataset.sort, { additive: event.shiftKey });

    const page = event.target.closest('[data-page]');
    if (page) return page.dataset.page === 'next' ? api.nextPage() : api.previousPage();

    if (event.target.closest('[data-retry]')) return void api.refresh();
    const trigger = event.target.closest('[data-edit]');
    if (trigger) {
        // Editing is the page's own state: which cell is open, and nothing else. The value belongs
        // to the server, and the row belongs to the engine.
        editing = { rowId: trigger.dataset.edit, columnId: trigger.dataset.column };
        renderGrid(api.getState());
        const editor = ui.grid.querySelector('[data-editor]');
        editor?.focus();
        editor?.select();
        return;
    }

    if (event.target.closest('[data-clear-selection]')) return api.clearSelection();
    if (event.target.closest('[data-select-page]')) return api.selectPage();

    const row = event.target.closest('[data-select-row]');
    if (row) {
        const id = Number(row.dataset.selectRow);
        return api.toggleRowSelection(Number.isNaN(id) ? row.dataset.selectRow : id);
    }
});

// Enter commits, Escape cancels, blur commits. Losing text because you clicked away is the single
// most complained-about behaviour in an editable grid.
ui.grid.addEventListener('keydown', (event) => {
    const editor = event.target.closest('[data-editor]');
    if (!editor || !editing) return;

    if (event.key === 'Enter') {
        event.preventDefault();
        void commitEdit(editing.rowId, editing.columnId, editor.value);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        editing = null;
        renderGrid(api.getState());
    }
});

ui.grid.addEventListener('focusout', (event) => {
    const editor = event.target.closest('[data-editor]');
    if (editor && editing) void commitEdit(editing.rowId, editing.columnId, editor.value);
});

ui.grid.addEventListener('contextmenu', (event) => {
    if (!ui.optActions.checked) return;
    const row = event.target.closest('.gw-row[data-row-id]');
    if (!row) return;
    event.preventDefault();
    openRowMenu(mainRowMenu(row.dataset.rowId), event.clientX, event.clientY, ui.grid);
});

// A left click opens it too. Nobody discovers a right-click-only menu.
ui.grid.addEventListener('click', (event) => {
    if (!ui.optActions.checked) return;
    menuFromClick(event, ui.grid, mainRowMenu);
});

let pageSizeBeforeVirtual = null;

ui.optVirtual.addEventListener('change', () => {
    virtualScrollTop = 0;

    // A page stops being a page anyone turns and becomes the window the body moves, so it is worth
    // more rows. Without this, ticking the box over a 25-row page looks like nothing happened,
    // which is a fair reading: there is nothing to window.
    if (ui.optVirtual.checked) {
        pageSizeBeforeVirtual = api.getState().query.pagination.pageSize;
        api.setPageSize(200);
        logEvent('virtual', 'on, page size raised to 200');
    } else if (pageSizeBeforeVirtual !== null) {
        api.setPageSize(pageSizeBeforeVirtual);
        pageSizeBeforeVirtual = null;
        logEvent('virtual', 'off');
    }

    renderGrid(api.getState());
});
ui.optEdit.addEventListener('change', () => renderGrid(api.getState()));

ui.grid.addEventListener('change', (event) => {
    const pageSize = event.target.closest('[data-page-size]');
    if (pageSize) api.setPageSize(Number(pageSize.value));
});

ui.search.addEventListener('input', () => api.setSearch(ui.search.value));

ui.department.addEventListener('change', () => {
    api.setFilter('department', ui.department.value ? { operator: 'eq', value: ui.department.value } : null);
});

ui.salary.addEventListener('change', () => {
    const value = Number(ui.salary.value);
    api.setFilter('salary', value > 0 ? { operator: 'gte', value } : null);
});

ui.clearFilters.addEventListener('click', () => {
    ui.search.value = '';
    ui.department.value = '';
    ui.salary.value = '';
    api.setQuery({ search: '', filters: [] });
});

ui.pluginActive.addEventListener('change', () => {
    if (ui.pluginActive.checked) {
        removePlugin = api.use(activeOnlyPlugin());
        logEvent('plugin added', 'playground:active-only');
    } else if (removePlugin) {
        removePlugin();
        removePlugin = null;
        logEvent('plugin removed', 'playground:active-only');
    }
});

ui.selection.addEventListener('change', () => {
    api.setSelectionMode(ui.selection.checked ? 'multiple' : 'none');
    renderGrid(api.getState());
});

ui.failNext.addEventListener('click', async () => {
    await fetch('/api/fail-next');
    logEvent('armed', 'the next request will fail with a 503');
    void api.refresh();
});

ui.refresh.addEventListener('click', () => void api.refresh());

for (const input of ui.capabilitySet.querySelectorAll('[data-capability]')) {
    input.addEventListener('change', () => {
        renderCapabilities();
        api.setDataSource(makeRemoteSource(readCapabilities()));
        logEvent('data source replaced', `capabilities: ${JSON.stringify(readCapabilities())}`);
    });
}

ui.withTotal.addEventListener('change', () => void api.refresh());
ui.latency.addEventListener('change', () => void api.refresh());
ui.sourceKind.addEventListener('change', () => void build());

ui.theme.addEventListener('change', () => {
    const choice = ui.theme.value;
    document.documentElement.dataset.theme = choice === 'system'
        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : choice;
    ui.grid.dataset.gwTheme = choice === 'system' ? '' : choice;
    if (choice === 'system') delete ui.grid.dataset.gwTheme;
});

ui.accent.addEventListener('input', () => ui.grid.style.setProperty('--gw-accent', ui.accent.value));
ui.rowHeight.addEventListener('input', () => ui.grid.style.setProperty('--gw-row-height', `${ui.rowHeight.value}px`));

// --- build ------------------------------------------------------------------------------------

async function build() {
    const kind = ui.sourceKind.value;
    const isLocal = kind === 'local';
    const isWindowed = kind === 'windowed';
    // A windowed source resolves everything itself: it answers with exactly the window asked for,
    // over rows nobody local has ever seen.
    ui.capabilitySet.disabled = isLocal || isWindowed;

    // Destroying the old engine aborts anything in flight and releases every listener. Skipping
    // this is how a page like the one you are reading ends up with four engines racing each other.
    api?.destroy();
    removePlugin = null;
    events.length = 0;

    windowedSource?.dispose?.();
    windowedSource = isWindowed ? makeWindowedSource() : null;

    const dataSource = isLocal
        ? createLocalDataSource(await loadLocalRows())
        : isWindowed
          ? windowedSource
          : makeRemoteSource(readCapabilities());

    api = createGridEngine({
        columns,
        dataSource,
        selectionMode: ui.selection.checked ? 'multiple' : 'none',
        // A page that divides into the block size, so one page is one block rather than a straddle.
        initialQuery: { pagination: { pageIndex: 0, pageSize: isWindowed ? 50 : 25 } },
        // Local search is instantaneous, so a delay there would only feel broken.
        queryDebounceMs: isLocal ? 0 : 250,
    });

    if (ui.pluginActive.checked) removePlugin = api.use(activeOnlyPlugin());

    api.subscribe((state) => {
        renderGrid(state);
        renderStats(state);
    });

    api.on('fetch:start', ({ query }) => logEvent('fetch:start', `page ${query.pagination.pageIndex + 1}${query.search ? `, search "${query.search}"` : ''}`));
    api.on('fetch:success', ({ totalRows, durationMs }) => logEvent('fetch:success', `${totalRows.toLocaleString()} matching, ${Math.round(durationMs)}ms`));
    api.on('fetch:error', ({ error }) => logEvent('fetch:error', error.message));
    api.on('query:change', ({ query }) => logEvent('query:change', `sort ${query.sort.length}, filters ${query.filters.length}, page ${query.pagination.pageIndex + 1}`));
    api.on('selection:change', ({ selectedIds }) => logEvent('selection:change', `${selectedIds.length} selected`));
    api.on('plugin:error', ({ plugin, error }) => logEvent('plugin:error', `${plugin}: ${error}`));

    renderCapabilities();
    renderGrid(api.getState());
    renderStats(api.getState());
    logEvent(
        'engine created',
        isLocal ? 'local array' : isWindowed ? 'windowed source, 10,000,000 rows' : 'mock REST API',
    );
}

ui.theme.dispatchEvent(new Event('change'));

// The tree panel owns its own engine, controller and markup. It is here to show that a hierarchy is
// core rather than an adapter feature, so it shares nothing with the grid below but the stylesheet.
await initTreePanel({
    panel: element('tree-panel'),
    grid: element('tree-grid'),
    stats: element('tree-stats'),
    search: element('tree-search'),
    keepAncestors: element('tree-search-ancestors'),
    logEvent,
    latency: () => ui.latency.value,
});

dismissMenuOnOutsidePress();
await build();
