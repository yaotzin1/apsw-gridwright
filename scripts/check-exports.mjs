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

/** The MUI package, a workspace beside the grid. Its checks run when it has been built. */
const MUI_DIR = 'packages/mui';
const muiPkg = JSON.parse(fs.readFileSync(path.join(ROOT, MUI_DIR, 'package.json'), 'utf8'));

/** Every export condition must name a file the build actually produced. */
function checkExportTargets(manifest = pkg, base = '') {
    const walk = (node, trail) => {
        if (typeof node === 'string') {
            const target = path.posix.join(base, node.replace(/^\.\//, ''));
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

    walk(manifest.exports, base ? `${manifest.name}` : '');
}

/** `files` decides what npm publishes; a typo here ships an empty package. */
function checkPublishedFiles(manifest = pkg, base = '') {
    const at = (entry) => path.posix.join(base, entry);
    for (const entry of manifest.files ?? []) {
        if (exists(at(entry))) {
            ok(`files: ${at(entry)}`);
        } else {
            fail(`${at('package.json')} "files" lists ${entry}, which does not exist`);
        }
    }
    if (!(manifest.files ?? []).includes('dist')) {
        fail(`${at('package.json')} "files" does not include dist, so the published tarball has no code`);
    }
    if (!exists(at('LICENSE'))) {
        fail(`${at('LICENSE')} is missing, and the package declares itself MIT`);
    }
}

/**
 * Both module systems need their own `types`.
 *
 * A single `.d.ts` shared by `import` and `require` type-checks under `moduleResolution: node16`
 * as an ES module for both, and the CommonJS consumer then sees a default export that is not
 * there. The separate `.d.cts` is what makes `require()` type correctly.
 */
function checkTypeConditions(manifest = pkg) {
    for (const [subpath, conditions] of Object.entries(manifest.exports)) {
        if (typeof conditions !== 'object') continue;

        for (const system of ['import', 'require']) {
            const branch = conditions[system];
            if (branch === undefined) continue;

            const types = typeof branch === 'string' ? undefined : branch.types;
            if (!types) {
                fail(`${manifest.name} exports["${subpath}"].${system} has no types condition`);
            } else {
                ok(`types declared for ${manifest.name === pkg.name ? '' : `${manifest.name} `}${subpath} (${system})`);
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
        'computeVirtualWindow',
        'scrollOffsetForIndex',
        'corePlugins',
        'GridwrightError',
        'STAGE_ORDER',
        'VERSION',
        'createTreeController',
        'createTreeDataSource',
        'treePlugins',
        'buildTreeIndex',
        'createTranslator',
        'buildExportTable',
        'formatCsv',
        'formatExcelXml',
        'formatMarkdownTable',
        'formatMarkdownTemplate',
        'formatPrintHtml',
        'formatPrintDocument',
        'formatMarkdownDocument',
        'markdownToHtml',
    ];
    const expectedReact = [
        'Gridwright',
        'useGridwright',
        'GridwrightProvider',
        'GridRoot',
        'GridSlot',
        'GridTable',
        'GridRowView',
        // What a body or an extra row of your own is built from: the row including whatever the
        // add-ons render after it, and the cell count that spans the table.
        'GridRowOrCustom',
        'columnCountOf',
        'useAddonMessages',
        'useGridContributions',
        'mergeAttributes',
        // Every built-in feature is an add-on, exported beside the parts it composes.
        'coreAddons',
        'sorting',
        'selection',
        'pagination',
        'staleNotice',
        'search',
        'columnFilters',
        'exportMenu',
        'rowActions',
        'rowDetail',
        'inlineEditing',
        'treeData',
        'columnLayout',
        'GridColumnPicker',
        'GridResizeHandle',
        'useColumnLayout',
        'virtualRows',
        'useVirtualScroll',
        'cellNavigation',
        'CELL_NAVIGATION_ADDON',
        'useCellNavigation',
        'useOptionalCellNavigation',
        'useCellTabIndex',
        'BubbleMenu',
        'InlineEditProvider',
        'editableColumns',
        'GridVirtualBody',
        'useVirtualRows',
        'rowDataOf',
        'GridStaleNotice',
        'GridExportMenu',
        'useGridExport',
        'downloadFile',
        'printMarkdownDocument',
        'markdownReportFormats',
        'ColumnFilterProvider',
        'ColumnFilterTrigger',
        'GridFilterClear',
        'COLUMN_FILTER_OPERATORS',
        // The core add-ons' decisions, for any other view of them. The MUI package is built on
        // these and nothing private, so a third party can build the same thing.
        'ariaSortOf',
        'nextSortAction',
        'sortAnnouncement',
        'sortPriorityOf',
        'sortTitleOf',
        'pageSelectionOf',
        'selectionKeyDown',
        'selectionRowAttributes',
        'selectionTableAttributes',
        'DEFAULT_PAGE_SIZE_OPTIONS',
        'pageFocusAfterChange',
        'pageRangeOf',
        'pageSizeChoices',
    ];

    // Replaced by add-ons. A name that comes back is a second way to do one thing.
    const removedReact = ['TreeGridwright', 'useTreeGridwright'];

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
    for (const name of removedReact) {
        if (typeof react[name] !== 'undefined') fail(`dist/react/index.js still exports ${name}, which an add-on replaced`);
    }
    ok(`react ESM entry no longer exports ${removedReact.join(', ')}`);

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

function checkNoRuntimeDependencies(manifest = pkg) {
    const dependencies = Object.keys(manifest.dependencies ?? {});
    if (dependencies.length > 0) {
        // Not a rule of taste: every runtime dependency is a version this package can force on a
        // consumer's tree, and a grid is not worth a resolution conflict.
        fail(`${manifest.name} declares runtime dependencies: ${dependencies.join(', ')}`);
    } else {
        ok(`${manifest.name}: no runtime dependencies`);
    }
}

/** Every built JavaScript file under a directory, as paths relative to the root. */
const bundlesIn = (directory) =>
    fs
        .readdirSync(path.join(ROOT, directory), { recursive: true })
        .map((name) => path.posix.join(directory, String(name).split(path.sep).join('/')))
        .filter((name) => /\.c?js$/.test(name));

/**
 * No grid bundle may reach for MUI. The lint rule stops the import in source; this stops it
 * arriving any other way, because one reference puts MUI in the tree of every consumer.
 */
function checkGridIsMuiFree() {
    const leaking = bundlesIn('dist').filter((file) => /["']@mui\//.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
    if (leaking.length > 0) fail(`${leaking.join(', ')} reference @mui/, which only apsw-gridwright-mui may import`);
    else ok('no grid bundle references @mui/');
}

/**
 * The MUI package imports the grid at run time and carries no copy of it. A copy is a second
 * engine: `instanceof GridwrightError` fails across the two, and a fix to the grid does not reach
 * the MUI views until the MUI package is rebuilt.
 */
function checkMuiPackage() {
    if (!exists(`${MUI_DIR}/dist`)) {
        fail(`${MUI_DIR}/dist is missing. Run: npm run build`);
        return;
    }
    checkExportTargets(muiPkg, MUI_DIR);
    checkPublishedFiles(muiPkg, MUI_DIR);
    checkTypeConditions(muiPkg);
    checkNoRuntimeDependencies(muiPkg);

    for (const file of bundlesIn(`${MUI_DIR}/dist`)) {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
        if (!/["']apsw-gridwright\/react["']/.test(source)) fail(`${file} does not import apsw-gridwright/react`);
        // Source text the grid's own bundles contain and a consumer of its exports never would.
        if (/class GridwrightError\b|function createGridEngine\b/.test(source)) fail(`${file} carries a copy of the grid's engine`);
    }
    ok(`${muiPkg.name} imports the grid and carries no copy of it`);
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
checkGridIsMuiFree();
await checkRuntimeExports();

console.log(`
checking ${muiPkg.name}
`);
checkMuiPackage();

console.log('');
if (failures.length > 0) {
    for (const message of failures) console.error(`  FAIL ${message}`);
    console.error(`\n${failures.length} packaging problem(s).\n`);
    process.exit(1);
}

console.log('the published package resolves cleanly.\n');
