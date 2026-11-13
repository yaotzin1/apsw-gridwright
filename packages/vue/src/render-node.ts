import { h } from 'vue';
import type { VNodeChild } from 'vue';
import { sanitizeNode, styleValueText, viewEvent } from '@apsw/gridwright/view';
import type { Attrs, Handler, HandlerName, Handlers, StyleValue, ViewAction, ViewEvent, ViewEventOrigin, ViewNode } from '@apsw/gridwright/view';

export type VueComponentRenderer = (props: Readonly<Record<string, unknown>> | undefined) => VNodeChild;

export interface RenderViewNodeOptions {
    readonly slots?: Readonly<Record<string, (() => VNodeChild) | undefined>>;
    readonly components?: Readonly<Record<string, VueComponentRenderer>>;
    readonly registerFocusKey?: (key: string, el: Element | null) => void;
    readonly onAction?: (action: ViewAction) => void;
}

const ATTR_MAP: Readonly<Record<string, string>> = {
    className: 'class',
    htmlFor: 'for',
    tabIndex: 'tabindex',
    colSpan: 'colspan',
    rowSpan: 'rowspan',
    readOnly: 'readonly',
};

const EVENT_MAP: Readonly<Record<HandlerName, string>> = {
    click: 'onClick',
    keydown: 'onKeydown',
    keyup: 'onKeyup',
    input: 'onInput',
    change: 'onChange',
    focus: 'onFocus',
    blur: 'onBlur',
    pointerdown: 'onPointerdown',
};

const CONTROL_SELECTOR =
    'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

const EXPIRED_ORIGIN: ViewEventOrigin = Object.freeze({
    fromControl: true,
    fromNestedGrid: true,
    textSelected: true,
});

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
            if (native.eventPhase === Event.NONE || current === null || target === null) return EXPIRED_ORIGIN;
            return (origin = originOf(current, target));
        },
    });
    return event;
}

function buildStyleObject(style: StyleValue): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    let hasEntries = false;
    for (const [property, value] of Object.entries(style)) {
        if (value === undefined) continue;
        out[property] = styleValueText(property, value as string | number);
        hasEntries = true;
    }
    return hasEntries ? out : undefined;
}

export function buildElementProps(
    attrs: Attrs | undefined,
    handlers: Handlers | undefined,
    key: string | undefined,
    options: RenderViewNodeOptions,
): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    if (attrs) {
        for (const [rawName, rawValue] of Object.entries(attrs)) {
            if (rawValue === undefined || rawValue === null) continue;
            if (rawName === 'style' && typeof rawValue === 'object') {
                const styleObj = buildStyleObject(rawValue as StyleValue);
                if (styleObj) props.style = styleObj;
                continue;
            }
            const name = ATTR_MAP[rawName] ?? rawName;
            props[name] = rawValue;
        }
    }

    if (handlers) {
        for (const [eventName, handler] of Object.entries(handlers) as [HandlerName, Handler | undefined][]) {
            if (!handler) continue;
            const vueEventName = EVENT_MAP[eventName];
            if (!vueEventName) continue;
            props[vueEventName] = (native: Event) => {
                const action = handler(toViewEvent(native));
                if (action && options.onAction) options.onAction(action);
            };
        }
    }

    if (key !== undefined) {
        props.key = key;
        if (options.registerFocusKey) {
            const register = options.registerFocusKey;
            props.ref = (el: unknown) => {
                register(key, el instanceof Element ? el : null);
            };
        }
    }

    return props;
}

function renderSanitized(node: ViewNode, options: RenderViewNodeOptions): VNodeChild {
    switch (node.kind) {
        case 'text':
            return node.value;
        case 'fragment':
            return node.children.map((child) => renderSanitized(child, options));
        case 'slot': {
            const slots = options.slots;
            if (!slots || !Object.hasOwn(slots, node.name)) return null;
            return slots[node.name]?.() ?? null;
        }
        case 'component': {
            const components = options.components;
            if (!components || !Object.hasOwn(components, node.id)) return null;
            return components[node.id]?.(node.props as Readonly<Record<string, unknown>> | undefined) ?? null;
        }
        case 'element': {
            const props = buildElementProps(node.attrs, node.on, node.key, options);
            const children = node.children?.map((child) => renderSanitized(child, options));
            return h(node.tag, props, children);
        }
    }
}

/**
 * Renders a framework-neutral `ViewNode` tree into Vue 3 VNodes after passing it through
 * `sanitizeNode` from `@apsw/gridwright/view`.
 */
export function renderViewNode(node: ViewNode, options: RenderViewNodeOptions = {}): VNodeChild {
    const sanitized = sanitizeNode(node).node;
    return sanitized ? renderSanitized(sanitized, options) : null;
}
