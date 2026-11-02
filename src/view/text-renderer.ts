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

    const draw = (current: ViewNode, depth: number, seen: readonly string[]): void => {
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
                const filled = options.slots?.[current.name];
                if (filled === undefined) return;
                for (const child of filled) {
                    const inner = sanitizeNode(child, `slot ${current.name}`);
                    issues.push(...inner.issues);
                    if (inner.node) draw(inner.node, depth + 1, seen);
                }
                return;
            }
            case 'component': {
                lines.push(`${pad}<component id=${JSON.stringify(current.id)}>`);
                const resolve = options.components?.[current.id];
                if (resolve === undefined) {
                    issues.push({ code: 'component', message: `no component is registered for "${current.id}"` });
                    return;
                }
                // A registry entry that renders itself again would never end.
                if (seen.includes(current.id)) {
                    issues.push({ code: 'component', message: `the component "${current.id}" renders itself` });
                    return;
                }
                const inner = sanitizeNode(resolve(current.props), `component ${current.id}`);
                issues.push(...inner.issues);
                if (inner.node) draw(inner.node, depth + 1, [...seen, current.id]);
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
