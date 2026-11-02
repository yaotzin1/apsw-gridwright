import type { AttrValue, RenderIssue, StyleValue, ViewNode } from './node';
import { sanitizeNode } from './node';

/**
 * A renderer that draws a description as indented text.
 *
 * It exists for two reasons. It proves the view layer is renderer-independent: everything in a
 * table's structure can be asserted without a DOM, a browser or a framework. And it is the shortest
 * complete example of what an adapter does: sanitize, then walk, resolving slots and components.
 *
 * One line per node, two spaces per level, attributes sorted by name and quoted as JSON:
 *
 *     <th aria-sort="ascending" class="gw-header-cell" scope="col">
 *       <button type="button">
 *         "Name"
 */

export interface Renderer<TOut> {
    /** Draws a description. Unknown tags and attributes are dropped and reported through `issues`. */
    render(node: ViewNode): TOut;
    /** What the last `render` dropped or could not resolve. */
    readonly issues: readonly RenderIssue[];
}

export interface TextRendererOptions {
    /** Content for `slot` nodes by name. A slot with no entry is drawn as an empty marker. */
    readonly slots?: Readonly<Record<string, readonly ViewNode[]>>;
    /** Native content for `component` nodes by id, as the adapter owns that registry. */
    readonly components?: Readonly<Record<string, (props: unknown) => ViewNode>>;
}

/** Deeper than any real table; a description that nests further is a loop or an attack. */
const MAX_DEPTH = 64;

/**
 * Nodes one render may draw. Depth alone does not bound the work: a component that renders itself twice,
 * or slots that each hold two of the next, expand to billions of nodes inside a depth of 64.
 */
const MAX_NODES = 20_000;

function ownEntry<T>(table: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
    return table !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** How the DOM spells the attributes whose property name differs. */
const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
    className: 'class',
    htmlFor: 'for',
    tabIndex: 'tabindex',
    colSpan: 'colspan',
    rowSpan: 'rowspan',
    readOnly: 'readonly',
};

const kebab = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function attributeLine(key: string, value: AttrValue | StyleValue): string | null {
    if (value === undefined || value === null) return null;
    const name = ATTRIBUTE_NAMES[key] ?? key;
    if (key === 'style' && typeof value === 'object') {
        const declarations = Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([property, v]) => `${property.startsWith('--') ? property : kebab(property)}: ${String(v)};`)
            .join(' ');
        return declarations ? `style=${JSON.stringify(declarations)}` : null;
    }
    if (typeof value === 'boolean') {
        // aria-* and data-* carry the word; any other boolean is present or absent.
        if (/^(aria|data)-/.test(key)) return `${name}=${JSON.stringify(String(value))}`;
        return value ? `${name}=""` : null;
    }
    return `${name}=${JSON.stringify(String(value))}`;
}

export function renderToText(node: ViewNode, options: TextRendererOptions = {}): { readonly text: string; readonly issues: readonly RenderIssue[] } {
    const { node: clean, issues: found } = sanitizeNode(node);
    const issues: RenderIssue[] = [...found];
    const lines: string[] = [];
    let budgetSpent = false;

    const draw = (current: ViewNode, depth: number, seen: readonly string[]): void => {
        if (budgetSpent) return;
        if (lines.length >= MAX_NODES) {
            budgetSpent = true;
            issues.push({ code: 'node', message: `the description is larger than ${MAX_NODES} nodes, so the rest is not drawn` });
            return;
        }
        if (depth > MAX_DEPTH) {
            issues.push({ code: 'node', message: `the description is nested deeper than ${MAX_DEPTH} levels, so the rest is not drawn` });
            return;
        }
        const pad = '  '.repeat(depth);
        switch (current.kind) {
            case 'text':
                lines.push(`${pad}${JSON.stringify(current.value)}`);
                return;
            case 'fragment':
                for (const child of current.children) draw(child, depth, seen);
                return;
            case 'element': {
                const attributes = Object.entries(current.attrs ?? {})
                    .map(([key, value]) => attributeLine(key, value))
                    .filter((line): line is string => line !== null)
                    .sort();
                lines.push(`${pad}<${current.tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`);
                for (const child of current.children ?? []) draw(child, depth + 1, seen);
                return;
            }
            case 'slot': {
                lines.push(`${pad}<slot name=${JSON.stringify(current.name)}>`);
                // Names are untrusted: only the caller's own entries count, never `constructor` or `__proto__`.
                const filled = ownEntry(options.slots, current.name);
                if (filled === undefined || !Array.isArray(filled)) return;
                const slotKey = `slot:${current.name}`;
                if (seen.includes(slotKey)) {
                    issues.push({ code: 'slot', message: `the slot "${current.name}" is filled with content that contains itself` });
                    return;
                }
                for (const child of filled) {
                    const inner = sanitizeNode(child, `slot ${current.name}`);
                    issues.push(...inner.issues);
                    if (inner.node) draw(inner.node, depth + 1, [...seen, slotKey]);
                }
                return;
            }
            case 'component': {
                lines.push(`${pad}<component id=${JSON.stringify(current.id)}>`);
                const resolve = ownEntry(options.components, current.id);
                if (typeof resolve !== 'function') {
                    issues.push({ code: 'component', message: `no component is registered for "${current.id}"` });
                    return;
                }
                const inner = sanitizeNode(resolve(current.props), `component ${current.id}`);
                issues.push(...inner.issues);
                if (inner.node) draw(inner.node, depth + 1, seen);
                return;
            }
        }
    };

    if (clean) draw(clean, 0, []);
    return { text: lines.length ? `${lines.join('\n')}\n` : '', issues };
}

/** The text renderer as an adapter author meets it: a `Renderer` that returns the text. */
export function stringRenderer(options: TextRendererOptions = {}): Renderer<string> {
    let last: readonly RenderIssue[] = [];
    return {
        render(node) {
            const result = renderToText(node, options);
            last = result.issues;
            return result.text;
        },
        get issues() {
            return last;
        },
    };
}
