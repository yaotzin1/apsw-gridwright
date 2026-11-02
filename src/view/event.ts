/**
 * What an adapter hands a handler when something happens to an element the view layer described.
 *
 * Structural on purpose: no DOM type, no framework type. The adapter builds one from its native
 * event, calls the handler, and applies whatever it returns. `targetId` is the `id` an element
 * was given in the node description, so a handler can say which of its own elements was hit
 * without holding a reference to one.
 */
export interface ViewEvent {
    readonly key?: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
    /** The pointer button for a click or press: 0 primary, 1 auxiliary, 2 secondary. */
    readonly button?: number;
    /** The current value of a form control, as text. */
    readonly value?: string;
    /** The checked state of a checkbox or radio. */
    readonly checked?: boolean;
    readonly targetId?: string;
    preventDefault(): void;
}

/** A `ViewEvent` for code that has no native event to build it from: tests, string renderers. */
export function viewEvent(init: Partial<Omit<ViewEvent, 'preventDefault'>> & { preventDefault?: () => void } = {}): ViewEvent {
    return {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...init,
        preventDefault: init.preventDefault ?? (() => undefined),
    };
}
