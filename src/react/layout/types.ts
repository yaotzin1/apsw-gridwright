declare module 'apsw-gridwright/react' {
    // Declared from the add-on, through the package's own specifier, the same way a third-party
    // add-on adds a column option. `TRow` and `TValue` must match the interface's own parameters.
    // The parameters are the interface's own; this declaration reads neither.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface GridwrightColumn<TRow, TValue> {
        /**
         * How this column behaves under `columnLayout()`: whether it can be resized, which edge it
         * is pinned to, whether the picker may hide it, and how wide it may grow.
         */
        readonly layout?: ColumnLayoutColumnOptions;
    }
}

/**
 * Which edge a column is pinned to.
 *
 * Named for the edges rather than for the writing direction, because that is what every other grid
 * calls them and what a saved layout from one will contain. They are applied as logical offsets, so
 * `left` is the start edge and lands on the right in a right-to-left page.
 */
export type ColumnPin = 'left' | 'right';

/**
 * The whole layout: what the reader changed, and what `initial` restores.
 *
 * Three flat records keyed by column id. It is expected to go through `JSON.stringify` into
 * `localStorage` or a preferences endpoint and come back unchanged, which is why an unpinned
 * column is `null` and not `undefined`: `JSON.stringify` drops the key of an `undefined` value, so
 * "explicitly not pinned" would come back as "nothing was said" and the column's own
 * `layout: { pinned }` would pin it again.
 */
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
    /**
     * The data columns in painting order, by id. Empty means "as declared".
     *
     * Ids naming a column that no longer exists are ignored, and a column this does not name keeps
     * its declared order after the ones it does, so a developer adding or removing a column does not
     * invalidate a reader's saved arrangement. Extra columns contributed by other add-ons are not in
     * it: they have no entry in the consumer's `columns` array and keep the end their `placement`
     * puts them at.
     */
    readonly order: readonly string[];
}

/**
 * A change to the layout, described before it happens, for `columnLayout({ canChange })` and
 * `useColumnLayout().allows`.
 *
 * A union rather than a type string beside a bag of optional fields, so a rule written about one
 * kind of change cannot read a field belonging to another.
 */
export type ColumnLayoutChange =
    | { readonly type: 'width'; readonly columnId: string; readonly width: number }
    | { readonly type: 'pin'; readonly columnId: string; readonly side: ColumnPin | null }
    | { readonly type: 'visibility'; readonly columnId: string; readonly hidden: boolean }
    | { readonly type: 'move'; readonly columnId: string; readonly toIndex: number }
    | { readonly type: 'showAll' }
    | { readonly type: 'reset' };

/** What a column says about its own layout, read by `columnLayout()`. */
export interface ColumnLayoutColumnOptions {
    /** Default true. False removes the resize handle from this column's header. */
    readonly resizable?: boolean;
    /** Pins the column to an edge from the start. The reader can change it through the controller. */
    readonly pinned?: ColumnPin;
    /**
     * Default true. False locks the column visible: the picker shows it checked and refuses to
     * uncheck it, rather than leaving it out, so the reader can see that it is deliberate.
     */
    readonly hideable?: boolean;
    /** The widest this column may be dragged. Default: no ceiling. */
    readonly maxWidth?: number;
    /**
     * Default true. False keeps the column where it is: it is not a drag source, it refuses
     * `Ctrl`+arrow, and nothing may be moved across it, so a locked first column stays first.
     */
    readonly movable?: boolean;
}

export interface ColumnLayoutOptions {
    /** A layout to start from: what `onChange` last handed you, parsed back out of storage. */
    readonly initial?: Partial<ColumnLayoutState>;
    /**
     * Called after a width, a pin or a visibility change has been committed and rendered. Never
     * during a drag, and never for the initial layout: a handler that writes to storage must not
     * overwrite a saved layout on every page load.
     */
    readonly onChange?: (layout: ColumnLayoutState) => void;
    /** The picker in the toolbar. Default true; false to place `<GridColumnPicker />` yourself. */
    readonly picker?: boolean;
    /** Resize handles at all. Default true. One column opts out with `layout: { resizable: false }`. */
    readonly resizable?: boolean;
    /** The width of a column that declares no pixel `width` of its own. Default 150. */
    readonly defaultWidth?: number;
    /** The floor every column is clamped to, under its own `minWidth`. Default 50. */
    readonly minWidth?: number;
    /** The width used for another add-on's extra column, which has no column definition. Default 48. */
    readonly extraColumnWidth?: number;
    /**
     * Dragging a header, and `Ctrl`/`Cmd` + arrow on it, at all. Default true. One column opts out
     * with `layout: { movable: false }`.
     */
    readonly reorderable?: boolean;
    /**
     * Called before every change the add-on commits -- a width, a pin, a visibility toggle, a move,
     * "show all" and "reset" -- including changes a consumer makes through the controller. Return
     * false to refuse it.
     *
     * For rules the per-column options cannot express: ones about more than one column ("at most
     * three pinned"), about the layout as a whole, or about something outside it entirely. It
     * narrows and never widens: a change the add-on already refuses stays refused whatever this
     * returns, so a column declared `movable: false` cannot be unlocked by a guard.
     *
     *     canChange: (change, layout) =>
     *         change.type !== 'pin' || change.side === null || Object.values(layout.pinned).filter(Boolean).length < 3,
     */
    readonly canChange?: (change: ColumnLayoutChange, layout: ColumnLayoutState) => boolean;
}

/**
 * The layout, and everything that changes it.
 *
 * Reach it with `useColumnLayout()` from anywhere inside a grid that lists `columnLayout()`: a
 * toolbar of your own, a preferences dialog, a keyboard shortcut. The picker and the resize handles
 * use exactly this and nothing else.
 */
export interface ColumnLayoutController {
    readonly layout: ColumnLayoutState;
    /**
     * The visible data columns in painting order. Always complete, whatever the saved order said,
     * and never holds an extra column's id.
     */
    readonly order: readonly string[];
    /** The width the column renders at now, resized or not, already clamped. */
    widthOf(columnId: string): number;
    pinOf(columnId: string): ColumnPin | null;
    isHidden(columnId: string): boolean;
    /** False for a column with `layout: { hideable: false }`, and for the last visible one. */
    canHide(columnId: string): boolean;
    /** False for a column with `layout: { resizable: false }`, or when the add-on has resizing off. */
    canResize(columnId: string): boolean;
    /** False for `layout: { movable: false }`, or when the add-on has reordering off. */
    canMove(columnId: string): boolean;
    /**
     * Whether that change would be allowed, without making it: the add-on's own rules, and then
     * `canChange`.
     *
     * What the built-in controls disable themselves from, and what a control of your own should ask,
     * so that the picker and your toolbar cannot disagree about what is allowed.
     */
    allows(change: ColumnLayoutChange): boolean;
    /** The column's position among the visible data columns, in painting order, or -1. */
    indexOf(columnId: string): number;
    /** The bounds a width is clamped to: the column's own `minWidth` and `layout.maxWidth`. */
    boundsOf(columnId: string): WidthBounds;
    setWidth(columnId: string, width: number): void;
    setPinned(columnId: string, side: ColumnPin | null): void;
    setHidden(columnId: string, hidden: boolean): void;
    /**
     * Moves the column to that position among the visible data columns; out of range clamps.
     *
     * A move into a run of columns pinned to an edge pins the column to that edge, and a move out of
     * one unpins it: a column painted between two frozen ones that scrolls away is not something a
     * reader can have asked for by dropping it there.
     */
    moveColumn(columnId: string, toIndex: number): void;
    showAll(): void;
    /** Back to what `initial` said, or to nothing when it said nothing. */
    reset(): void;
}

/** One column as the sticky arithmetic sees it: an id, a pixel width, and an edge or nothing. */
export interface LayoutColumn {
    readonly id: string;
    readonly width: number;
    readonly pinned: ColumnPin | null;
}

/** Where each pinned column sits, and the two that carry the elevation shadow. */
export interface StickyOffsets {
    readonly left: ReadonlyMap<string, number>;
    readonly right: ReadonlyMap<string, number>;
    /** The innermost column pinned to the start: the one the scrolling rows pass under. */
    readonly lastLeft: string | null;
    /** The innermost column pinned to the end. */
    readonly firstRight: string | null;
}

export interface WidthBounds {
    readonly min: number;
    readonly max: number;
}

export interface GridColumnPickerProps {
    readonly className?: string;
}

export interface GridResizeHandleProps {
    readonly columnId: string;
    readonly className?: string;
}
