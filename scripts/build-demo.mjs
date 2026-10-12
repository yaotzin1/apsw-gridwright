/**
 * Assembles the hosted playground for GitHub Pages into `demo-dist/`.
 *
 *   npm run build            the package first: the pages import the real files from dist/
 *   node scripts/build-demo.mjs
 *
 * `DEMO_BASE` is the path the site is served under (`/apsw-gridwright/` on Pages, `/` by default).
 * The layout is the repository's own, `dist/` beside `examples/playground/`, because the pages
 * reach the package with relative imports. Three things differ from `npm run example`, all of them
 * in the generated copy and never in the sources:
 *
 *   - the absolute `/examples/playground/` links get the base in front of them
 *   - `static-api.js` is loaded first, answering `/api/*` in the browser instead of a Node server
 *   - the landing page from `site/` is the root `index.html`, and `docs/*.md` become `docs/*.html` beside it
 *
 * Source maps are left out; nothing in the demo reads them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocsSite, createHighlight } from './docs-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'demo-dist');
const BASE = (process.env.DEMO_BASE ?? '/').replace(/\/?$/, '/');

if (!/^\/[A-Za-z0-9._~/-]*$/.test(BASE)) {
    console.error(`DEMO_BASE must be a plain path such as /apsw-gridwright/, got ${BASE}`);
    process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.js'))) {
    console.error('dist/ is missing. Run `npm run build` first.');
    process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });

const keep = (source) => !source.endsWith('.map') && !source.endsWith('README.md');
fs.cpSync(path.join(ROOT, 'dist'), path.join(OUT, 'dist'), { recursive: true, filter: keep });
fs.cpSync(path.join(ROOT, 'examples', 'playground'), path.join(OUT, 'examples', 'playground'), { recursive: true, filter: keep });

const playground = path.join(OUT, 'examples', 'playground');
const absolute = '/examples/playground/';
const hosted = `${BASE}examples/playground/`;

function rewrite(file, change) {
    const before = fs.readFileSync(file, 'utf8');
    const after = change(before);
    // At the default base there is nothing to change; at any other, no change means the sources moved.
    if (after === before && hosted !== absolute) throw new Error(`${path.relative(ROOT, file)}: nothing to rewrite, the playground changed shape`);
    fs.writeFileSync(file, after);
}

for (const page of ['index.html', 'tree.html']) {
    rewrite(path.join(playground, page), (html) =>
        html
            .replaceAll(absolute, hosted)
            .replace(
                `<script type="module" src="${hosted}js/`,
                `<script type="module" src="${hosted}static-api.js"></script>\n<script type="module" src="${hosted}js/`,
            ),
    );
}
rewrite(path.join(playground, 'js', 'shared', 'ui.js'), (js) => js.replaceAll(`'${absolute}js/'`, `'${hosted}js/'`));

// The landing page at the root. The version is read from the manifest so the page never states one by hand.
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true, filter: keep });
await buildDocsSite(ROOT, path.join(OUT, 'docs'), { highlight: await createHighlight() });
const landing = path.join(OUT, 'index.html');
fs.writeFileSync(landing, fs.readFileSync(landing, 'utf8').replaceAll('{{VERSION}}', version));

console.log(`demo-dist/ ready for ${BASE}`);
