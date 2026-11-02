import { createElement, Fragment } from 'react';
import type { ReactElement, ReactNode, SyntheticEvent } from 'react';
import { viewEvent } from '../../view/event';
import type { ViewEvent } from '../../view/event';
import { sanitizeNode } from '../../view/node';
import type { Handlers, RenderIssue, ViewAction, ViewNode } from '../../view/node';

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

/** A `ViewEvent` from what React hands a handler. Reads the fields a description may use, and no more. */
function toViewEvent(native: SyntheticEvent): ViewEvent {
    const event = native as SyntheticEvent & {
        key?: string;
        shiftKey?: boolean;
        ctrlKey?: boolean;
        metaKey?: boolean;
        altKey?: boolean;
        button?: number;
    };
    const target = native.target as { value?: unknown; checked?: unknown; id?: unknown } | null;
    return viewEvent({
        ...(event.key !== undefined ? { key: event.key } : {}),
        shiftKey: event.shiftKey === true,
        ctrlKey: event.ctrlKey === true,
        metaKey: event.metaKey === true,
        altKey: event.altKey === true,
        ...(typeof event.button === 'number' ? { button: event.button } : {}),
        ...(typeof target?.value === 'string' ? { value: target.value } : {}),
        ...(typeof target?.checked === 'boolean' ? { checked: target.checked } : {}),
        ...(typeof target?.id === 'string' && target.id !== '' ? { targetId: target.id } : {}),
        preventDefault: () => native.preventDefault(),
    });
}

/** Does what a handler asked for. The only action today is moving focus to an element it named by id. */
function applyAction(action: ViewAction | void, native: SyntheticEvent): void {
    if (!action || action.type !== 'focus') return;
    const root = (native.currentTarget as { getRootNode?: () => unknown } | null)?.getRootNode?.() as
        | { getElementById?: (id: string) => { focus?: () => void } | null }
        | undefined;
    root?.getElementById?.(action.targetId)?.focus?.();
}

function handlersOf(on: Handlers): Record<string, (event: SyntheticEvent) => void> {
    const out: Record<string, (event: SyntheticEvent) => void> = {};
    for (const [name, handler] of Object.entries(on)) {
        const prop = REACT_HANDLER[name];
        if (prop === undefined || typeof handler !== 'function') continue;
        out[prop] = (native) => applyAction(handler(toViewEvent(native)), native);
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
                if (current.on) Object.assign(props, handlersOf(current.on));
                return createElement(current.tag, props, ...(current.children ?? []).map((child, index) => draw(child, index)));
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
