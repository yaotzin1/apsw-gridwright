/** How much room a row takes. `comfortable` is the grid's own spacing, unchanged. */
export type DensityLevel = 'compact' | 'comfortable' | 'spacious';

export interface DensityOptions {
    /** The level to start on. Default `comfortable`. A level that is not in `levels` starts on the first. */
    readonly initial?: DensityLevel;
    /** The levels the control offers, in this order. Default all three. */
    readonly levels?: readonly DensityLevel[];
    /**
     * Row height in pixels per level. Default `compact` 32, `spacious` 52 and none for `comfortable`,
     * which leaves `--gw-row-height` to the stylesheet. A value that is not a positive finite number is
     * ignored for its level.
     *
     * The height is written to `--gw-row-height` on the grid's root, and `virtualRows()` places rows by
     * it, so rows and scrollbar stay in step. It therefore wins over a `--gw-row-height` set on an
     * ancestor: change it here.
     */
    readonly rowHeights?: Partial<Record<DensityLevel, number>>;
    /** Render the select in the toolbar. Default true. `useDensity()` works either way. */
    readonly control?: boolean;
    /**
     * Called when the level changes, never for the initial one, so a handler that writes to storage does
     * not write on mount. Store it and pass it back as `initial`: the package keeps no storage of its own.
     */
    readonly onChange?: (level: DensityLevel) => void;
}

export interface DensityController {
    readonly level: DensityLevel;
    /** The levels on offer, in order. */
    readonly levels: readonly DensityLevel[];
    /** Ignored for a level that is not in `levels`, and for the level already chosen. */
    setLevel(level: DensityLevel): void;
}
