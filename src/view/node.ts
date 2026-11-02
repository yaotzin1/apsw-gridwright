import { CONTRIBUTABLE_ATTRIBUTES } from './attributes';
import type { ViewEvent } from './event';

/**
 * A description of what to draw, as plain data.
 *
 * Not a virtual DOM and not a template: no diffing, no component model, nothing to run. An adapter
 * walks it once and creates its own framework's elements, which that framework then reconciles as it
 * always does. What cannot be said here cannot be drawn, and that is the point: there is no HTML
 * string kind, no raw-markup kind and no function-as-child, so the sinks the security rules ban
 * cannot be expressed, and the tags and attributes below are the only allowlist there is.
 */

/** The elements a description may use: a table and its parts, the form controls the grid draws, and a little structure. */
export const ALLOWED_TAGS = [
    'div',
    'span',
    'p',
    'button',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    'input',
    'label',
    'select',
    'option',
    'ul',
    'li',
    'svg',
    'path',
] as const;

export type AllowedTag = (typeof ALLOWED_TAGS)[number];

const ALLOWED_TAG_SET: ReadonlySet<string> = new Set(ALLOWED_TAGS);
export const isAllowedTag = (tag: string): tag is AllowedTag => ALLOWED_TAG_SET.has(tag);

/**
 * Attributes a description may set, besides `aria-*` and `data-*`: the inert ones an add-on may
 * contribute, and the few a form control or an svg needs. Named as the DOM names them
 * (`className`, `tabIndex`, `colSpan`), whichever framework draws them. No URL attribute is here
 * (`href`, `src`, `action`, `srcDoc`), and neither is anything that carries markup.
 */
export const NODE_ATTRIBUTES: ReadonlySet<string> = new Set([
    ...CONTRIBUTABLE_ATTRIBUTES,
    'type',
    'checked',
    'indeterminate',
    'disabled',
    'value',
    'name',
    'htmlFor',
    'min',
    'max',
    'step',
    'selected',
    'multiple',
    'placeholder',
    'readOnly',
    'required',
    'd',
    'viewBox',
    'fill',
    'focusable',
]);

/** The `type` values worth drawing. `file` and `image` reach outside the page, so they are not here. */
export const ALLOWED_INPUT_TYPES: ReadonlySet<string> = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'text', 'search', 'number', 'range']);

/** A button's `type`. */
export const ALLOWED_BUTTON_TYPES: ReadonlySet<string> = new Set(['button', 'submit', 'reset']);

/**
 * The functions a style or an svg paint may call. Everything else that looks like a call is refused,
 * because the ones that fetch (`url`, `image-set`, `src`, `image`, `cross-fade`, `paint`, `element`)
 * are only a few of the many ways CSS can name them, and a denylist is one release behind.
 */
const SAFE_CSS_FUNCTIONS: ReadonlySet<string> = new Set([
    'var', 'calc', 'min', 'max', 'clamp', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'repeat', 'minmax', 'fit-content',
    'translate', 'translatex', 'translatey', 'rotate', 'scale',
]);

/**
 * Whether a style or paint value may be drawn. Refused: a backslash (CSS escapes can spell `url(`),
 * a comment, an at-rule, a script scheme, `;` and braces (a value that ends its own declaration), and
 * any function not in `SAFE_CSS_FUNCTIONS`.
 */
export function isSafeCssValue(value: string): boolean {
    if (/[\\;{}@]|\/\*|javascript\s*:|expression\s*\(/i.test(value)) return false;
    for (const match of value.matchAll(/([a-z-]+)\s*\(/gi)) {
        if (!SAFE_CSS_FUNCTIONS.has(match[1]!.toLowerCase())) return false;
    }
    return true;
}

/**
 * CSS properties whose number means a count or a ratio and takes no unit. Every other number in a
 * style is a length and is drawn in pixels, which is what React and the other frameworks do, so a
 * description says `width: 140` and means the same on each of them.
 */
const UNITLESS_PROPERTIES: ReadonlySet<string> = new Set([
    'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice', 'borderImageWidth', 'columnCount', 'columns',
    'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'flexOrder', 'fontWeight', 'gridArea', 'gridColumn',
    'gridColumnEnd', 'gridColumnStart', 'gridRow', 'gridRowEnd', 'gridRowStart', 'lineHeight', 'opacity', 'order', 'orphans',
    'scale', 'tabSize', 'widows', 'zIndex', 'zoom', 'fillOpacity', 'floodOpacity', 'stopOpacity', 'strokeDasharray',
    'strokeDashoffset', 'strokeMiterlimit', 'strokeOpacity', 'strokeWidth',
]);

/** The text of one style value as a renderer that writes CSS prints it: lengths get `px`, `0` and unitless properties do not. */
export function styleValueText(property: string, value: string | number): string {
    if (typeof value === 'string') return value;
    if (value === 0 || property.startsWith('--') || UNITLESS_PROPERTIES.has(property)) return String(value);
    return `${value}px`;
}

export type AttrValue = string | number | boolean | undefined | null;
export type StyleValue = Readonly<Record<string, string | number | undefined>>;
export type Attrs = Readonly<Record<string, AttrValue | StyleValue>>;

/** The events a description may listen to. */
export const HANDLER_NAMES = ['click', 'keydown', 'keyup', 'input', 'change', 'focus', 'blur', 'pointerdown'] as const;
export type HandlerName = (typeof HANDLER_NAMES)[number];

/**
 * What a handler may ask the renderer to do afterwards. A description has no reference to an element
 * to focus, so it names one by the `id` it gave it.
 */
export type ViewAction = { readonly type: 'focus'; readonly targetId: string } | { readonly type: 'none' };

export type Handler = (event: ViewEvent) => ViewAction | void;
export type Handlers = Readonly<Partial<Record<HandlerName, Handler>>>;

export type ViewNode =
    | {
          readonly kind: 'element';
          readonly tag: AllowedTag;
          readonly attrs?: Attrs;
          readonly on?: Handlers;
          readonly children?: readonly ViewNode[];
          /** Stable among siblings, for a renderer whose framework keys its lists. */
          readonly key?: string;
      }
    | { readonly kind: 'text'; readonly value: string }
    | { readonly kind: 'fragment'; readonly children: readonly ViewNode[] }
    /** A place the consumer's own content goes: a cell body, a toolbar. */
    | { readonly kind: 'slot'; readonly name: string }
    /** Rich native content the adapter resolves by id from a registry it owns; never by a name read from data. */
    | { readonly kind: 'component'; readonly id: string; readonly props?: unknown };

export type ViewChild = ViewNode | string | number | null | undefined | false | readonly ViewChild[];

export interface ElementProps {
    readonly attrs?: Attrs;
    readonly on?: Handlers;
    readonly key?: string;
}

/** Turns what an author may write as a child into nodes: text for strings and numbers, nothing for `false`, `null` and `undefined`. */
export function childrenOf(children: readonly ViewChild[]): ViewNode[] {
    const out: ViewNode[] = [];
    const visit = (child: ViewChild): void => {
        if (child === null || child === undefined || child === false) return;
        if (Array.isArray(child)) {
            for (const inner of child as readonly ViewChild[]) visit(inner);
        } else if (typeof child === 'string' || typeof child === 'number') {
            out.push({ kind: 'text', value: String(child) });
        } else {
            out.push(child as ViewNode);
        }
    };
    children.forEach(visit);
    return out;
}

/** Writes an element: `h('button', { attrs: { type: 'button' }, on: { click } }, 'Sort')`. */
export function h(tag: AllowedTag, props: ElementProps = {}, ...children: readonly ViewChild[]): ViewNode {
    const node: Mutable<Extract<ViewNode, { kind: 'element' }>> = { kind: 'element', tag };
    if (props.attrs) node.attrs = props.attrs;
    if (props.on) node.on = props.on;
    if (props.key !== undefined) node.key = props.key;
    const nodes = childrenOf(children);
    if (nodes.length > 0) node.children = nodes;
    return node;
}

export const text = (value: string): ViewNode => ({ kind: 'text', value });
export const fragment = (...children: readonly ViewChild[]): ViewNode => ({ kind: 'fragment', children: childrenOf(children) });
export const slot = (name: string): ViewNode => ({ kind: 'slot', name });
export const component = (id: string, props?: unknown): ViewNode => (props === undefined ? { kind: 'component', id } : { kind: 'component', id, props });

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// --- The allowlist, applied --------------------------------------------------------------------------

export type RenderIssueCode = 'tag' | 'attribute' | 'handler' | 'node' | 'component' | 'slot';

/** Something a renderer dropped or could not resolve, with where it was. Reported, never silently lost. */
export interface RenderIssue {
    readonly code: RenderIssueCode;
    readonly message: string;
}

/**
 * A copy of a style object, read once. The check has looked at each value; returning the caller's own
 * object would let a getter, or a later write, hand the renderer a value the check never saw.
 */
function snapshotStyle(style: StyleValue): StyleValue {
    const copy: Record<string, string | number | undefined> = Object.create(null) as Record<string, string | number | undefined>;
    for (const [property, declared] of Object.entries(style)) copy[property] = declared;
    return copy;
}

const isAria = (key: string): boolean => /^aria-[a-z][a-z0-9-]*$/.test(key);
const isData = (key: string): boolean => /^data-[a-z][a-z0-9-]*$/.test(key);

function attrIssue(tag: string, key: string, value: unknown): string | null {
    if (isAria(key) || isData(key)) {
        return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)
            ? null
            : `the attribute "${key}" on <${tag}> holds a ${typeof value}; only text, numbers and booleans are drawn`;
    }
    if (!NODE_ATTRIBUTES.has(key)) return `the attribute "${key}" on <${tag}> is not on the allowlist`;
    if (key === 'style') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return `the attribute "style" on <${tag}> must be an object of CSS values`;
        }
        for (const [property, declared] of Object.entries(value)) {
            if (declared === undefined) continue;
            if (typeof declared !== 'string' && typeof declared !== 'number') return `the style "${property}" on <${tag}> must be text or a number`;
            if (typeof declared === 'string' && !isSafeCssValue(declared)) return `the style "${property}" on <${tag}> is not a plain CSS value, so it is not drawn`;
        }
        return null;
    }
    if (value !== null && typeof value === 'object') return `the attribute "${key}" on <${tag}> must be text, a number or a boolean`;
    if (typeof value === 'function') return `the attribute "${key}" on <${tag}> is a function; handlers go in "on"`;
    if (key === 'type') {
        const allowed = tag === 'input' ? ALLOWED_INPUT_TYPES : tag === 'button' ? ALLOWED_BUTTON_TYPES : null;
        if (allowed === null) return `the attribute "type" is not drawn on <${tag}>`;
        if (!allowed.has(String(value))) return `<${tag} type="${String(value)}"> is not drawn`;
    }
    if ((key === 'fill' || key === 'd' || key === 'viewBox') && typeof value === 'string' && !isSafeCssValue(value)) {
        return `the attribute "${key}" on <${tag}> is not a plain value, so it is not drawn`;
    }
    return null;
}

/**
 * Applies the one allowlist to a description and returns what is safe to draw, plus what was
 * dropped and why. Every adapter's renderer calls this first, so the rule exists once rather than
 * once per framework, and a hostile or careless description cannot reach an element or an attribute
 * that is not named in this file.
 *
 * Pure and non-throwing, whatever it is given: an unknown tag drops that element and its subtree, an unknown attribute or
 * handler is dropped from its element, and a node of an unknown kind is dropped. All are reported.
 */
export function sanitizeNode(node: ViewNode, path = 'root'): { readonly node: ViewNode | null; readonly issues: readonly RenderIssue[] } {
    const issues: RenderIssue[] = [];
    const walk = (current: ViewNode, where: string): ViewNode | null => {
        if (current === null || typeof current !== 'object') {
            issues.push({ code: 'node', message: `${where}: a description node must be an object` });
            return null;
        }
        switch (current.kind) {
            case 'text':
                return typeof current.value === 'string' ? current : (issues.push({ code: 'node', message: `${where}: text must be a string` }), null);
            case 'slot':
                return typeof current.name === 'string' && current.name !== '' ? current : (issues.push({ code: 'slot', message: `${where}: a slot needs a name` }), null);
            case 'component':
                return typeof current.id === 'string' && current.id !== '' ? current : (issues.push({ code: 'component', message: `${where}: a component needs an id` }), null);
            case 'fragment':
                return { kind: 'fragment', children: walkChildren(current.children, where) };
            case 'element': {
                if (!isAllowedTag(current.tag)) {
                    issues.push({ code: 'tag', message: `${where}: <${String(current.tag)}> is not an allowed element, so it and what is inside it are not drawn` });
                    return null;
                }
                const here = `${where}>${current.tag}`;
                const attrs: Record<string, AttrValue | StyleValue> = {};
                for (const [key, given] of Object.entries(current.attrs ?? {})) {
                    // An absent style is no style, as every framework reads it; a string or a list still is an error.
                    if (key === 'style' && (given === undefined || given === null)) continue;
                    // Copy first and check the copy: checking the caller's object and then copying it would
                    // read a getter twice, and the second read is the one that gets drawn.
                    const value = key === 'style' && given !== null && typeof given === 'object' && !Array.isArray(given) ? snapshotStyle(given as StyleValue) : given;
                    const problem = attrIssue(current.tag, key, value);
                    if (problem) issues.push({ code: 'attribute', message: `${here}: ${problem}` });
                    else attrs[key] = value;
                }
                const on: Record<string, Handler> = {};
                for (const [name, handler] of Object.entries(current.on ?? {})) {
                    if (!(HANDLER_NAMES as readonly string[]).includes(name)) {
                        issues.push({ code: 'handler', message: `${here}: "${name}" is not an event a description may listen to` });
                    } else if (typeof handler !== 'function') {
                        issues.push({ code: 'handler', message: `${here}: the "${name}" handler must be a function` });
                    } else {
                        on[name] = handler;
                    }
                }
                const out: Mutable<Extract<ViewNode, { kind: 'element' }>> = { kind: 'element', tag: current.tag };
                if (Object.keys(attrs).length > 0) out.attrs = attrs;
                if (Object.keys(on).length > 0) out.on = on as Handlers;
                if (current.key !== undefined) out.key = current.key;
                if (current.children !== undefined) {
                    const kept = walkChildren(current.children, here);
                    if (kept.length > 0) out.children = kept;
                }
                return out;
            }
            default:
                issues.push({ code: 'node', message: `${where}: "${String((current as { kind?: unknown }).kind)}" is not a kind of node` });
                return null;
        }
    };
    const walkChildren = (children: readonly ViewNode[] | undefined, where: string): ViewNode[] => {
        const out: ViewNode[] = [];
        if (children !== undefined && !Array.isArray(children)) {
            issues.push({ code: 'node', message: `${where}: children must be a list of nodes` });
            return out;
        }
        (children ?? []).forEach((child, index) => {
            const kept = walk(child, `${where}[${index}]`);
            if (kept) out.push(kept);
        });
        return out;
    };
    return { node: walk(node, path), issues };
}
