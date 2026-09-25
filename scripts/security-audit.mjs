/**
 * The security gate. Blocking, dependency-free, and fast enough for the pre-commit hook.
 *
 *   node scripts/security-audit.mjs            source, manifest, and dist/ when it exists
 *   node scripts/security-audit.mjs --source   source and manifest only (the pre-commit hook)
 *
 * It enforces `.agents/skills/application_security/SKILL.md`. Every rule is a pattern that has no
 * safe use in this repository; there is no inline suppression, by design. A rule that is wrong is
 * changed here, in a reviewed commit, together with the skill.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).split(path.sep).join('/');

/** Directories scanned for source rules. Tests are included: a test is code that runs too. */
export const SOURCE_DIRECTORIES = ['src', 'packages', 'examples', 'scripts', 'tests', '.githooks'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.html']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.git']);

/**
 * Rules applied to every source file.
 *
 * `code` rules run on the file with comments and string contents of test fixtures left in, because a
 * sink is a sink wherever it is written. Each rule names the skill section that explains it.
 */
export const SOURCE_RULES = [
    {
        id: 'html-sink/dangerously-set-inner-html',
        pattern: /dangerouslySetInnerHTML/,
        message: 'dangerouslySetInnerHTML is an HTML sink. Render text, or build elements with React.',
    },
    {
        id: 'html-sink/inner-html',
        pattern: /\.(?:innerHTML|outerHTML)\s*(?:\+?=)(?!=)/,
        message: 'Assigning innerHTML/outerHTML is an HTML sink. Use textContent, createElement or replaceChildren.',
    },
    {
        id: 'html-sink/insert-adjacent-html',
        pattern: /\.insertAdjacentHTML\s*\(/,
        message: 'insertAdjacentHTML is an HTML sink. Use insertAdjacentElement or createElement.',
    },
    {
        id: 'html-sink/document-write',
        pattern: /\bdocument\s*\.\s*(?:write|writeln)\s*\(/,
        message: 'document.write is an HTML sink.',
    },
    {
        id: 'script-sink/eval',
        pattern: /(?<![\w.])eval\s*\(/,
        message: 'eval executes a string as code.',
    },
    {
        id: 'script-sink/new-function',
        pattern: /\bnew\s+Function\s*\(/,
        message: 'new Function executes a string as code.',
    },
    {
        id: 'script-sink/string-timer',
        pattern: /\b(?:setTimeout|setInterval)\s*\(\s*['"`]/,
        message: 'A timer given a string evaluates it as code. Pass a function.',
    },
    {
        id: 'window/post-message-wildcard',
        pattern: /\.postMessage\s*\([^)]*,\s*['"]\*['"]/,
        message: "postMessage with '*' sends to any origin. Name the target origin.",
    },
    {
        id: 'suppression/security-lint-disabled',
        pattern: /eslint-disable(?:-next-line|-line)?[^\n]*\b(?:no-eval|no-implied-eval|no-new-func|no-script-url|no-proto|no-restricted-properties|no-restricted-syntax)\b/,
        message: 'A security lint rule may not be disabled inline. Change the design, or change the rule in a reviewed commit.',
    },
    {
        id: 'prototype-pollution/proto-key',
        pattern: /\[\s*['"]__proto__['"]\s*\]\s*=|\.__proto__\s*=|Object\.setPrototypeOf\s*\(/,
        message: 'Writing a prototype from code that handles data is how prototype pollution starts.',
    },
];

/** Rules that apply only under `src/`, the code a consumer installs. */
export const PACKAGE_RULES = [
    {
        id: 'window/open',
        pattern: /\bwindow\s*\.\s*open\s*\(/,
        message: 'window.open in the package gives the new page an opener. Use an anchor with rel="noopener noreferrer".',
    },
    {
        id: 'code-execution/node-modules',
        pattern: /from\s+['"](?:node:)?(?:child_process|vm|worker_threads)['"]|require\(\s*['"](?:node:)?(?:child_process|vm)['"]\s*\)/,
        message: 'The package has no reason to execute processes or code.',
    },
    {
        id: 'code-execution/dynamic-import',
        pattern: /\bimport\s*\(\s*(?!['"`])/,
        message: 'A computed dynamic import loads code chosen at runtime.',
    },
    {
        id: 'logging/console-log',
        pattern: /\bconsole\s*\.\s*(?:log|info|debug|trace)\s*\(/,
        message: 'The package logs only through console.warn and console.error, and never row data.',
    },
];

/**
 * A new tab must not get an opener. Checked per line: the rel belongs next to the target.
 */
const BLANK_TARGET = /target\s*[:=]\s*['"{]*_blank/;
const NOOPENER = /noopener/;

/**
 * An iframe document is a same-origin page unless it is sandboxed. The only place the package builds
 * one is the print frame, and it must set a sandbox that does not allow scripts before `srcdoc`.
 */
const SRCDOC = /\.srcdoc\s*=(?!=)/;
const SANDBOX = /setAttribute\(\s*['"]sandbox['"]\s*,\s*['"]([^'"]*)['"]\s*\)/;
export const SRCDOC_ALLOWED = ['src/react/export/download.ts'];

function* walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/');

/** Scans one file's text. Exported for the tests. */
export function auditSource(relativePath, text) {
    const findings = [];
    const isPackage = relativePath.startsWith('src/');
    const isTest = relativePath.startsWith('tests/');
    const lines = text.split(/\r?\n/);

    const rules = isPackage ? [...SOURCE_RULES, ...PACKAGE_RULES] : SOURCE_RULES;

    lines.forEach((line, index) => {
        for (const rule of rules) {
            if (rule.pattern.test(line)) {
                findings.push({ file: relativePath, line: index + 1, rule: rule.id, message: rule.message });
            }
        }

        if (BLANK_TARGET.test(line) && !NOOPENER.test(line)) {
            findings.push({
                file: relativePath,
                line: index + 1,
                rule: 'window/blank-target-without-noopener',
                message: 'target="_blank" needs rel="noopener noreferrer" on the same element.',
            });
        }

        // A test may read `frame.srcdoc` to assert on it; only assigning one is a sink.
        if (!isTest && SRCDOC.test(line)) {
            if (!SRCDOC_ALLOWED.includes(relativePath)) {
                findings.push({
                    file: relativePath,
                    line: index + 1,
                    rule: 'iframe/srcdoc-outside-print-frame',
                    message: 'srcdoc builds a same-origin document. The print frame is the only sanctioned one.',
                });
                return;
            }
            const before = lines.slice(0, index).join('\n');
            const sandbox = [...before.matchAll(new RegExp(SANDBOX, 'g'))].at(-1);
            if (!sandbox) {
                findings.push({
                    file: relativePath,
                    line: index + 1,
                    rule: 'iframe/srcdoc-without-sandbox',
                    message: 'Set a sandbox attribute on the frame before assigning srcdoc.',
                });
            } else if (/\ballow-scripts\b/.test(sandbox[1])) {
                findings.push({
                    file: relativePath,
                    line: index + 1,
                    rule: 'iframe/sandbox-allows-scripts',
                    message: 'The print frame sandbox must not include allow-scripts.',
                });
            }
        }
    });

    return findings;
}

/** The manifest rules: supply chain, as far as a file can show it. Exported for the tests. */
export function auditManifest(pkg, file = 'package.json') {
    const findings = [];
    const add = (rule, message) => findings.push({ file, line: 0, rule, message });

    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        add('supply-chain/runtime-dependencies', `Runtime dependencies are not allowed: ${Object.keys(pkg.dependencies).join(', ')}.`);
    }
    for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
        if (pkg.scripts?.[hook]) add('supply-chain/install-script', `The "${hook}" script runs code on a consumer's machine at install.`);
    }
    const allowedFiles = ['dist', 'README.md', 'LICENSE', 'CHANGELOG.md'];
    const files = pkg.files ?? [];
    const unexpected = files.filter((entry) => !allowedFiles.includes(entry));
    if (files.length === 0 || unexpected.length > 0) {
        add('supply-chain/files-allowlist', `"files" must list only ${allowedFiles.join(', ')}; found ${JSON.stringify(files)}.`);
    }
    if (pkg.publishConfig?.registry && !String(pkg.publishConfig.registry).startsWith('https://')) {
        add('supply-chain/insecure-registry', 'publishConfig.registry must be https.');
    }
    return findings;
}

/** `.npmrc` must not weaken transport or integrity. */
export function auditNpmrc(text) {
    const findings = [];
    text.split(/\r?\n/).forEach((line, index) => {
        if (
            /^\s*strict-ssl\s*=\s*false/i.test(line) ||
            /^\s*registry\s*=\s*http:/i.test(line) ||
            // Silencing the vulnerability report means a known-vulnerable dev dependency installs
            // without anybody being told.
            /^\s*audit\s*=\s*false/i.test(line)
        ) {
            findings.push({ file: '.npmrc', line: index + 1, rule: 'supply-chain/npmrc', message: `.npmrc weakens install safety: ${line.trim()}` });
        }
        if (/_authToken\s*=\s*(?!\$\{)/.test(line)) {
            findings.push({ file: '.npmrc', line: index + 1, rule: 'secrets/npm-token', message: 'A literal npm token in .npmrc. Use an environment variable.' });
        }
    });
    return findings;
}

/**
 * The built bundles: nothing the source rules forbid may appear through the build, and a source map
 * must not carry a developer's absolute paths.
 */
export function auditDist(relativePath, text) {
    const findings = [];
    if (relativePath.endsWith('.map')) {
        try {
            const map = JSON.parse(text);
            const absolute = (map.sources ?? []).filter((source) => /^(?:[A-Za-z]:[\\/]|\/(?:Users|home|root)\/)/.test(source));
            if (absolute.length > 0) {
                findings.push({ file: relativePath, line: 0, rule: 'dist/absolute-source-path', message: `Source map leaks absolute paths: ${absolute[0]}` });
            }
        } catch {
            findings.push({ file: relativePath, line: 0, rule: 'dist/unreadable-map', message: 'Source map is not valid JSON.' });
        }
        return findings;
    }
    const checks = [
        [/\beval\s*\(/, 'dist/eval'],
        [/\bnew Function\s*\(/, 'dist/new-function'],
        [/\.innerHTML\s*=(?!=)/, 'dist/inner-html'],
        [/dangerouslySetInnerHTML/, 'dist/dangerously-set-inner-html'],
        [/\bdocument\.write\s*\(/, 'dist/document-write'],
    ];
    for (const [pattern, rule] of checks) {
        if (pattern.test(text)) findings.push({ file: relativePath, line: 0, rule, message: `The built bundle contains ${rule.slice(5)}.` });
    }
    return findings;
}

/** The root manifest and one per directory under `packages/`, as paths relative to the root. */
export function publishedManifests() {
    const packages = path.join(ROOT, 'packages');
    const workspaces = fs.existsSync(packages)
        ? fs
              .readdirSync(packages, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packages, entry.name, 'package.json')))
              .map((entry) => `packages/${entry.name}/package.json`)
        : [];
    return ['package.json', ...workspaces];
}

export function runAudit({ sourceOnly = false } = {}) {
    const findings = [];

    for (const directory of SOURCE_DIRECTORIES) {
        for (const file of walk(path.join(ROOT, directory))) {
            const rel = relative(file);
            if (rel === SELF || rel === 'tests/unit/security-audit.test.ts') continue;
            if (!SOURCE_EXTENSIONS.has(path.extname(file)) && !rel.startsWith('.githooks/')) continue;
            findings.push(...auditSource(rel, fs.readFileSync(file, 'utf8')));
        }
    }

    // Every package this repository publishes: the grid at the root and each workspace package.
    for (const manifest of publishedManifests()) {
        findings.push(...auditManifest(JSON.parse(fs.readFileSync(path.join(ROOT, manifest), 'utf8')), manifest));
    }

    const npmrc = path.join(ROOT, '.npmrc');
    if (fs.existsSync(npmrc)) findings.push(...auditNpmrc(fs.readFileSync(npmrc, 'utf8')));

    let scannedDist = false;
    for (const manifest of sourceOnly ? [] : publishedManifests()) {
        const dist = path.join(ROOT, path.dirname(manifest), 'dist');
        if (!fs.existsSync(dist)) continue;
        scannedDist = true;
        for (const file of walk(dist)) {
            const rel = relative(file);
            if (!/\.(?:c?js|map)$/.test(rel)) continue;
            findings.push(...auditDist(rel, fs.readFileSync(file, 'utf8')));
        }
    }

    return { findings, scannedDist };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const { findings, scannedDist } = runAudit({ sourceOnly: process.argv.includes('--source') });
    if (findings.length === 0) {
        console.log(`security audit: no findings (source, manifest${scannedDist ? ', dist' : ''})`);
        process.exit(0);
    }
    console.error(`security audit: ${findings.length} finding(s). There are no exceptions; fix the code.\n`);
    for (const finding of findings) {
        console.error(`  ${finding.file}${finding.line ? `:${finding.line}` : ''}  [${finding.rule}]  ${finding.message}`);
    }
    process.exit(1);
}
