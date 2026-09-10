/**
 * Audits the built package the way a consumer meets it.
 *
 * The unit suite imports `src/`, so it cannot see any of this: an export map pointing at a file
 * the build never wrote, a CommonJS consumer with no types, React bundled into a core entry that
 * is supposed to run without it, or `dist` missing from `files` so the published tarball ships
 * nothing at all. Each of those has shipped from a repository with a green test suite.
 *
 *   node scripts/check-exports.mjs
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const failures = [];
const fail = (message) => failures.push(message);
const ok = (message) => console.log(`  ok   ${message}`);

const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

/** Every export condition must name a file the build actually produced. */
function checkExportTargets() {
    const walk = (node, trail) => {
        if (typeof node === 'string') {
            const target = node.replace(/^\.\//, '');
            if (exists(target)) {
                ok(`${trail} -> ${target}`);
            } else {
                fail(`exports${trail} points at ${target}, which does not exist. Run: npm run build`);
            }
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            walk(value, `${trail}[${key}]`);
        }
    };

    walk(pkg.exports, '');
}

/** `files` decides what npm publishes; a typo here ships an empty package. */
function checkPublishedFiles() {
    for (const entry of pkg.files ?? []) {
        if (exists(entry)) {
            ok(`files: ${entry}`);
        } else {
            fail(`package.json "files" lists ${entry}, which does not exist`);
        }
    }
    if (!(pkg.files ?? []).includes('dist')) {
        fail('package.json "files" does not include dist, so the published tarball has no code');
    }
    if (!exists('LICENSE')) {
        fail('LICENSE is missing, and the package declares itself MIT');
    }
}

/**
 * Both module systems need their own `types`.
 *
 * A single `.d.ts` shared by `import` and `require` type-checks under `moduleResolution: node16`
 * as an ES module for both, and the CommonJS consumer then sees a default export that is not
 * there. The separate `.d.cts` is what makes `require()` type correctly.
 */
function checkTypeConditions() {
    for (const [subpath, conditions] of Object.entries(pkg.exports)) {
        if (typeof conditions !== 'object') continue;

        for (const system of ['import', 'require']) {
            const branch = conditions[system];
            if (branch === undefined) continue;

            const types = typeof branch === 'string' ? undefined : branch.types;
            if (!types) {
                fail(`exports["${subpath}"].${system} has no types condition`);
            } else {
                ok(`types declared for ${subpath} (${system})`);
            }
        }
    }
}

async function checkRuntimeExports() {
    const expectedCore = [
        'createGridEngine',
        'createLocalDataSource',
        'createRemoteDataSource',
        'createRestDataSource',
        'createWindowedDataSource',
        'corePlugins',
        'GridwrightError',
        'STAGE_ORDER',
        'VERSION',
        'createTreeController',
        'createTreeDataSource',
        'treePlugins',
        'buildTreeIndex',
        'createTranslator',
    ];
    const expectedReact = [
        'Gridwright',
        'useGridwright',
        'GridwrightProvider',
        'GridTable',
        'TreeGridwright',
        'useTreeGridwright',
        'BubbleMenu',
        'InlineEditProvider',
        'editableColumns',
        'GridVirtualBody',
        'useVirtualRows',
    ];

    const core = await import(pathToFileURL(path.join(ROOT, 'dist/index.js')).href);
    for (const name of expectedCore) {
        if (typeof core[name] === 'undefined') fail(`dist/index.js does not export ${name}`);
    }
    ok(`core ESM entry exports ${expectedCore.length} expected names`);

    const coreCjs = require(path.join(ROOT, 'dist/index.cjs'));
    for (const name of expectedCore) {
        if (typeof coreCjs[name] === 'undefined') fail(`dist/index.cjs does not export ${name}`);
    }
    ok('core CommonJS entry matches the ESM entry');

    if (core.VERSION !== pkg.version) {
        // A stale VERSION constant is how a bug report ends up naming a release that never had it.
        fail(`VERSION is ${core.VERSION} but package.json says ${pkg.version}`);
    } else {
        ok(`VERSION matches package.json (${pkg.version})`);
    }

    const locales = await import(pathToFileURL(path.join(ROOT, 'dist/locales/index.js')).href);
    for (const tag of ['en', 'de', 'es', 'fr', 'pl']) {
        if (typeof locales[tag]?.locale !== 'string') {
            fail(`dist/locales/index.js does not export a usable "${tag}" catalog`);
        }
    }
    ok(`locales entry exports 5 catalogs`);

    const react = await import(pathToFileURL(path.join(ROOT, 'dist/react/index.js')).href);
    for (const name of expectedReact) {
        if (typeof react[name] === 'undefined') fail(`dist/react/index.js does not export ${name}`);
    }
    ok(`react ESM entry exports ${expectedReact.length} expected names`);

    // Same class identity across both entries, or `instanceof` silently stops working for anyone
    // who imports the error from one path and catches it from the other.
    if (react.GridwrightError !== core.GridwrightError) {
        fail('GridwrightError differs between the core and react entries: the shared chunk was not shared');
    } else {
        ok('both entries share one module instance');
    }
}

/** The core entry must stay usable where React is not installed at all. */
function checkCoreIsFrameworkFree() {
    const files = ['dist/index.js', 'dist/index.cjs'];
    const chunks = fs
        .readdirSync(path.join(ROOT, 'dist'))
        .filter((name) => name.startsWith('chunk-') && (name.endsWith('.js') || name.endsWith('.cjs')))
        .map((name) => `dist/${name}`);

    for (const file of [...files, ...chunks]) {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
        if (/require\(["']react["']\)|from ["']react["']/.test(source)) {
            fail(`${file} references react, but the core entry must import without it`);
        }
    }
    ok('core bundle and shared chunks contain no react import');
}

function checkNoRuntimeDependencies() {
    const dependencies = Object.keys(pkg.dependencies ?? {});
    if (dependencies.length > 0) {
        // Not a rule of taste: every runtime dependency is a version this package can force on a
        // consumer's tree, and a grid is not worth a resolution conflict.
        fail(`the package declares runtime dependencies: ${dependencies.join(', ')}`);
    } else {
        ok('no runtime dependencies');
    }
}

function checkStylesheet() {
    const css = fs.readFileSync(path.join(ROOT, 'dist/styles.css'), 'utf8');
    if (!css.includes('--gw-')) {
        fail('dist/styles.css has no --gw- custom properties, so it cannot be themed');
    } else {
        ok('stylesheet exposes theming custom properties');
    }
}

console.log('\nchecking the built package as a consumer meets it\n');

checkExportTargets();
checkPublishedFiles();
checkTypeConditions();
checkCoreIsFrameworkFree();
checkNoRuntimeDependencies();
checkStylesheet();
await checkRuntimeExports();

console.log('');
if (failures.length > 0) {
    for (const message of failures) console.error(`  FAIL ${message}`);
    console.error(`\n${failures.length} packaging problem(s).\n`);
    process.exit(1);
}

console.log('the published package resolves cleanly.\n');
