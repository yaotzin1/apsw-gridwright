/**
 * Builds the documentation pages of the hosted site from `docs/*.md`.
 *
 * It is a converter for the Markdown these files use and nothing more: headings, paragraphs, lists
 * (nested), tables, block quotes, fenced code, code spans, emphasis and links. Every character of
 * the source is escaped before any markup is added, so a document cannot put HTML into a page. A link
 * is written only when it is an http(s) or mailto address, a fragment or a repository path; any other
 * scheme comes out as plain text.
 *
 * Links between published pages point at the generated pages. Links to anything else in the
 * repository (the README, the examples, the specs) point at that file on GitHub.
 */
import fs from 'node:fs';
import path from 'node:path';

export const REPO = 'https://github.com/yaotzin1/apsw-gridwright';

/**
 * Mermaid is drawn by GitHub but not by npm or this site, so a mermaid block whose first line is a key here is replaced by
 * its prerendered picture from `site/` (published beside the docs, one level up). Any other mermaid block stays as code.
 */
const DIAGRAMS = {
    mindmap: { src: '../features.svg', alt: 'What Gridwright includes: data sources, the core add-ons, finding rows, working with rows, shape and scale, any screen, getting data out, MUI, and what is built in everywhere.' },
};

/** The published pages, grouped for the sidebar. Order within a group is reading order. */
export const NAV = [
    { group: 'Start', pages: [['getting-started', 'Getting started'], ['tour', 'The full tour'], ['react-playbook', 'React playbook']] },
    {
        group: 'Data',
        pages: [['data-sources', 'Data sources'], ['tree', 'Tree data'], ['grouping', 'Grouping'], ['virtualization', 'Virtualization'], ['persistence', 'Persisting changes'], ['url-sync', 'The view in the URL']],
    },
    {
        group: 'Features',
        pages: [['addons', 'Add-ons'], ['filtering', 'Filtering'], ['density', 'Density'], ['loading-indicators', 'Loading indicators'], ['column-layout', 'Column layout'], ['row-detail', 'Expandable rows'], ['export', 'Exporting'], ['responsive', 'Responsive']],
    },
    { group: 'Quality', pages: [['accessibility', 'Accessibility'], ['conformance', 'WCAG conformance'], ['i18n', 'Translation']] },
    { group: 'Extending', pages: [['extensibility', 'Extensibility'], ['plugins', 'Writing a plugin']] },
    { group: 'Reference', pages: [['api', 'API reference']] },
];

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function slugOf(text) {
    return text
        .replace(/`/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .trim()
        .replace(/ /g, '-');
}

/** Where a link in `fromFile` (a path under the repository) leads on the hosted site. Null means the link is not safe to write. */
export function resolveLink(href, fromFile, published) {
    if (/^(https?:|mailto:)/i.test(href)) return { href, external: !href.startsWith('mailto:') };
    if (href.startsWith('#')) return { href, external: false };
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;

    const hashAt = href.indexOf('#');
    const target = hashAt === -1 ? href : href.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : href.slice(hashAt);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), target));
    if (resolved.startsWith('..')) return null;

    const page = /^docs\/([a-z0-9-]+)\.md$/.exec(resolved);
    if (page && published.has(page[1])) return { href: `${page[1]}.html${hash}`, external: false };
    const kind = path.posix.extname(resolved) === '' ? 'tree' : 'blob';
    return { href: `${REPO}/${kind}/main/${resolved}${hash}`, external: true };
}

function inline(text, ctx) {
    const stash = [];
    const keep = (html) => `${stash.push(html) - 1}`;

    let out = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escapeHtml(code)}</code>`));
    out = out.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/gi, (_, url) => keep(`${open(url)}${escapeHtml(url)}</a>`));
    // The opening and closing tags are stashed apart so the label stays in the text and is escaped and emphasised like any other.
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `${keep(open(url))}${label}${keep('</a>')}`);
    out = escapeHtml(out)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![\w*])\*([^*\s][^*]*)\*(?![\w*])/g, '<em>$1</em>')
        .replace(/(?<![\w])_([^_\s][^_]*)_(?![\w])/g, '<em>$1</em>');
    out = out.replace(/(\d+)/g, (_, n) => stash[Number(n)]);
    return out.replace(/<a>(.*?)<\/a>/g, '$1');

    function open(url) {
        const resolved = resolveLink(url, ctx.file, ctx.published);
        // A link that is not safe to write becomes its label, with no tag around it; the closing tag goes with it.
        if (!resolved) return '<a>';
        const rel = resolved.external ? ' rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(resolved.href)}"${rel}>`;
    }
}

const isFence = (line) => /^\s*```/.test(line);
const isHeading = (line) => /^#{1,6}\s+\S/.test(line);
const isRule = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
const isQuote = (line) => /^\s*>/.test(line);
const isTableRow = (line) => /^\s*\|/.test(line);
const isSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const markerOf = (line) => /^(\s*)([-*+]|\d+\.)\s+/.exec(line);
const indentOf = (line) => /^\s*/.exec(line)[0].length;
const isBlockStart = (line) => isFence(line) || isHeading(line) || isRule(line) || isQuote(line) || isTableRow(line) || markerOf(line) !== null;

const cells = (line) =>
    line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim().replaceAll('\\|', '|'));

/**
 * A fenced block: a header with the language and a copy button, then the code. `highlight` returns a ready `<pre>` for
 * languages it knows, or null; the fallback is the escaped text. The button starts hidden because only `docs.js` can make it work.
 */
function codeBlock(code, language, highlight) {
    const pre = highlight?.(code, language) ?? `<pre><code>${escapeHtml(code)}</code></pre>`;
    const label = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '<span></span>';
    return `<div class="code">${label}<button type="button" class="copy" hidden>Copy</button>${pre}</div>`;
}

/** Block-level pass. `headings` collects `{ level, id, text }` for the page's table of contents. */
function blocks(lines, ctx) {
    const html = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') {
            i++;
            continue;
        }

        if (isFence(line)) {
            const indent = indentOf(line);
            const language = /```\s*([\w-]*)/.exec(line)[1];
            const body = [];
            i++;
            while (i < lines.length && !isFence(lines[i])) {
                body.push(lines[i].slice(Math.min(indent, indentOf(lines[i]))));
                i++;
            }
            i++;
            const diagram = language === 'mermaid' ? DIAGRAMS[body[0]?.trim()] : undefined;
            html.push(
                diagram
                    ? `<p class="diagram"><img src="${diagram.src}" alt="${escapeHtml(diagram.alt)}" loading="lazy"></p>`
                    : codeBlock(body.join('\n'), language, ctx.highlight),
            );
            continue;
        }

        if (isHeading(line)) {
            const [, hashes, text] = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
            const level = hashes.length;
            let id = slugOf(text);
            const seen = ctx.ids.get(id) ?? 0;
            ctx.ids.set(id, seen + 1);
            if (seen > 0) id = `${id}-${seen}`;
            ctx.headings.push({ level, id, text: text.replace(/`/g, '') });
            const anchor = level > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
            html.push(`<h${level} id="${id}">${inline(text, ctx)}${anchor}</h${level}>`);
            i++;
            continue;
        }

        if (isRule(line)) {
            html.push('<hr>');
            i++;
            continue;
        }

        if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
            const head = cells(line);
            const align = cells(lines[i + 1]).map((cell) => (cell.endsWith(':') ? (cell.startsWith(':') ? 'center' : 'right') : ''));
            i += 2;
            const rows = [];
            while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
            const cell = (tag, text, n) => `<${tag}${align[n] ? ` style="text-align:${align[n]}"` : ''}>${inline(text, ctx)}</${tag}>`;
            html.push(
                `<div class="table-wrap"><table><thead><tr>${head.map((c, n) => cell('th', c, n)).join('')}</tr></thead><tbody>${rows
                    .map((row) => `<tr>${row.map((c, n) => cell('td', c, n)).join('')}</tr>`)
                    .join('')}</tbody></table></div>`,
            );
            continue;
        }

        if (isQuote(line)) {
            const quoted = [];
            while (i < lines.length && isQuote(lines[i])) quoted.push(lines[i++].replace(/^\s*> ?/, ''));
            html.push(`<blockquote>${blocks(quoted, ctx)}</blockquote>`);
            continue;
        }

        const marker = markerOf(line);
        if (marker) {
            const base = marker[1].length;
            const ordered = /\d/.test(marker[2]);
            const items = [];
            while (i < lines.length) {
                const current = lines[i];
                const m = markerOf(current);
                if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
                const contentIndent = m[0].length;
                const item = [current.slice(contentIndent)];
                i++;
                while (i < lines.length) {
                    const next = lines[i];
                    if (next.trim() === '') {
                        let peek = i + 1;
                        while (peek < lines.length && lines[peek].trim() === '') peek++;
                        if (peek < lines.length && indentOf(lines[peek]) > base) {
                            item.push('');
                            i++;
                            continue;
                        }
                        break;
                    }
                    const nextMarker = markerOf(next);
                    if (nextMarker && nextMarker[1].length <= base) break;
                    if (indentOf(next) > base) {
                        item.push(next.slice(Math.min(contentIndent, indentOf(next))));
                        i++;
                        continue;
                    }
                    // An unindented line right under list text continues it, unless it starts a block of its own.
                    if (isBlockStart(next)) break;
                    item.push(next);
                    i++;
                }
                items.push(item);
                while (i < lines.length && lines[i].trim() === '' && markerOf(lines[i + 1] ?? '')?.[1].length === base) i++;
            }
            const tag = ordered ? 'ol' : 'ul';
            const body = items.map((item) => `<li>${blocks(item, ctx).replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`).join('');
            html.push(`<${tag}>${body}</${tag}>`);
            continue;
        }

        const paragraph = [];
        while (i < lines.length && lines[i].trim() !== '' && (paragraph.length === 0 || !isBlockStart(lines[i]))) paragraph.push(lines[i++].trim());
        html.push(`<p>${inline(paragraph.join(' '), ctx)}</p>`);
    }

    return html.join('\n');
}

/** Converts one document. `file` is its repository path, `published` the set of page slugs that exist on the site, `highlight` an optional `(code, language) => html | null`. */
export function renderMarkdown(source, { file = 'docs/index.md', published = new Set(), highlight = null } = {}) {
    const ctx = { file, published, highlight, ids: new Map(), headings: [] };
    const html = blocks(source.replaceAll('\r\n', '\n').split('\n'), ctx);
    return { html, headings: ctx.headings };
}

const flat = NAV.flatMap((entry) => entry.pages);

function page({ slug, title, body, headings }) {
    const index = flat.findIndex(([id]) => id === slug);
    const previous = flat[index - 1];
    const next = flat[index + 1];
    const sidebar = NAV.map(
        (entry) =>
            `<h2>${escapeHtml(entry.group)}</h2><ul>${entry.pages
                .map(([id, name]) => `<li><a href="${id}.html"${id === slug ? ' aria-current="page"' : ''}>${escapeHtml(name)}</a></li>`)
                .join('')}</ul>`,
    ).join('');
    const toc = headings
        .filter((heading) => heading.level === 2)
        .map((heading) => `<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`)
        .join('');
    const pager = [
        previous ? `<a rel="prev" href="${previous[0]}.html"><span>Previous</span>${escapeHtml(previous[1])}</a>` : '<span></span>',
        next ? `<a rel="next" href="${next[0]}.html"><span>Next</span>${escapeHtml(next[1])}</a>` : '<span></span>',
    ].join('');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · apsw-gridwright</title>
    <link rel="icon" href="../gridwright-mark.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../landing.css">
    <link rel="stylesheet" href="../docs.css">
    <script src="../docs.js" defer></script>
</head>
<body>
<header class="top">
    <a class="brand" href="../index.html">apsw-gridwright</a>
    <nav aria-label="Primary">
        <a href="getting-started.html" aria-current="true">Docs</a>
        <a href="../examples/playground/index.html">Playground</a>
        <a href="${REPO}">GitHub</a>
    </nav>
</header>
<div class="doc-layout">
    <details class="doc-menu" open>
        <summary>Documentation</summary>
        <nav aria-label="Documentation">${sidebar}</nav>
    </details>
    <main class="doc-main">
        <article>
${body}
        </article>
        <p class="edit"><a href="${REPO}/blob/main/docs/${slug}.md">Edit this page on GitHub</a></p>
        <nav class="pager" aria-label="Pages">${pager}</nav>
    </main>
    <aside class="doc-toc" aria-label="On this page"><h2>On this page</h2><ul>${toc}</ul></aside>
</div>
</body>
</html>
`;
}

const LANGUAGES = ['tsx', 'ts', 'js', 'bash', 'css', 'json', 'sql', 'html'];
const THEMES = { light: 'github-light', dark: 'github-dark' };

/**
 * A highlighter that colours code through CSS variables, so one page follows the reader's colour scheme with no script.
 * Shiki is a dev dependency of this build only; nothing it does reaches the published package.
 */
export async function createHighlight() {
    const { createHighlighter } = await import('shiki');
    const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
    const highlighter = await createHighlighter({ themes: Object.values(THEMES), langs: LANGUAGES, engine: createJavaScriptRegexEngine({ forgiving: true }) });
    return (code, language) => (LANGUAGES.includes(language) ? highlighter.codeToHtml(code, { lang: language, themes: THEMES, defaultColor: false }) : null);
}

/** Writes `<outDir>/<slug>.html` for every published page. Throws if a page in NAV has no source. */
export async function buildDocsSite(root, outDir, { highlight = null } = {}) {
    fs.mkdirSync(outDir, { recursive: true });
    const published = new Set(flat.map(([slug]) => slug));
    for (const [slug, name] of flat) {
        const file = `docs/${slug}.md`;
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const { html, headings } = renderMarkdown(source, { file, published, highlight });
        const title = headings.find((heading) => heading.level === 1)?.text ?? name;
        fs.writeFileSync(path.join(outDir, `${slug}.html`), page({ slug, title, body: html, headings }));
    }
    return flat.length;
}
