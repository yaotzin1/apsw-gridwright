import { createElement, Fragment } from 'react';
import type { ReactElement, ReactNode, SyntheticEvent } from 'react';
import { sanitizeNode } from '../../view/node';
import type { Handlers, RenderIssue, ViewAction, ViewNode } from '../../view/node';
import { toViewEvent } from './to-view-event';

/**
 * The React renderer for the view layer's node description.
 *
 * It sanitizes first, through the same allowlist every renderer uses, and then does nothing but map:
 * an element becomes `createElement`, text becomes text, and a handler is wrapped so it receives a
 * `ViewEvent` instead of a React event. There is no path from a description to markup text.
 */

/** Native content a `component` node stands for, by id. The registry is the renderer's, never the data's. */
export type ViewComponents = Readonly<Record<string, (props: unknown) => ReactNode>>;

export interface RenderNodeOptions {
    /** Content for `slot` nodes by name. A slot with no entry draws nothing. */
    readonly slots?: Readonly<Record<string, ReactNode>>;
    /** Content for `component` nodes by id. An id with no entry draws nothing and is reported. */
    readonly components?: ViewComponents;
    /** Told what was dropped or could not be resolved, once per call. */
    readonly onIssues?: (issues: readonly RenderIssue[]) => void;
    /**
     * Told when an element that has a node `key` is attached (with the element) and detached (with null). A key is not
     * rendered, so this is how an adapter finds an element a description named, such as the one `settled` asked focus for.
     */
    readonly onKeyedElement?: (key: string, element: Element | null) => void;
}

const REACT_HANDLER: Readonly<Record<string, string>> = {
    click: 'onClick',
    keydown: 'onKeyDown',
    keyup: 'onKeyUp',
    input: 'onInput',
    change: 'onChange',
    focus: 'onFocus',
    blur: 'onBlur',
    pointerdown: 'onPointerDown',
};

/**
 * Does what a handler asked for. The only action today is moving focus to an element it named by `key`, and only among the
 * elements of the drawing the handler belongs to: a key that names nothing there does nothing, so an add-on cannot move focus
 * to another grid or to anything on the page it did not draw. Without a drawing (a handler built outside `renderNode`) there is
 * nothing to resolve a key against, and the request is dropped.
 */
function applyAction(action: ViewAction | void, drawn: ReadonlyMap<string, Element> | undefined): void {
    if (!action || action.type !== 'focus') return;
    (drawn?.get(action.key) as HTMLElement | undefined)?.focus?.();
}

/** The React props for a node's handlers, each wrapped to receive a `ViewEvent` and to apply the action it returns. */
export function handlersOf(on: Handlers, drawn?: ReadonlyMap<string, Element>): Record<string, (event: SyntheticEvent) => void> {
    const out: Record<string, (event: SyntheticEvent) => void> = {};
    for (const [name, handler] of Object.entries(on)) {
        const prop = REACT_HANDLER[name];
        if (prop === undefined || typeof handler !== 'function') continue;
        out[prop] = (native) => applyAction(handler(toViewEvent(native)), drawn);
    }
    return out;
}

function Native({ render, props }: { readonly render: (props: unknown) => ReactNode; readonly props: unknown }): ReactNode {
    return render(props);
}

const own = <T,>(table: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
    table !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;

/** Draws a node description as React elements. */
export function renderNode(node: ViewNode, options: RenderNodeOptions = {}): ReactNode {
    const { node: clean, issues } = sanitizeNode(node);
    const found: RenderIssue[] = [...issues];
    // The elements of this drawing that have a key, filled as React attaches them: what a focus action is resolved against.
    const drawn = new Map<string, Element>();

    const draw = (current: ViewNode, key: string | number): ReactNode => {
        switch (current.kind) {
            case 'text':
                return current.value;
            case 'fragment':
                return createElement(Fragment, { key }, ...current.children.map((child, index) => draw(child, index)));
            case 'element': {
                const props: Record<string, unknown> = { ...(current.attrs ?? {}), key: current.key ?? key };
                // The sanitizer hands back a style with no prototype, so a key such as `__proto__` is only data.
                // React calls `hasOwnProperty` on what it is given, which such an object does not have; a copy
                // made with `fromEntries` defines own properties without ever running a prototype setter.
                if (typeof props.style === 'object' && props.style !== null) props.style = Object.fromEntries(Object.entries(props.style));
                if (current.on) Object.assign(props, handlersOf(current.on, drawn));
                // `indeterminate` is a property of the element, not an attribute, and React has no prop for it.
                const hasIndeterminate = 'indeterminate' in props;
                const indeterminate = props.indeterminate === true;
                delete props.indeterminate;
                const keyed = current.key;
                if (hasIndeterminate || keyed !== undefined) {
                    props.ref = (element: HTMLInputElement | null) => {
                        if (hasIndeterminate && element) element.indeterminate = indeterminate;
                        if (keyed !== undefined) {
                            if (element) drawn.set(keyed, element);
                            else drawn.delete(keyed);
                            options.onKeyedElement?.(keyed, element);
                        }
                    };
                }
                const children = current.children ?? [];
                // A description marks the chosen option with `selected`, as HTML does; React wants the choice on the
                // select, as a controlled `value`, and warns when an option carries `selected` itself.
                let shown = children;
                if (current.tag === 'select') {
                    const chosen = children.find((child) => child.kind === 'element' && child.tag === 'option' && child.attrs?.selected === true);
                    if (chosen?.kind === 'element') props.value = String(chosen.attrs?.value ?? '');
                    shown = children.map((child) => {
                        if (child.kind !== 'element' || child.tag !== 'option' || child.attrs?.selected === undefined) return child;
                        const { selected: _selected, ...rest } = child.attrs;
                        return { ...child, attrs: rest };
                    });
                }
                return createElement(current.tag, props, ...shown.map((child, index) => draw(child, index)));
            }
            case 'slot':
                return createElement(Fragment, { key }, own(options.slots, current.name));
            case 'component': {
                const render = own(options.components, current.id);
                if (typeof render !== 'function') {
                    found.push({ code: 'component', message: `no component is registered for "${current.id}"` });
                    return null;
                }
                return createElement(Native, { key, render, props: current.props });
            }
        }
    };

    const element: ReactNode = clean ? draw(clean, 0) : null;
    if (found.length > 0) options.onIssues?.(found);
    return element;
}

/** The element for a description, for code that wants a `ReactElement` rather than any node. */
export function renderElement(node: ViewNode, options: RenderNodeOptions = {}): ReactElement | null {
    const rendered = renderNode(node, options);
    return rendered === null || rendered === undefined || typeof rendered === 'boolean' ? null : createElement(Fragment, null, rendered);
}
