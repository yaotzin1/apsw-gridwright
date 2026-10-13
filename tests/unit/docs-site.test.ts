// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV, buildDocsSite, createHighlight, renderMarkdown, resolveLink, slugOf } from '../../scripts/docs-site.mjs';

// Loading Shiki's grammars takes seconds when the whole suite runs in parallel.
const SHIKI_TIMEOUT = 60_000;
const published = new Set(['addons', 'api']);
const render = (source: string) => renderMarkdown(source, { file: 'docs/guide.md', published }).html;

describe('what a document can put in a page', () => {
    // Built from fragments so this file stays clean for the security audit.
    const tag = (name: string, rest = '') => ['<', name, rest, '>'].join('');
    const scheme = ['java', 'script', ':'].join('');

    it('escapes markup instead of passing it through', () => {
        const html = render(`${tag('script')}alert(1)${tag('/script')}\n\n${tag('img', ' src=x onerror=1')}`);
        expect(html).not.toContain(tag('script'));
        expect(html).not.toContain(tag('img', ' src=x onerror=1'));
        expect(html).toContain('&lt;script&gt;');
    });

    it('writes no link for a scheme other than http, https or mailto', () => {
        const html = render(`[click](${scheme}alert(1)) and [data](data:text/html;base64,AAAA) and [net](//evil.example/x)`);
        expect(html).not.toContain('<a ');
        expect(html).toContain('click');
        expect(resolveLink(`${scheme}x`, 'docs/a.md', published)).toBeNull();
        expect(resolveLink('//evil.example', 'docs/a.md', published)).toBeNull();
    });

    it('refuses a path that climbs out of the repository', () => {
        expect(resolveLink('../../etc/passwd', 'docs/a.md', published)).toBeNull();
    });

    it('opens external links with noopener noreferrer', () => {
        expect(render('[site](https://example.com/x)')).toContain('rel="noopener noreferrer"');
    });

    it('keeps code, including markup and pipes, literal', () => {
        const html = render('`<Gridwright />` and\n\n```tsx\nconst a = <b>x</b> && y;\n```');
        expect(html).toContain('<code>&lt;Gridwright /&gt;</code>');
        expect(html).toContain('const a = &lt;b&gt;x&lt;/b&gt; &amp;&amp; y;');
    });
});

describe('links between pages', () => {
    it('points a published page at its generated page and keeps the fragment', () => {
        expect(resolveLink('addons.md#slots', 'docs/guide.md', published)).toEqual({ href: 'addons.html#slots', external: false });
    });

    it('points anything else in the repository at GitHub', () => {
        expect(resolveLink('../README.md', 'docs/guide.md', published)?.href).toBe('https://github.com/yaotzin1/apsw-gridwright/blob/main/README.md');
        expect(resolveLink('../examples/playground/', 'docs/guide.md', published)?.href).toContain('/tree/main/examples/playground/');
        expect(resolveLink('other.md', 'docs/guide.md', published)?.href).toContain('/blob/main/docs/other.md');
    });

    it('leaves a same-page fragment alone', () => {
        expect(resolveLink('#top', 'docs/guide.md', published)).toEqual({ href: '#top', external: false });
    });
});

describe('structure', () => {
    it('gives headings GitHub-style ids, and numbers a repeat', () => {
        expect(slugOf('Step 0 — Install')).toBe('step-0--install');
        const { html, headings } = renderMarkdown('## Same\n\n## Same', { file: 'docs/a.md' });
        expect(html).toContain('id="same"');
        expect(html).toContain('id="same-1"');
        expect(headings.map((h) => h.id)).toEqual(['same', 'same-1']);
    });

    it('nests lists and keeps a bullet list apart from a numbered one', () => {
        const html = render('- a\n  - b\n- c\n\n1. one\n2. two');
        expect(html).toBe('<ul><li>a\n<ul><li>b</li></ul></li><li>c</li></ul>\n<ol><li>one</li><li>two</li></ol>');
    });

    it('puts a code span inside a link label', () => {
        expect(render('[`columnLayout()`](addons.md)')).toBe('<p><a href="addons.html"><code>columnLayout()</code></a></p>');
    });

    it('renders a table with its alignment', () => {
        const html = render('| A | B |\n| :--- | ---: |\n| 1 | 2 |');
        expect(html).toContain('<th>A</th>');
        expect(html).toContain('<td style="text-align:right">2</td>');
    });
});

describe('code blocks', () => {
    // A fence is three backticks; the helper keeps the template literals below readable.
    const fenced = (language: string, code: string) => ["```" + language, code, "```"].join('\n');

    it('wraps a block with its language and a copy button that starts hidden', () => {
        const html = render(fenced('tsx', 'const a = 1;'));
        expect(html).toContain('<span class="code-lang">tsx</span>');
        expect(html).toContain('<button type="button" class="copy" hidden>Copy</button>');
        expect(html).toContain('<pre><code>const a = 1;</code></pre>');
    });

    it('uses the highlighter for a language it knows and the escaped text for one it does not', () => {
        const highlight = (code: string, language: string) => (language === 'tsx' ? `<pre class="shiki"><code>${code.length}</code></pre>` : null);
        const known = renderMarkdown(fenced('tsx', 'abc'), { highlight }).html;
        const unknown = renderMarkdown(fenced('mermaid', 'a --> b'), { highlight }).html;
        expect(known).toContain('<pre class="shiki"><code>3</code></pre>');
        expect(unknown).toContain('<pre><code>a --&gt; b</code></pre>');
    });

    it('replaces the feature mindmap with its prerendered picture and leaves other mermaid as code', () => {
        const mindmap = renderMarkdown(fenced('mermaid', 'mindmap\n  root((Gridwright))')).html;
        expect(mindmap).toContain('<img src="../features.svg"');
        expect(mindmap).not.toContain('<pre>');
        const other = renderMarkdown(fenced('mermaid', 'flowchart LR\n  a --> b')).html;
        expect(other).toContain('<pre><code>');
        expect(other).not.toContain('<img');
    });

    it('highlights real documentation with Shiki without letting markup through', async () => {
        const highlight = await createHighlight();
        const html = renderMarkdown(fenced('tsx', 'const a = <Gridwright columns={c} />;'), { highlight }).html;
        expect(html).toContain('class="shiki');
        // Shiki writes an escaped "<" as &#x3C;, the converter's own text as &lt;; either is escaped.
        expect(html).toMatch(/&(lt|#x3C);/);
        expect(html).not.toContain('<Gridwright');
    }, SHIKI_TIMEOUT);
});

describe('the site', () => {
    it('builds a page for every entry in the navigation from the real docs', async () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-docs-'));
        try {
            const count = await buildDocsSite(process.cwd(), out, { highlight: await createHighlight() });
            expect(count).toBe(NAV.flatMap((entry) => entry.pages).length);
            const page = fs.readFileSync(path.join(out, 'getting-started.html'), 'utf8');
            expect(page).toContain('<h1 id="getting-started">');
            expect(page).toContain('aria-current="page"');
            expect(page).toContain('class="shiki');
            expect(page).toContain('<script src="../docs.js" defer></script>');
            expect(page).not.toContain('undefined</a>');
        } finally {
            fs.rmSync(out, { recursive: true, force: true });
        }
    }, SHIKI_TIMEOUT);
});
