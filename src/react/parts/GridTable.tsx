import type { ReactNode, RefObject } from 'react';
import { rowNumbering } from '../a11y/rows';
import { classes, useGridwrightContext } from '../context';
import { useOptionalTreeContext } from '../tree/context';

export interface GridTableProps {
    readonly children: ReactNode;
    readonly caption?: ReactNode;
    /** The scroll container, for a virtualized body to measure and listen to. */
    readonly scrollRef?: RefObject<HTMLDivElement | null>;
    /** Caps the wrapper's height and lets it scroll vertically. Required for virtualization. */
    readonly maxHeight?: number | string;
    readonly 'aria-label'?: string;
}

/**
 * The table element and its scroll container.
 *
 * `role="grid"` goes on a real `<table>` rather than a stack of divs, so the column and row
 * relationships a screen reader announces come from the markup instead of from ARIA attributes
 * that have to be kept in sync by hand. The wrapper scrolls, not the table, which is what lets a
 * wide grid stay inside its column on a narrow screen.
 *
 * A tree is a `treegrid` instead. The role is what tells a screen reader to expect `aria-level` and
 * `aria-expanded` on the rows and to offer the expand and collapse keys for them; announcing the
 * hierarchy from inside a plain `grid` gets the attributes ignored.
 */
export function GridTable({
    children,
    caption,
    scrollRef,
    maxHeight,
    'aria-label': ariaLabel,
}: GridTableProps) {
    const { api, state, classNames } = useGridwrightContext();
    const tree = useOptionalTreeContext();

    const numbering = rowNumbering(state.totalRows, state.isTotalExact);

    return (
        <div
            ref={scrollRef}
            className={classes('gw-table-wrapper', classNames.tableWrapper)}
            style={maxHeight === undefined ? undefined : { maxHeight, overflowY: 'auto' }}
        >
            <table
                className={classes('gw-table', classNames.table)}
                role={tree ? 'treegrid' : 'grid'}
                aria-label={ariaLabel}
                // Counts the header row, because `aria-rowindex` does. The two have to agree, and
                // ARIA numbers every row of the table rather than every row of the body.
                aria-rowcount={numbering.rowCount}
                // Without it a reader has no way to know that more than one row may be selected,
                // and checkboxes alone do not say so: a single-selection grid has them too.
                aria-multiselectable={api.getSelectionMode() === 'multiple' ? true : undefined}
                aria-busy={state.status === 'loading' || state.status === 'refreshing'}
            >
                {caption ? <caption className="gw-caption">{caption}</caption> : null}
                {children}
            </table>
        </div>
    );
}
