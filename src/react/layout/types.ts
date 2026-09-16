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
}

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
    /** The width the column renders at now, resized or not, already clamped. */
    widthOf(columnId: string): number;
    pinOf(columnId: string): ColumnPin | null;
    isHidden(columnId: string): boolean;
    /** False for a column with `layout: { hideable: false }`, and for the last visible one. */
    canHide(columnId: string): boolean;
    /** False for a column with `layout: { resizable: false }`, or when the add-on has resizing off. */
    canResize(columnId: string): boolean;
    /** The bounds a width is clamped to: the column's own `minWidth` and `layout.maxWidth`. */
    boundsOf(columnId: string): WidthBounds;
    setWidth(columnId: string, width: number): void;
    setPinned(columnId: string, side: ColumnPin | null): void;
    setHidden(columnId: string, hidden: boolean): void;
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
