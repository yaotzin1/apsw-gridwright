/**
 * The playground's mock API, with no Node and no DOM in it.
 *
 * Two hosts run this same code: `scripts/serve-example.mjs` answers real HTTP requests with it
 * (`npm run example`), and `examples/playground/static-api.js` answers `fetch` calls in the browser
 * on the GitHub Pages build, where there is no server. Because it is one module, the hosted demo
 * cannot drift from the local one, and it keeps the property the demo exists to show: it honours
 * exactly the capabilities the page says the source declares, passed as `serverDoes`.
 *
 * `handle` takes a request already split into parts and answers `{ status, contentType, body }`, or
 * `null` for a path it does not own. Reading and limiting a request body is the host's job.
 */

// ---------------------------------------------------------------------------------------------
// The dataset
// ---------------------------------------------------------------------------------------------

const FIRST = ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy', 'Annie', 'Evelyn', 'Radia', 'Barbara', 'Margaret', 'Jean', 'Karen', 'Shafi', 'Frances', 'Adele', 'Hedy'];
const LAST = ['Lovelace', 'Hopper', 'Johnson', 'Jackson', 'Vaughan', 'Easley', 'Boyd', 'Perlman', 'Liskov', 'Hamilton', 'Bartik', 'Spärck Jones', 'Goldwasser', 'Allen', 'Goldberg', 'Lamarr'];
const DEPARTMENTS = ['Engineering', 'Research', 'Operations', 'Design', 'Finance'];
const CITIES = ['Kraków', 'Warsaw', 'Lisbon', 'Berlin', 'Toronto', 'Nairobi', 'Osaka'];
// Long-ish text, because a table wide enough to scroll sideways is what pinning and resizing are
// for, and six short columns never gets there.
const TITLES = [
    'Principal Engineer', 'Staff Software Engineer', 'Engineering Manager', 'Senior Data Scientist',
    'Head of Platform Reliability', 'Product Designer', 'Financial Controller', 'Operations Lead',
];

/** Deterministic, and never a real address: the domain is reserved for documentation. */
const emailFor = (first, last, index) =>
    `${first}.${last.replace(/[^A-Za-z]/g, '')}${index + 1}@example.com`.toLowerCase();

/** Deterministic, so a page looks the same on every reload and a bug is reproducible. */
function buildPeople(count) {
    const people = [];
    for (let index = 0; index < count; index += 1) {
        const first = FIRST[index % FIRST.length];
        const last = LAST[Math.floor(index / FIRST.length) % LAST.length];
        const year = 2014 + (index % 11);
        const month = String((index % 12) + 1).padStart(2, '0');
        const day = String((index % 27) + 1).padStart(2, '0');

        people.push({
            id: index + 1,
            name: `${first} ${last}`,
            title: TITLES[index % TITLES.length],
            email: emailFor(first, last, index),
            department: DEPARTMENTS[index % DEPARTMENTS.length],
            city: CITIES[index % CITIES.length],
            salary: 62_000 + ((index * 37) % 98_000),
            startedOn: `${year}-${month}-${day}`,
            active: index % 7 !== 0,
        });
    }
    return people;
}

const PEOPLE = buildPeople(5_000);

/**
 * A table nobody holds.
 *
 * Ten million rows generated one range at a time, which is what a real endpoint over a real table
 * does. It exists so the windowed source on the playground is answering a network request rather
 * than a function in the same file pretending to be one.
 */
const WINDOW_TOTAL = 10_000_000;

function buildRange(offset, limit) {
    const rows = [];
    const end = Math.min(offset + limit, WINDOW_TOTAL);

    for (let index = offset; index < end; index += 1) {
        const first = FIRST[index % FIRST.length];
        const last = LAST[Math.floor(index / FIRST.length) % LAST.length];
        const year = 2014 + (index % 11);
        const month = String((index % 12) + 1).padStart(2, '0');
        const day = String((index % 27) + 1).padStart(2, '0');

        rows.push({
            id: index + 1,
            name: `${first} ${last} #${(index + 1).toLocaleString('en-US')}`,
            title: TITLES[index % TITLES.length],
            email: emailFor(first, last, index),
            department: DEPARTMENTS[index % DEPARTMENTS.length],
            city: CITIES[index % CITIES.length],
            salary: 62_000 + ((index * 37) % 98_000),
            startedOn: `${year}-${month}-${day}`,
            active: index % 7 !== 0,
        });
    }

    return rows;
}

/**
 * The stored tree.
 *
 * An adjacency list, which is what a database holds: one row per node, each naming its parent and
 * its position among its siblings. The nested set intervals the grid works with are derived from
 * this on the client and never stored, because they are a property of the whole tree and every
 * insert would rewrite half of them.
 *
 * A row with several parents needs an edge table instead of a `parentId` column. The shape below
 * is the single-parent case, which is what this page shows.
 */
const FILES = new Map([
    ['docs', { id: 'docs', name: 'Documents', kind: 'folder', owner: 'Ada', parentId: null, position: 0 }],
    ['cv', { id: 'cv', name: 'CV.pdf', kind: 'file', owner: 'Ada', parentId: 'docs', position: 0 }],
    ['work', { id: 'work', name: 'Work', kind: 'folder', owner: 'Grace', parentId: 'docs', position: 1 }],
    ['plan', { id: 'plan', name: 'Plan.md', kind: 'file', owner: 'Grace', parentId: 'work', position: 0 }],
    ['notes', { id: 'notes', name: 'Notes.md', kind: 'file', owner: 'Grace', parentId: 'work', position: 1 }],
    ['photos', { id: 'photos', name: 'Photos', kind: 'folder', owner: 'Mary', parentId: null, position: 0 }],
    ['beach', { id: 'beach', name: 'Beach.jpg', kind: 'file', owner: 'Mary', parentId: 'photos', position: 0 }],
    ['city', { id: 'city', name: 'City.jpg', kind: 'file', owner: 'Mary', parentId: 'photos', position: 1 }],
]);

/** The stored rows in sibling order, which is all the client needs to rebuild the hierarchy. */
function filesAsRows() {
    return [...FILES.values()]
        .slice()
        .sort((a, b) => (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.position - b.position)
        .map((row) => ({ ...row }));
}

function siblingsOf(parentId) {
    return [...FILES.values()].filter((row) => row.parentId === parentId).sort((a, b) => a.position - b.position);
}

function renumber(parentId) {
    siblingsOf(parentId).forEach((row, index) => {
        row.position = index;
    });
}

/** Every descendant of a node, so removing a folder does not leave its files orphaned. */
function subtreeOf(id) {
    const found = [id];
    for (let at = 0; at < found.length; at += 1) {
        for (const row of FILES.values()) {
            if (row.parentId === found[at]) found.push(row.id);
        }
    }
    return found;
}

/**
 * One change, applied.
 *
 * This is the whole server side of a tree grid: four statements, one per change type, and the
 * payload the grid sends is already shaped for them. Nothing here needs to know what a nested set
 * is, and nothing here recomputes one.
 */
function applyTreeChange(change) {
    switch (change.type) {
        case 'update': {
            const row = FILES.get(String(change.rowId));
            if (!row) return { ok: false, message: `No row ${change.rowId}.` };
            Object.assign(row, change.row, { id: row.id, parentId: row.parentId, position: row.position });
            return { ok: true };
        }

        case 'insert': {
            const parentId = change.parentRowId === null ? null : String(change.parentRowId);
            if (parentId !== null && !FILES.has(parentId)) return { ok: false, message: `No parent ${parentId}.` };

            const id = String(change.rowId);
            FILES.set(id, { ...change.row, id, parentId, position: change.index });
            // The insert claimed a position, so everything after it moves down one.
            siblingsOf(parentId)
                .filter((row) => row.id !== id && row.position >= change.index)
                .forEach((row) => { row.position += 1; });
            renumber(parentId);
            return { ok: true };
        }

        case 'move': {
            const row = FILES.get(String(change.rowId));
            if (!row) return { ok: false, message: `No row ${change.rowId}.` };

            const from = row.parentId;
            const to = change.toParentRowId === null ? null : String(change.toParentRowId);
            // A move into a node's own subtree detaches that subtree from the tree entirely. The
            // grid refuses it too; a server that trusts the client here loses rows.
            if (to !== null && subtreeOf(row.id).includes(to)) {
                return { ok: false, message: 'That would move a folder inside itself.' };
            }

            row.parentId = to;
            row.position = change.index - 0.5;
            renumber(from);
            renumber(to);
            return { ok: true };
        }

        case 'remove': {
            const ids = change.scope === 'placement' ? [String(change.rowId)] : subtreeOf(String(change.rowId));
            const parentId = FILES.get(String(change.rowId))?.parentId ?? null;
            ids.forEach((id) => FILES.delete(id));
            renumber(parentId);
            return { ok: true };
        }

        default:
            return { ok: false, message: `Unknown change ${change.type}.` };
    }
}

/** Edits to the flat table, by row id. The rows themselves are generated, so only these are kept. */
const PEOPLE_EDITS = new Map();

/** The artificial delay a request may ask for, capped so one request cannot hold a socket forever. */
const latencyOf = (searchParams) => Math.min(5_000, Math.max(0, Number(searchParams.get('latency') ?? 0) || 0));

// ---------------------------------------------------------------------------------------------
// The mock API
// ---------------------------------------------------------------------------------------------

const text = (row, columnId) => String(row[columnId] ?? '').toLowerCase();

function applySort(rows, sortParam) {
    if (!sortParam) return rows;

    const specs = sortParam.split(',').map((entry) => {
        const [columnId, direction] = entry.split(':');
        return { columnId, direction: direction === 'desc' ? -1 : 1 };
    });

    return [...rows].sort((left, right) => {
        for (const { columnId, direction } of specs) {
            const a = left[columnId];
            const b = right[columnId];
            if (a === b) continue;
            const result = typeof a === 'number' && typeof b === 'number'
                ? a - b
                : String(a).localeCompare(String(b), undefined, { numeric: true });
            if (result !== 0) return result * direction;
        }
        return 0;
    });
}

function applyFilters(rows, filtersParam) {
    if (!filtersParam) return rows;

    let filters;
    try {
        filters = JSON.parse(filtersParam);
    } catch {
        return rows;
    }
    // Only well-formed entries, read field by field: the parameter is whatever a client sent.
    if (!Array.isArray(filters)) return rows;
    filters = filters
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.columnId === 'string' && typeof entry.operator === 'string')
        .map((entry) => ({ columnId: entry.columnId, operator: entry.operator, value: entry.value }))
        .filter((entry) => Object.hasOwn(PEOPLE[0] ?? {}, entry.columnId));

    // Every operator the grid's filter controls can send, with the meanings `matchesFilter` gives them
    // on the client. A server that disagreed with the pipeline about "between" would make the
    // capability switch change the answer, not just where the work runs.
    return rows.filter((row) =>
        filters.every(({ columnId, operator, value }) => {
            const cell = row[columnId];
            const needle = String(value ?? '').toLowerCase();
            const empty = cell === null || cell === undefined || String(cell).trim() === '';
            switch (operator) {
                case 'eq': return same(cell, value);
                case 'ne': return !same(cell, value);
                case 'contains': return text(row, columnId).includes(needle);
                case 'notContains': return !text(row, columnId).includes(needle);
                case 'startsWith': return text(row, columnId).startsWith(needle);
                case 'endsWith': return text(row, columnId).endsWith(needle);
                case 'gt': return compare(cell, value) > 0;
                case 'gte': return compare(cell, value) >= 0;
                case 'lt': return compare(cell, value) < 0;
                case 'lte': return compare(cell, value) <= 0;
                case 'between':
                    return Array.isArray(value) && compare(cell, value[0]) >= 0 && compare(cell, value[1]) <= 0;
                case 'in': return Array.isArray(value) && value.some((candidate) => same(cell, candidate));
                case 'notIn': return Array.isArray(value) && !value.some((candidate) => same(cell, candidate));
                case 'isEmpty': return empty;
                case 'isNotEmpty': return !empty;
                default: return true;
            }
        }),
    );
}

const same = (cell, value) => String(cell).toLowerCase() === String(value).toLowerCase();

/** Numbers as numbers, ISO dates as timestamps, anything else as text. */
function compare(cell, value) {
    const asNumber = (input) => (typeof input === 'number' ? input
        : /^\d{4}-\d{2}-\d{2}/.test(String(input)) ? Date.parse(String(input))
        : Number(input));
    const left = asNumber(cell);
    const right = asNumber(value);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return String(cell).localeCompare(String(value), undefined, { numeric: true });
}

function applySearch(rows, term) {
    if (!term) return rows;
    const needle = term.toLowerCase();
    return rows.filter((row) =>
        ['name', 'title', 'email', 'department', 'city', 'startedOn'].some((columnId) => text(row, columnId).includes(needle))
        || String(row.salary).includes(needle),
    );
}

let failNextRequest = false;

async function handle({ method, pathname, searchParams, text: body, formatMarkdownDocument }) {
    if (pathname === '/api/fail-next') {
        failNextRequest = true;
        return reply(200, { armed: true });
    }

    if (pathname === '/api/people/all') {
        return reply(200, PEOPLE.map((row) => ({ ...row, ...PEOPLE_EDITS.get(row.id) })));
    }

    // The stored tree, and one change applied to it. Reload the page and what you changed is still
    // there, because it is here rather than in the page.
    if (pathname === '/api/files') {
        if (method === 'GET') return reply(200, { data: filesAsRows() });

        if (method === 'POST') {
            const change = parseJson(body);
            if (!change) return reply(400, { message: 'That was not a change.' });

            const latency = latencyOf(searchParams);
            if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

            const result = applyTreeChange(change);
            // A refused change is a 409, and the grid reverts the row it had already applied.
            if (!result.ok) return reply(409, { message: result.message });
            return reply(200, { data: filesAsRows() });
        }

        return reply(405, { message: 'GET or POST.' });
    }

    // A report service: Markdown in, a rendered document out, as a download. A real one would answer
    // with a PDF from a rendering engine; this one uses the package's own printable document, which
    // is what lets the playground show the "the server renders it, the grid saves it" route.
    if (pathname === '/api/reports' && method === 'POST') {
        const markdown = body;
        if (!markdown.trim()) return reply(422, { message: 'The report was empty.' });

        const html = formatMarkdownDocument(`${markdown}

*Rendered by the report service at ${new Date().toISOString()}.*`, {
            title: 'Employee cards',
        });
        return { status: 200, contentType: 'text/html; charset=utf-8', body: html };
    }

    // One edited cell, stored against the row it belongs to.
    if (pathname === '/api/people/edit' && method === 'POST') {
        const edit = parseJson(body);
        if (!edit || edit.rowId === undefined) return reply(400, { message: 'That was not an edit.' });

        const latency = latencyOf(searchParams);
        if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

        if (String(edit.value).trim() === '') {
            return reply(422, { message: 'A value cannot be empty.' });
        }

        PEOPLE_EDITS.set(edit.rowId, { ...PEOPLE_EDITS.get(edit.rowId), [edit.columnId]: edit.value });
        return reply(200, { stored: PEOPLE_EDITS.get(edit.rowId) });
    }

    // A range of the ten-million-row table. `offset` and `limit` rather than `page`, because a
    // windowed source asks for a window and never for a page.
    if (pathname === '/api/people/range') {
        const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));
        const limit = Math.min(1_000, Math.max(1, Number(searchParams.get('limit') ?? 100)));
        const latency = latencyOf(searchParams);
        if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

        return reply(200, { data: buildRange(offset, limit), total: WINDOW_TOTAL });
    }

    if (pathname !== '/api/people') return null;

    const latency = latencyOf(searchParams);
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

    if (failNextRequest) {
        failNextRequest = false;
        // A real message rather than a status code, because that is what the grid surfaces and
        // what the reader has to act on.
        return reply(503, { message: 'The employee directory is temporarily unavailable.' });
    }

    // Only what the client declared. A source that says it does not sort must really answer
    // unsorted, or the demo proves nothing.
    const serverDoes = new Set((searchParams.get('serverDoes') ?? '').split(',').filter(Boolean));

    // Stored edits are applied before anything else, so a sorted or searched page sees the value
    // the reader saved rather than the one the generator produced.
    let rows = PEOPLE_EDITS.size === 0
        ? PEOPLE
        : PEOPLE.map((row) => (PEOPLE_EDITS.has(row.id) ? { ...row, ...PEOPLE_EDITS.get(row.id) } : row));
    if (serverDoes.has('filter')) rows = applyFilters(rows, searchParams.get('filters'));
    if (serverDoes.has('search')) rows = applySearch(rows, searchParams.get('search'));
    if (serverDoes.has('sort')) rows = applySort(rows, searchParams.get('sort'));

    const total = rows.length;

    if (serverDoes.has('paginate')) {
        const page = Math.max(1, Number(searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(searchParams.get('pageSize') ?? 25));
        rows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    }

    // Omitting the total on request, so the "of many" path is reachable from the page.
    const withTotal = searchParams.get('withTotal') !== 'false';
    return reply(200, withTotal ? { data: rows, total } : { data: rows });
}

const reply = (status, payload) => ({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload) });

function parseJson(body) {
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
}

export const mockApi = { handle, PEOPLE_COUNT: PEOPLE.length };
