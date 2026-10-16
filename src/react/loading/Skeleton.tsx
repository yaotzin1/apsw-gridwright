import type { CSSProperties } from 'react';
import { classes, useGridwrightContext } from '../context';
import { GridColumnGap } from '../parts/GridColumnGap';
import { columnCountOf, extraColumnsOf, renderedColumnsOf } from '../parts/slots';
import { useDelayed } from './useDelayed';
import type { SkeletonShape } from './types';

/** Line lengths, as percentages. Picked by row and column so a column of bars does not read as a barcode. */
const LENGTHS = [72, 58, 86, 48, 66, 80, 54, 92];

/** The longest skeleton, and the default. A page never has more rows than its size either way. */
export const MAX_SKELETON_ROWS = 50;
export const DEFAULT_SKELETON_ROWS = 8;

/** How many placeholder rows to draw: `rows`, kept between 1 and 50 and within one page. */
export function skeletonRowCount(rows: number | undefined, pageSize: number): number {
    const wanted = Number.isFinite(rows) ? Math.trunc(rows as number) : DEFAULT_SKELETON_ROWS;
    return Math.max(1, Math.min(wanted, MAX_SKELETON_ROWS, Math.max(1, pageSize)));
}

/** The length of a text bar. A pure function of position, so server and client draw the same. */
export function skeletonLength(row: number, column: number): number {
    return LENGTHS[(row * 3 + column * 5) % LENGTHS.length]!;
}

function SkeletonBar({ shape, row, column }: { readonly shape: SkeletonShape; readonly row: number; readonly column: number }) {
    if (shape === 'none') return null;
    if (shape === 'badge') return <span className="gw-skeleton gw-skeleton--badge" />;
    if (shape === 'avatar') {
        return (
            <span className="gw-skeleton-avatar-line">
                <span className="gw-skeleton gw-skeleton--avatar" />
                <span className="gw-skeleton gw-skeleton--text" style={{ width: `${skeletonLength(row, column) - 20}%` }} />
            </span>
        );
    }
    const style: CSSProperties = { width: shape === 'number' ? '40%' : `${skeletonLength(row, column)}%` };
    return <span className={classes('gw-skeleton', 'gw-skeleton--text', shape === 'number' && 'gw-skeleton--number')} style={style} />;
}

export interface SkeletonRowsProps {
    readonly rows?: number;
    readonly shapes?: Readonly<Record<string, SkeletonShape>>;
    readonly delay: number;
}

/**
 * Placeholder rows with the table's own columns: one cell per rendered column, the add-ons' extra
 * columns on either side, and one gap cell per run of columns a column window leaves unmounted.
 *
 * It goes through `renderedColumnsOf` like a real row, so five hundred columns under
 * `virtualColumns()` draw twelve cells. The rows are hidden from assistive technology; one
 * visually hidden row carries the grid's own loading text instead.
 */
export function SkeletonRows({ rows, shapes, delay }: SkeletonRowsProps) {
    const grid = useGridwrightContext();
    const ready = useDelayed(delay);
    const extras = extraColumnsOf(grid);
    const entries = renderedColumnsOf(grid);
    const count = skeletonRowCount(rows, grid.state.query.pagination.pageSize);

    return (
        <>
            <tr className="gw-skeleton-label">
                <td colSpan={columnCountOf(grid)}>{grid.labels.loading}</td>
            </tr>
            {ready &&
                Array.from({ length: count }, (_, row) => (
                    <tr key={row} className="gw-row gw-skeleton-row" aria-hidden="true">
                        {extras.start.map((column) => (
                            <td key={column.id} className="gw-cell" data-column-id={column.id} />
                        ))}
                        {entries.map((entry) =>
                            entry.kind === 'gap' ? (
                                <GridColumnGap key={entry.key} entry={entry} />
                            ) : (
                                <td key={entry.column.id} className="gw-cell gw-skeleton-cell" data-column-id={entry.column.id}>
                                    <SkeletonBar shape={shapes?.[entry.column.id] ?? 'text'} row={row} column={entry.index} />
                                </td>
                            ),
                        )}
                        {extras.end.map((column) => (
                            <td key={column.id} className="gw-cell" data-column-id={column.id} />
                        ))}
                    </tr>
                ))}
        </>
    );
}
