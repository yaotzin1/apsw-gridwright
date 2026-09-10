import type { ReactNode } from 'react';
import { classes, useGridwrightContext } from '../context';

export interface GridTableProps {
    readonly children: ReactNode;
    readonly caption?: ReactNode;
    readonly 'aria-label'?: string;
}

/**
 * The table element and its scroll container.
 *
 * `role="grid"` goes on a real `<table>` rather than a stack of divs, so the column and row
 * relationships a screen reader announces come from the markup instead of from ARIA attributes
 * that have to be kept in sync by hand. The wrapper scrolls, not the table, which is what lets a
 * wide grid stay inside its column on a narrow screen.
 */
export function GridTable({ children, caption, 'aria-label': ariaLabel }: GridTableProps) {
    const { state, classNames } = useGridwrightContext();

    return (
        <div className={classes('gw-table-wrapper', classNames.tableWrapper)}>
            <table
                className={classes('gw-table', classNames.table)}
                role="grid"
                aria-label={ariaLabel}
                aria-rowcount={state.isTotalExact ? state.totalRows : -1}
                aria-busy={state.status === 'loading' || state.status === 'refreshing'}
            >
                {caption ? <caption className="gw-caption">{caption}</caption> : null}
                {children}
            </table>
        </div>
    );
}
