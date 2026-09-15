// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditDist, auditManifest, auditNpmrc, auditSource, runAudit } from '../../scripts/security-audit.mjs';
import { resolveStaticPath } from '../../scripts/serve-example.mjs';

const rules = (file: string, text: string) => auditSource(file, text).map((finding) => finding.rule);

/**
 * The hostile inputs below are assembled from fragments, so this file does not itself contain the
 * patterns the gate refuses.
 */
const inner = ['inner', 'HTML'].join('');
const dangerous = ['dangerously', 'SetInnerHTML'].join('');

describe('the security gate refuses exploit-prone code', () => {
    it('refuses HTML sinks anywhere in the repository', () => {
        expect(rules('examples/page.js', `root.${inner} = message;`)).toContain('html-sink/inner-html');
        expect(rules('src/react/Cell.tsx', `<td ${dangerous}={{ __html: value }} />`)).toContain(
            'html-sink/dangerously-set-inner-html',
        );
        expect(rules('scripts/tool.mjs', 'node.insertAdjacentHTML("beforeend", text)')).toContain(
            'html-sink/insert-adjacent-html',
        );
        expect(rules('tests/unit/a.test.ts', 'document.write(text)')).toContain('html-sink/document-write');
    });

    it('allows reading innerHTML in a comparison, which is not a sink', () => {
        expect(rules('tests/react/a.test.tsx', `expect(node.${inner} === '').toBe(true)`)).toEqual([]);
    });

    it('refuses script sinks, string timers and wildcard messages', () => {
        const run = ['ev', 'al'].join('');
        expect(rules('src/x.ts', `${run}(code)`)).toContain('script-sink/eval');
        expect(rules('src/x.ts', 'const f = new Function("return 1")')).toContain('script-sink/new-function');
        expect(rules('src/x.ts', 'setTimeout("tick()", 10)')).toContain('script-sink/string-timer');
        expect(rules('examples/x.js', "frame.postMessage(data, '*')")).toContain('window/post-message-wildcard');
    });

    it('refuses a new tab without noopener, and accepts one with it', () => {
        expect(rules('examples/x.js', "h('a', { href, target: '_blank' })")).toContain(
            'window/blank-target-without-noopener',
        );
        expect(rules('examples/x.js', "h('a', { href, target: '_blank', rel: 'noopener noreferrer' })")).toEqual([]);
    });

    it('refuses an iframe document outside the print frame, and a print frame without a script-free sandbox', () => {
        expect(rules('src/react/Preview.tsx', 'frame.srcdoc = html;')).toContain('iframe/srcdoc-outside-print-frame');

        const printFrame = 'src/react/export/download.ts';
        expect(rules(printFrame, 'frame.srcdoc = html;')).toContain('iframe/srcdoc-without-sandbox');
        expect(rules(printFrame, "frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');\nframe.srcdoc = html;")).toContain(
            'iframe/sandbox-allows-scripts',
        );
        expect(rules(printFrame, "frame.setAttribute('sandbox', 'allow-same-origin allow-modals');\nframe.srcdoc = html;")).toEqual([]);
    });

    it('refuses package-only hazards under src and nowhere else', () => {
        expect(rules('src/react/x.ts', "window.open('https://example.com')")).toContain('window/open');
        expect(rules('src/core/x.ts', "import { exec } from 'node:child_process';")).toContain('code-execution/node-modules');
        expect(rules('src/core/x.ts', 'console.log(row)')).toContain('logging/console-log');
        expect(rules('scripts/tool.mjs', 'console.log("done")')).toEqual([]);
    });

    it('refuses disabling a security lint rule inline', () => {
        expect(rules('src/x.ts', '// eslint-disable-next-line no-restricted-properties')).toContain(
            'suppression/security-lint-disabled',
        );
    });

    it('refuses prototype writes from data handling', () => {
        expect(rules('src/x.ts', "target['__proto__'] = value")).toContain('prototype-pollution/proto-key');
    });
});

describe('the manifest and install configuration', () => {
    const safe = { files: ['dist', 'README.md', 'LICENSE', 'CHANGELOG.md'], scripts: { build: 'tsup' } };

    it('accepts the package as it is meant to be', () => {
        expect(auditManifest(safe)).toEqual([]);
    });

    it('refuses runtime dependencies, install scripts and a widened files list', () => {
        expect(auditManifest({ ...safe, dependencies: { leftpad: '1.0.0' } }).map((f) => f.rule)).toContain(
            'supply-chain/runtime-dependencies',
        );
        expect(auditManifest({ ...safe, scripts: { postinstall: 'node x.js' } }).map((f) => f.rule)).toContain(
            'supply-chain/install-script',
        );
        expect(auditManifest({ ...safe, files: ['dist', 'src'] }).map((f) => f.rule)).toContain('supply-chain/files-allowlist');
    });

    it('refuses an .npmrc that weakens install safety or holds a literal token', () => {
        expect(auditNpmrc('strict-ssl=false').map((f) => f.rule)).toContain('supply-chain/npmrc');
        expect(auditNpmrc('audit=false').map((f) => f.rule)).toContain('supply-chain/npmrc');
        expect(auditNpmrc('//registry.npmjs.org/:_authToken=abc123').map((f) => f.rule)).toContain('secrets/npm-token');
        expect(auditNpmrc('//registry.npmjs.org/:_authToken=${NPM_TOKEN}')).toEqual([]);
    });

    it('refuses built bundles with sinks, and source maps with a developer\'s absolute paths', () => {
        expect(auditDist('dist/react/index.js', `el.${inner} = x`).map((f) => f.rule)).toContain('dist/inner-html');
        expect(
            auditDist('dist/index.js.map', JSON.stringify({ sources: ['C:\\Users\\dev\\project\\src\\index.ts'] })).map((f) => f.rule),
        ).toContain('dist/absolute-source-path');
        expect(auditDist('dist/index.js.map', JSON.stringify({ sources: ['../src/index.ts'] }))).toEqual([]);
    });
});

describe('the repository passes its own gate', () => {
    it('has no findings in source and manifest', () => {
        const { findings } = runAudit({ sourceOnly: true });
        expect(findings).toEqual([]);
    });
});

describe('the playground server serves only what it should', () => {
    const root = path.resolve('/srv/apsw-gridwright');

    it('serves files inside dist and examples', () => {
        expect(resolveStaticPath(root, '/dist/index.js')).toBe(path.join(root, 'dist', 'index.js'));
        expect(resolveStaticPath(root, '/examples/playground/index.html')).toBe(
            path.join(root, 'examples', 'playground', 'index.html'),
        );
    });

    it('refuses traversal, including into a sibling whose name starts with the root', () => {
        expect(resolveStaticPath(root, '/../apsw-gridwright-secrets/token.txt')).toBeNull();
        expect(resolveStaticPath(root, '/dist/../../etc/hosts')).toBeNull();
        expect(resolveStaticPath(root, '/%2e%2e/%2e%2e/etc/hosts')).toBeNull();
    });

    it('refuses everything outside the allowlist: the repository root, git, dotfiles, node_modules', () => {
        expect(resolveStaticPath(root, '/package.json')).toBeNull();
        expect(resolveStaticPath(root, '/.git/config')).toBeNull();
        expect(resolveStaticPath(root, '/src/index.ts')).toBeNull();
        expect(resolveStaticPath(root, '/examples/.env')).toBeNull();
        expect(resolveStaticPath(root, '/examples/node_modules/x/index.js')).toBeNull();
    });

    it('refuses malformed encodings and null bytes', () => {
        expect(resolveStaticPath(root, '/dist/%E0%A4%A')).toBeNull();
        expect(resolveStaticPath(root, '/dist/index.js%00.html')).toBeNull();
    });
});
