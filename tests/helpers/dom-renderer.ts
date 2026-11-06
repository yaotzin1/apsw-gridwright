import { sanitizeNode, styleValueText, tableNode, viewEvent } from '../../src/view';
import type { GridHost, Handler, ViewAction, ViewEvent, ViewEventOrigin, ViewNode } from '../../src/view';

/**
 * A renderer for the view layer that uses the platform DOM and nothing else: no React, no virtual DOM
 * library, no framework. It is the second real renderer of the grid, written only against the public
 * `apsw-gridwright/view` contract, and it exists to test whether that contract survives a lifecycle
 * that is not React's:
 *
 * - **Retained elements.** It patches the elements it drew last time in place instead of describing a
 *   new tree, so focus, a half-typed value and the checked state of a checkbox the reader just clicked
 *   are the browser's, not a framework's.
 * - **Native events.** One `addEventListener` per element and event name, which reads the handler the
 *   latest drawing gave that element. No synthetic event system, no delegation, no event pooling: the
 *   browser's own bubbling, `stopPropagation` and `change`-after-`click` order.
 * - **Its own scheduling.** A change to the model is drawn in a microtask, so several store writes in
 *   one handler cost one redraw, and nothing is redrawn while an event is still bubbling.
 *
 * The cost of that last point is the one a non-React renderer most easily gets wrong: a `ViewEvent`'s
 * `origin` must be answered during dispatch, from the elements the event really passed through.
 *
 * Nothing here is imported from `src/react`. If it were, it would prove nothing.
 */

type Element_ = Extract<ViewNode, { kind: 'element' }>;
type Leaf = Element_ | Extract<ViewNode, { kind: 'text' }>;

/** How the DOM spells the attributes whose property name in a description differs. */
const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
    className: 'class',
    htmlFor: 'for',
    tabIndex: 'tabindex',
    colSpan: 'colspan',
    rowSpan: 'rowspan',
    readOnly: 'readonly',
    viewBox: 'viewBox',
};

/** Description fields that are properties of the live element rather than attributes, because the reader changes them. */
const PROPERTIES: ReadonlySet<string> = new Set(['value', 'checked', 'indeterminate', 'selected']);

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS: ReadonlySet<string> = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon']);

const kebab = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** What a click inside a row operates instead of selecting the row. The same list the React renderer uses. */
const CONTROL_SELECTOR =
    'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

/** Per element: the handlers the latest drawing gave it, the native listeners already attached, the description key. */
interface Drawn {
    handlers: Partial<Record<string, Handler>>;
    readonly listening: Set<string>;
    key: string | undefined;
    /** The attributes this renderer set last time, so one the description dropped is removed. */
    attributes: ReadonlySet<string>;
}

/**
 * Where an event came from, read from the DOM while the event is being dispatched. A cell belongs to this grid only when
 * its nearest table is the table around the element the handler is on, so a grid nested in a cell is another grid's.
 */
function originOf(current: Element, target: Element): ViewEventOrigin {
    const ownTable = current.closest('table');
    const cellElement = target.closest('td');
    const rowId = cellElement?.closest('tr')?.getAttribute('data-row-id') ?? null;
    const cell =
        cellElement !== null && ownTable !== null && cellElement.closest('table') === ownTable && rowId !== null
            ? {
                  rowId,
                  columnId: cellElement.getAttribute('data-column-id') ?? '',
                  holdsControl: cellElement.querySelector(CONTROL_SELECTOR) !== null,
                  targetIsCell: target === cellElement,
              }
            : undefined;
    const control = target.closest(CONTROL_SELECTOR);
    const selection = current.ownerDocument.getSelection();
    return {
        ...(cell ? { cell } : {}),
        fromControl: control !== null && current.contains(control),
        fromNestedGrid: current.localName === 'tr' && target.closest('tr') !== current,
        textSelected: selection !== null && !selection.isCollapsed && selection.anchorNode !== null && current.contains(selection.anchorNode),
    };
}

/** What an event is said to have come from once dispatch is over and the answer can no longer be true. */
const EXPIRED_ORIGIN: ViewEventOrigin = Object.freeze({ fromControl: true, fromNestedGrid: true, textSelected: true });

function toViewEvent(native: Event): ViewEvent {
    const keyed = native as Partial<KeyboardEvent & MouseEvent>;
    const target = native.target instanceof Element ? native.target : null;
    const current = native.currentTarget instanceof Element ? native.currentTarget : null;
    const field = target as Partial<HTMLInputElement> | null;
    const event = viewEvent({
        ...(typeof keyed.key === 'string' ? { key: keyed.key } : {}),
        shiftKey: keyed.shiftKey === true,
        ctrlKey: keyed.ctrlKey === true,
        metaKey: keyed.metaKey === true,
        altKey: keyed.altKey === true,
        ...(native instanceof MouseEvent ? { button: native.button } : {}),
        ...(typeof field?.value === 'string' && (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) ? { value: field.value } : {}),
        ...(target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio') ? { checked: target.checked } : {}),
        ...(target !== null && target.id !== '' ? { targetId: target.id } : {}),
        preventDefault: () => native.preventDefault(),
        stopPropagation: () => native.stopPropagation(),
    });
    let origin: ViewEventOrigin | undefined;
    Object.defineProperty(event, 'origin', {
        enumerable: true,
        get: () => {
            if (origin !== undefined) return origin;
            // Asked after dispatch: the tree may already be the next drawing's, so the cautious answer, not kept.
            if (native.eventPhase === Event.NONE || current === null || target === null) return EXPIRED_ORIGIN;
            return (origin = originOf(current, target));
        },
    });
    return event;
}

/** Fragments and slots dissolve into their children: the DOM has neither. A component has no registry here and draws nothing. */
function leavesOf(nodes: readonly ViewNode[], out: Leaf[] = []): Leaf[] {
    for (const node of nodes) {
        if (node.kind === 'fragment') leavesOf(node.children, out);
        else if (node.kind === 'element' || node.kind === 'text') out.push(node);
    }
    return out;
}

export interface DomGrid {
    /** Draws now, rather than in the next microtask. */
    flush(): void;
    /** Stops drawing, removes what was drawn, and destroys the host. */
    destroy(): void;
}

export interface DomRendererOptions {
    /** Told what the allowlist dropped, once per drawing that dropped something. */
    readonly onIssues?: (issues: readonly { readonly message: string }[]) => void;
}

/** Draws a grid host into a container and keeps it drawn. */
export function mountDomGrid<TRow>(host: GridHost<TRow>, container: Element, options: DomRendererOptions = {}): DomGrid {
    const document = container.ownerDocument;
    const drawn = new WeakMap<Node, Drawn>();
    /** The elements of the current drawing that have a key: what a focus request is resolved against, and nothing else. */
    let keyed = new Map<string, HTMLElement>();
    let scheduled = false;
    let alive = true;

    const apply = (action: ViewAction | void): void => {
        if (action && action.type === 'focus') keyed.get(action.key)?.focus();
    };

    const listenerFor = (name: string) =>
        function listener(this: Element, native: Event): void {
            const handler = drawn.get(this)?.handlers[name];
            if (handler) apply(handler(toViewEvent(native)));
        };

    const create = (node: Leaf): Node => {
        if (node.kind === 'text') return document.createTextNode(node.value);
        const element = SVG_TAGS.has(node.tag) ? document.createElementNS(SVG_NS, node.tag) : document.createElement(node.tag);
        drawn.set(element, { handlers: {}, listening: new Set(), key: node.key, attributes: new Set() });
        return element;
    };

    const reusable = (existing: Node | undefined, node: Leaf): boolean => {
        if (existing === undefined) return false;
        if (node.kind === 'text') return existing.nodeType === Node.TEXT_NODE;
        return existing instanceof Element && existing.localName === node.tag && drawn.get(existing)?.key === node.key;
    };

    const patchElement = (element: Element, node: Element_): void => {
        const state = drawn.get(element)!;
        const attrs = node.attrs ?? {};
        const set = new Set<string>();
        for (const [key, value] of Object.entries(attrs)) {
            if (PROPERTIES.has(key) || value === undefined || value === null) continue;
            const name = ATTRIBUTE_NAMES[key] ?? key;
            if (key === 'style' && typeof value === 'object') {
                const declarations = Object.entries(value)
                    .filter(([, v]) => v !== undefined)
                    .map(([property, v]) => `${property.startsWith('--') ? property : kebab(property)}: ${styleValueText(property, v as string | number)};`)
                    .join(' ');
                if (declarations === '') continue;
                if (element.getAttribute('style') !== declarations) element.setAttribute('style', declarations);
            } else if (typeof value === 'boolean') {
                // aria-* and data-* carry the word; any other boolean is present or absent.
                if (/^(aria|data)-/.test(key)) element.setAttribute(name, String(value));
                else if (value) element.setAttribute(name, '');
                else continue;
            } else if (element.getAttribute(name) !== String(value)) {
                element.setAttribute(name, String(value));
            }
            set.add(name);
        }
        for (const name of state.attributes) if (!set.has(name)) element.removeAttribute(name);
        state.attributes = set;

        // The properties the reader changes: written only when the description disagrees with the element, so a redraw
        // that agrees leaves the caret, the selection and the focus where they are.
        if (element instanceof HTMLInputElement) {
            const checked = attrs.checked === true;
            if ('checked' in attrs && element.checked !== checked) element.checked = checked;
            const indeterminate = attrs.indeterminate === true;
            if (element.indeterminate !== indeterminate) element.indeterminate = indeterminate;
            if (typeof attrs.value === 'string' || typeof attrs.value === 'number') {
                if (element.value !== String(attrs.value)) element.value = String(attrs.value);
            }
        }

        state.handlers = { ...(node.on ?? {}) };
        for (const name of Object.keys(state.handlers)) {
            if (state.listening.has(name)) continue;
            element.addEventListener(name, listenerFor(name));
            state.listening.add(name);
        }
        if (node.key !== undefined && element instanceof HTMLElement) keyed.set(node.key, element);

        patchChildren(element, node.children ?? []);

        // A select's choice is the option marked `selected`. Set after the options exist, and only when it differs.
        if (element instanceof HTMLSelectElement) {
            const chosen = (node.children ?? []).find((child) => child.kind === 'element' && child.tag === 'option' && child.attrs?.selected === true);
            const value = chosen?.kind === 'element' ? String(chosen.attrs?.value ?? '') : null;
            if (value !== null && element.value !== value) element.value = value;
        }
    };

    /**
     * Matches the new children to the elements already there: by key among keyed siblings (rows, cells, the pager's
     * buttons), by position among the rest. An element is moved only when it is out of place, because moving a focused
     * element blurs it.
     */
    function patchChildren(parent: Element, children: readonly ViewNode[]): void {
        const leaves = leavesOf(children);
        const existing = Array.from(parent.childNodes);
        const byKey = new Map<string, Node>();
        const unkeyed: Node[] = [];
        for (const child of existing) {
            const key = drawn.get(child)?.key;
            if (key !== undefined) byKey.set(key, child);
            else unkeyed.push(child);
        }
        const used = new Set<Node>();
        let unkeyedAt = 0;
        leaves.forEach((leaf, index) => {
            const key = leaf.kind === 'element' ? leaf.key : undefined;
            let candidate = key !== undefined ? byKey.get(key) : unkeyed[unkeyedAt++];
            if (!reusable(candidate, leaf) || (candidate !== undefined && used.has(candidate))) candidate = undefined;
            const target = candidate ?? create(leaf);
            used.add(target);
            if (leaf.kind === 'text') {
                if (target.nodeValue !== leaf.value) target.nodeValue = leaf.value;
            } else {
                patchElement(target as Element, leaf);
            }
            const here = parent.childNodes[index];
            if (here !== target) parent.insertBefore(target, here ?? null);
        });
        for (const child of existing) if (!used.has(child) && child.parentNode === parent) parent.removeChild(child);
    }

    const draw = (): void => {
        scheduled = false;
        if (!alive) return;
        const { node, issues } = sanitizeNode(tableNode(host.getModel()));
        if (issues.length > 0) options.onIssues?.(issues);
        keyed = new Map();
        patchChildren(container, node ? [node] : []);
        // Focus an add-on asked for once the page settled, resolved against this drawing only.
        const request = host.takeFocusRequest();
        if (request !== null) keyed.get(request)?.focus();
    };

    const schedule = (): void => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(draw);
    };

    const stop = host.subscribe(schedule);
    draw();

    return {
        flush: draw,
        destroy: () => {
            alive = false;
            stop();
            host.destroy();
            container.replaceChildren();
        },
    };
}
