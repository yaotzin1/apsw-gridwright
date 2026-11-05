/**
 * What an adapter hands a handler when something happens to an element the view layer described.
 *
 * Structural on purpose: no DOM type, no framework type. The adapter builds one from its native
 * event, calls the handler, and applies whatever it returns. `targetId` is the `id` an element
 * was given in the node description, so a handler can say which of its own elements was hit
 * without holding a reference to one.
 */
export interface ViewEvent {
    /**
     * Where the event came from, answered by the adapter so an add-on never holds an element. Optional:
     * an adapter or a test that has no tree to ask leaves it out, and a behaviour that needs it then does nothing.
     *
     * Read it while the handler runs. The answer is about the tree and the selection as they are during dispatch, so an
     * adapter that is asked later has nothing true to say and answers as cautiously as it can: from a control, from a
     * nested grid, text selected, no cell. A behaviour that acts on such an answer then does nothing.
     */
    readonly origin?: ViewEventOrigin;
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
    /** Keeps the event from reaching the elements around the one the handler is on, such as the row's own click. */
    stopPropagation(): void;
}

/**
 * Where an event came from, relative to the element the handler is on. The questions a selection
 * add-on used to answer by walking the DOM (`closest`, `getSelection`, which control a cell holds),
 * answered by the adapter instead. An adapter reads them lazily: a handler that ignores `origin`
 * pays nothing for it.
 */
export interface ViewEventOrigin {
    /**
     * The body cell of this grid's own table the event came from. Absent for the header, for a cell of
     * a grid nested inside this one, and for anything outside a cell.
     */
    readonly cell?: {
        readonly rowId: string;
        readonly columnId: string;
        /** The cell holds a control (button, link, input...) that Enter or Space operates. */
        readonly holdsControl: boolean;
        /** The event's own target is the cell, not something inside it. */
        readonly targetIsCell: boolean;
    };
    /** The event came from a control inside the row: a button, a link, an input, a label, an ARIA widget or an editable. */
    readonly fromControl: boolean;
    /** The event came from a row of a grid nested inside this one (a detail row), which selects its own rows. */
    readonly fromNestedGrid: boolean;
    /** A range of text is selected inside the element the handler is on: a click that ends a drag is copying, not selecting. */
    readonly textSelected: boolean;
}

/** A `ViewEvent` for code that has no native event to build it from: tests, string renderers. */
export function viewEvent(
    init: Partial<Omit<ViewEvent, 'preventDefault' | 'stopPropagation'>> & { preventDefault?: () => void; stopPropagation?: () => void } = {},
): ViewEvent {
    return {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...init,
        preventDefault: init.preventDefault ?? (() => undefined),
        stopPropagation: init.stopPropagation ?? (() => undefined),
    };
}
