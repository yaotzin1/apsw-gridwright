declare module 'apsw-gridwright/react' {
    // Declared from the add-on, through the package's own specifier, the same way a third-party
    // add-on adds a column option. The parameters are the interface's own; this declaration reads neither.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface GridwrightColumn<TRow, TValue> {
        /** How this column behaves at narrow widths under `responsive()`. */
        readonly responsive?: ColumnResponsive;
    }
}

/** What one column does as the grid's container narrows. Read by `responsive()`; ignored without it. */
export interface ColumnResponsive {
    /**
     * Hide the column while the grid's container is narrower than this many pixels.
     *
     * Only the view changes: the column is still sorted, filtered, searched and exported, and the
     * reader's saved layout is untouched, so widening the container brings it back as it was.
     */
    readonly hideBelow?: number;
}

export interface ResponsiveOptions {
    /**
     * The container width, in pixels, to assume until the real one is measured: on the server, and on
     * the first client render so both produce the same markup. Default: no width, which renders the
     * full table. A consumer who knows the device class at request time passes it.
     */
    readonly initialWidth?: number;
}
