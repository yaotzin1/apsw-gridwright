/**
 * Serves the example playground, with a mock API behind it.
 *
 *   npm run example        builds the package, then serves it on http://localhost:5173
 *
 * The page imports the real built files from `dist/`, so what you click is the published artifact
 * rather than a demo reimplementation. That needs a server: browsers refuse ES module imports over
 * `file://`, and opening the HTML directly gives a blank page and a CORS error.
 *
 * The mock API is the interesting half. It honours exactly the capabilities the page says the
 * source declares, passed as `serverDoes`. Declare `paginate` alone and the server really does
 * return one unsorted page, so the sorting you then see is the client pipeline working on the 25
 * rows it received. The demo cannot quietly cheat on the point it exists to make.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.cjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
};

// ---------------------------------------------------------------------------------------------
// The dataset
// ---------------------------------------------------------------------------------------------

const FIRST = ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy', 'Annie', 'Evelyn', 'Radia', 'Barbara', 'Margaret', 'Jean', 'Karen', 'Shafi', 'Frances', 'Adele', 'Hedy'];
const LAST = ['Lovelace', 'Hopper', 'Johnson', 'Jackson', 'Vaughan', 'Easley', 'Boyd', 'Perlman', 'Liskov', 'Hamilton', 'Bartik', 'Spärck Jones', 'Goldwasser', 'Allen', 'Goldberg', 'Lamarr'];
const DEPARTMENTS = ['Engineering', 'Research', 'Operations', 'Design', 'Finance'];
const CITIES = ['Kraków', 'Warsaw', 'Lisbon', 'Berlin', 'Toronto', 'Nairobi', 'Osaka'];

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
            department: DEPARTMENTS[index % DEPARTMENTS.length],
            city: CITIES[index % CITIES.length],
            salary: 62_000 + ((index * 37) % 98_000),
            startedOn: `${year}-${month}-${day}`,
            active: index % 7 !== 0,
        });
    }

    return rows;
}

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

    return rows.filter((row) =>
        filters.every(({ columnId, operator, value }) => {
            const cell = row[columnId];
            switch (operator) {
                case 'eq': return String(cell).toLowerCase() === String(value).toLowerCase();
                case 'ne': return String(cell).toLowerCase() !== String(value).toLowerCase();
                case 'contains': return text(row, columnId).includes(String(value).toLowerCase());
                case 'gte': return Number(cell) >= Number(value);
                case 'lte': return Number(cell) <= Number(value);
                case 'gt': return Number(cell) > Number(value);
                case 'lt': return Number(cell) < Number(value);
                default: return true;
            }
        }),
    );
}

function applySearch(rows, term) {
    if (!term) return rows;
    const needle = term.toLowerCase();
    return rows.filter((row) =>
        ['name', 'department', 'city', 'startedOn'].some((columnId) => text(row, columnId).includes(needle))
        || String(row.salary).includes(needle),
    );
}

let failNextRequest = false;

async function handleApi(request, response, url) {
    if (url.pathname === '/api/fail-next') {
        failNextRequest = true;
        return json(response, 200, { armed: true });
    }

    if (url.pathname === '/api/people/all') {
        return json(response, 200, PEOPLE);
    }

    // A range of the ten-million-row table. `offset` and `limit` rather than `page`, because a
    // windowed source asks for a window and never for a page.
    if (url.pathname === '/api/people/range') {
        const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
        const limit = Math.min(1_000, Math.max(1, Number(url.searchParams.get('limit') ?? 100)));
        const latency = Number(url.searchParams.get('latency') ?? 0);
        if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

        return json(response, 200, { data: buildRange(offset, limit), total: WINDOW_TOTAL });
    }

    if (url.pathname !== '/api/people') return false;

    const latency = Number(url.searchParams.get('latency') ?? 0);
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

    if (failNextRequest) {
        failNextRequest = false;
        // A real message rather than a status code, because that is what the grid surfaces and
        // what the reader has to act on.
        return json(response, 503, { message: 'The employee directory is temporarily unavailable.' });
    }

    // Only what the client declared. A source that says it does not sort must really answer
    // unsorted, or the demo proves nothing.
    const serverDoes = new Set((url.searchParams.get('serverDoes') ?? '').split(',').filter(Boolean));

    let rows = PEOPLE;
    if (serverDoes.has('filter')) rows = applyFilters(rows, url.searchParams.get('filters'));
    if (serverDoes.has('search')) rows = applySearch(rows, url.searchParams.get('search'));
    if (serverDoes.has('sort')) rows = applySort(rows, url.searchParams.get('sort'));

    const total = rows.length;

    if (serverDoes.has('paginate')) {
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 25));
        rows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    }

    // Omitting the total on request, so the "of many" path is reachable from the page.
    const withTotal = url.searchParams.get('withTotal') !== 'false';
    return json(response, 200, withTotal ? { data: rows, total } : { data: rows });
}

function json(response, status, body) {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        'Cache-Control': 'no-store',
    });
    response.end(payload);
    return true;
}

// ---------------------------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------------------------

function serveStatic(request, response, url) {
    const requested = url.pathname === '/' ? '/examples/playground/index.html' : url.pathname;
    const filePath = path.join(ROOT, decodeURIComponent(requested));

    // Anything resolving outside the repository is a traversal attempt, not a typo.
    if (!filePath.startsWith(ROOT)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(
            `Not found: ${requested}\n\n`
            + (requested.startsWith('/dist/')
                ? 'The package has not been built. Run: npm run build\n'
                : ''),
        );
        return;
    }

    response.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

    try {
        if (url.pathname.startsWith('/api/')) {
            const handled = await handleApi(request, response, url);
            if (handled !== false) return;
        }
        serveStatic(request, response, url);
    } catch (error) {
        console.error(error);
        if (!response.headersSent) response.writeHead(500);
        response.end('Server error');
    }
});

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.js'))) {
    console.error('dist/ is missing. Run `npm run build` first, or use `npm run example`.\n');
    process.exit(1);
}

server.listen(PORT, () => {
    console.log('');
    console.log(`  apsw-gridwright playground   http://localhost:${PORT}/`);
    console.log(`  React version                http://localhost:${PORT}/examples/playground/react.html`);
    console.log('');
    console.log(`  Serving the built package from dist/, with ${PEOPLE.length.toLocaleString('en-US')} mock rows.`);
    console.log('  Ctrl+C to stop.');
    console.log('');
});
