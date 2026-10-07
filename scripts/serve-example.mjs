/**
 * Serves the example playground, with a mock API behind it.
 *
 *   npm run example        builds the package, then serves it on http://127.0.0.1:5173
 *   HOST=0.0.0.0 npm run example:serve   the same, reachable from other machines (deliberately opt-in)
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
import { fileURLToPath, pathToFileURL } from 'node:url';

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

import { mockApi } from '../examples/playground/mock-api.js';

// ---------------------------------------------------------------------------------------------
// The mock API: the data and the endpoints are examples/playground/mock-api.js, shared with the
// hosted demo. This file only reads the request and writes the response.
// ---------------------------------------------------------------------------------------------

/** Bodies above this are refused. An unbounded read is a way to exhaust the server's memory. */
const MAX_BODY_BYTES = 1024 * 1024;

async function readText(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        // Past the limit the rest is read and dropped rather than kept, so memory stays bounded and
        // the client still receives a 413 instead of a reset connection.
        if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    }
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    return Buffer.concat(chunks).toString('utf8');
}

async function handleApi(request, response, url) {
    const hasBody = request.method === 'POST' || request.method === 'PUT';
    const result = await mockApi.handle({
        method: request.method ?? 'GET',
        pathname: url.pathname,
        searchParams: url.searchParams,
        text: hasBody ? await readText(request) : '',
        // The report service renders with the package's own printable document, from the build.
        formatMarkdownDocument: url.pathname === '/api/reports'
            ? (await import(pathToFileURL(path.join(ROOT, 'dist', 'index.js')).href)).formatMarkdownDocument
            : undefined,
    });
    if (result === null) return false;
    response.writeHead(result.status, {
        'Content-Type': result.contentType,
        'Content-Length': Buffer.byteLength(result.body),
        'Cache-Control': 'no-store',
    });
    response.end(result.body);
    return true;
}


// ---------------------------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------------------------

/**
 * The only directories a browser may read. Not the repository root: that would hand `.git`, the
 * specs and anything uncommitted to whoever can reach the port.
 */
const SERVED_DIRECTORIES = ['dist', 'examples'];

/**
 * A request path as a file inside an allowed directory, or null.
 *
 * `path.relative` rather than `startsWith`: a prefix check passes a sibling directory whose name
 * begins with the root's, `apsw-gridwright-secrets` beside `apsw-gridwright`, which is exactly the
 * traversal it was meant to stop. Dotfiles and dot-directories are refused outright.
 */
export function resolveStaticPath(root, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }
    if (decoded.includes('\0')) return null;

    const filePath = path.resolve(root, `.${path.posix.normalize(`/${decoded}`)}`);
    const inside = path.relative(root, filePath);
    if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) return null;

    const segments = inside.split(path.sep);
    if (!SERVED_DIRECTORIES.includes(segments[0])) return null;
    if (segments.some((segment) => segment.startsWith('.'))) return null;
    if (segments.includes('node_modules')) return null;

    return filePath;
}

function serveStatic(request, response, url) {
    const requested = url.pathname === '/' ? '/examples/playground/index.html' : url.pathname;
    const filePath = resolveStaticPath(ROOT, requested);

    if (filePath === null) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
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

/**
 * Loopback only unless told otherwise. A development server on every interface serves this
 * repository's playground and mock API to anyone on the same network.
 */
const HOST = process.env.HOST ?? '127.0.0.1';

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

    // The pages load nothing cross-origin except React from the CDN in the import map, and are never
    // meant to be framed.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');

    try {
        if (url.pathname.startsWith('/api/')) {
            const handled = await handleApi(request, response, url);
            if (handled !== false) return;
        }
        serveStatic(request, response, url);
    } catch (error) {
        const status = error?.status === 413 ? 413 : 500;
        if (status === 500) console.error(error);
        if (!response.headersSent) response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        // A fixed sentence: an error's message can carry request data, and it is not echoed back.
        response.end(status === 413 ? 'Request body too large' : 'Server error');
    }
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    if (!fs.existsSync(path.join(ROOT, 'dist', 'index.js'))) {
        console.error('dist/ is missing. Run `npm run build` first, or use `npm run example`.\n');
        process.exit(1);
    }

    server.listen(PORT, HOST, () => {
        const base = `http://${HOST.includes(':') ? `[${HOST}]` : HOST}:${PORT}`;
        console.log('');
        console.log(`  apsw-gridwright playground   ${base}/`);
        console.log(`  every option at once         ${base}/examples/playground/tree.html`);
        console.log('');
        console.log(`  Serving dist/ and examples/ only, with ${mockApi.PEOPLE_COUNT.toLocaleString('en-US')} mock rows.`);
        if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
            console.log(`  Listening on ${HOST}: reachable from other machines on this network.`);
        }
        console.log('  Ctrl+C to stop.');
        console.log('');
    });
}
