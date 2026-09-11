import { escapeMarkup } from './escape';
import { formatPrintDocument } from './print';
import type { PrintOptions } from './types';

/**
 * The Markdown this renders, and nothing else: headings, paragraphs, emphasis, code, links, rules,
 * blockquotes, bullet and numbered lists, and GitHub Flavored tables.
 *
 * A subset, deliberately. The package has no runtime dependencies and will not take a parser to
 * gain footnotes and reference links, and a report template built out of a grid's own rows needs
 * none of them. Anything outside the list travels as the text it was written as, so a template
 * using an unsupported construct produces a document with that construct visible in it rather than
 * a document missing a section.
 */
const ALLOWED_SCHEME = /^(?:https?:|mailto:|tel:)/i;
const BLOCKED_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Markdown to HTML, with every character of the source escaped before any markup is added.
 *
 * That order is the whole security story. Cells reach a template from wherever the rows came from,
 * so a value holding a script tag is escaped into text before this decides what is emphasis and
 * what is a link, and a link whose target is a script URL is rendered as the text it was written
 * as rather than as something clickable.
 */
export function markdownToHtml(markdown: string): string {
    const lines = markdown.replaceAll('\r\n', '\n').split('\n');
    const out: string[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index] ?? '';

        if (line.trim() === '') {
            index += 1;
            continue;
        }

        // A fence: everything to the closing fence is text, never markup, including the `#` and
        // `*` that would otherwise be a heading and emphasis.
        const fence = /^```\s*([A-Za-z0-9_+-]*)\s*$/.exec(line.trim());
        if (fence) {
            const body: string[] = [];
            index += 1;
            while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
                body.push(lines[index] ?? '');
                index += 1;
            }
            index += 1;
            const language = fence[1] ? ` class="language-${escapeMarkup(fence[1])}"` : '';
            out.push(`<pre><code${language}>${escapeMarkup(body.join('\n'))}</code></pre>`);
            continue;
        }

        if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            out.push('<hr>');
            index += 1;
            continue;
        }

        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            const level = heading[1]!.length;
            out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
            index += 1;
            continue;
        }

        if (isTableHeader(lines, index)) {
            const table: string[] = [];
            while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
                table.push(lines[index] ?? '');
                index += 1;
            }
            out.push(renderTable(table));
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quoted: string[] = [];
            while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
                quoted.push((lines[index] ?? '').replace(/^>\s?/, ''));
                index += 1;
            }
            out.push(`<blockquote>${markdownToHtml(quoted.join('\n'))}</blockquote>`);
            continue;
        }

        const bullet = /^\s*[-*+]\s+/;
        const numbered = /^\s*\d+[.)]\s+/;
        if (bullet.test(line) || numbered.test(line)) {
            const ordered = numbered.test(line);
            const marker = ordered ? numbered : bullet;
            const items: string[] = [];
            while (index < lines.length && marker.test(lines[index] ?? '')) {
                items.push((lines[index] ?? '').replace(marker, ''));
                index += 1;
            }
            const tag = ordered ? 'ol' : 'ul';
            out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
            continue;
        }

        // A paragraph runs to the next blank line, and a single newline inside it is a space, as
        // every Markdown renderer does it.
        const paragraph: string[] = [];
        while (
            index < lines.length &&
            (lines[index] ?? '').trim() !== '' &&
            !/^(?:#{1,6}\s|>\s?|```)/.test(lines[index] ?? '') &&
            !bullet.test(lines[index] ?? '') &&
            !numbered.test(lines[index] ?? '')
        ) {
            paragraph.push(lines[index] ?? '');
            index += 1;
        }
        out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }

    return out.join('\n');
}

const isTableHeader = (lines: readonly string[], at: number): boolean =>
    (lines[at] ?? '').trim().startsWith('|') &&
    /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[at + 1] ?? '') &&
    (lines[at + 1] ?? '').includes('-');

function renderTable(lines: readonly string[]): string {
    const cells = (line: string): string[] =>
        line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((value) => value.trim());

    const headers = cells(lines[0] ?? '');
    const aligns = cells(lines[1] ?? '').map((rule) =>
        rule.startsWith(':') && rule.endsWith(':')
            ? ' style="text-align:center"'
            : rule.endsWith(':')
              ? ' style="text-align:right"'
              : '',
    );

    const head = headers.map((header, at) => `<th${aligns[at] ?? ''}>${inline(header)}</th>`).join('');
    const body = lines
        .slice(2)
        .map(
            (line) =>
                `<tr>${cells(line)
                    .map((value, at) => `<td${aligns[at] ?? ''}>${inline(value)}</td>`)
                    .join('')}</tr>`,
        )
        .join('');

    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Inline markup, applied to already-escaped text.
 *
 * Code spans go first and their contents are left alone afterwards, so a backtick span holding
 * asterisks stays a backtick span holding asterisks.
 */
function inline(source: string): string {
    const codes: string[] = [];
    let text = escapeMarkup(source).replaceAll(/`([^`]+)`/g, (_match, code: string) => {
        codes.push(code);
        return `\uE000${codes.length - 1}\uE000`;
    });

    text = text
        .replaceAll(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
            const safe = href.replace(/&quot;|&#39;/g, '');
            // A relative path or a fragment has no scheme and is fine. A scheme that is not on the
            // list is not rendered as a link at all: `javascript:` in a cell is a value somebody
            // else wrote, and the document is opened by whoever asked for the export.
            if (BLOCKED_SCHEME.test(safe) && !ALLOWED_SCHEME.test(safe)) return match;
            return `<a href="${safe}">${label}</a>`;
        })
        .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replaceAll(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
        .replaceAll(/~~([^~]+)~~/g, '<del>$1</del>');

    return text.replaceAll(/\uE000(\d+)\uE000/g, (_match, at: string) => `<code>${codes[Number(at)]}</code>`);
}

/**
 * A Markdown report, rendered into the same printable document a table export uses.
 *
 * This is the whole of "Markdown as a PDF template": write the report as Markdown, fill it from
 * the rows with `formatMarkdownTemplate`, render it here, and let the browser's print dialog write
 * the PDF. No parser and no PDF engine enter the bundle, and a consumer who needs exact typography
 * can send the same Markdown to a service instead.
 */
export function formatMarkdownDocument(markdown: string, options: PrintOptions = {}): string {
    return formatPrintDocument(markdownToHtml(markdown), options);
}
