import type { CSSProperties } from 'react';
import type { SpinnerComponent } from './types';

/**
 * The four spinners the package draws, as SVG built from elements: nothing is parsed from a string
 * and nothing is fetched. They are animated by the stylesheet (`.gw-spinner` and its parts), take
 * their colours from `--gw-spinner-color` and `--gw-spinner-track-color`, and stand still under
 * `prefers-reduced-motion`.
 *
 * The three that follow the mark share its 64-unit box: a 3x3 grid of 16-unit cells, 4 units apart,
 * with one cell in focus.
 */

const CELLS = [4, 24, 44];

/** A plain circle. Readable at any size, the one to use where the mark would be too small. */
export const RingSpinner: SpinnerComponent = ({ className }) => (
    <svg className={className} viewBox="0 0 50 50" focusable="false" aria-hidden="true">
        <circle className="gw-spin-track" cx="25" cy="25" r="20" fill="none" />
        <circle className="gw-spin-arc" cx="25" cy="25" r="20" fill="none" strokeLinecap="round" />
    </svg>
);

/** One dot travelling over the nine cells, the keyboard cursor in motion. */
export const DotWalkSpinner: SpinnerComponent = ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        {CELLS.flatMap((y) => CELLS.map((x) => <rect key={`${x}-${y}`} className="gw-spin-cell" x={x} y={y} width="16" height="16" rx="3.5" />))}
        <rect className="gw-spin-dot" x="4" y="4" width="16" height="16" rx="3.5" />
    </svg>
);

/** The letter G drawn stroke by stroke, then drawn out again. */
export const DrawGSpinner: SpinnerComponent = ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        <path className="gw-spin-track" d="M50 18 A22 22 0 1 0 54 36 L34 36" fill="none" pathLength="100" />
        <path className="gw-spin-draw" d="M50 18 A22 22 0 1 0 54 36 L34 36" fill="none" pathLength="100" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** The nine cells taking the accent colour in turn. */
export const CellColorsSpinner: SpinnerComponent = ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        {CELLS.flatMap((y, row) =>
            CELLS.map((x, column) => (
                <rect
                    key={`${x}-${y}`}
                    className="gw-spin-cell gw-spin-cell--color"
                    style={{ '--gw-i': row * 3 + column } as CSSProperties}
                    x={x}
                    y={y}
                    width="16"
                    height="16"
                    rx="3.5"
                />
            )),
        )}
    </svg>
);

export const BUILT_IN_SPINNERS = {
    ring: RingSpinner,
    'dot-walk': DotWalkSpinner,
    'draw-g': DrawGSpinner,
    'cell-colors': CellColorsSpinner,
} as const;
